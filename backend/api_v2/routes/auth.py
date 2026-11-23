# -*- coding: utf-8 -*-
"""
api_v2/routes/auth.py
=====================
명세: 로그인 / 회원가입 / 로그아웃 / 토큰 검증 / 아이디·비밀번호 찾기 / 메일 인증

  POST /api/auth/login
  POST /api/auth/register
  POST /api/auth/logout
  GET  /api/auth/protected
  POST /api/auth/id_search
  POST /api/auth/pw_search
  POST /api/auth/email_verify
  POST /api/auth/verify_code

레거시와의 가장 큰 차이
----------------------
`User.password` 가 **해시**로 저장된다 (CAU_MIGRATION 기본 동작).
따라서 로그인 검증은 반드시 check_password_hash 로 한다.
레거시 app.py 의 평문 비교(`user['strPwd'] != password`)를 쓰면 안 된다.
"""

import random
import smtplib
import string
from datetime import datetime

from flask import Blueprint, current_app, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required,
)
from werkzeug.security import check_password_hash, generate_password_hash

from api_v2 import db
from api_v2.helpers import (
    current_user, error_status, fail_result, fmt_date,
    is_valid_password, ok_result, ok_status, PASSWORD_RULE_MESSAGE, role_label,
)

auth_bp = Blueprint("v2_auth", __name__, url_prefix="/api/auth")

# 메일 인증 코드 임시 저장소.
# 레거시 app.py 와 동일하게 프로세스 메모리에 둔다. 워커를 여러 개 띄우면
# 요청이 다른 워커로 가서 인증이 깨지므로, 운영에서는 Redis 나 별도 테이블로
# 옮겨야 한다. (명세에 저장 위치 지정이 없어 기존 동작을 유지했다.)
_email_codes = {}

CODE_TTL_SECONDS = 60 * 10


PORTAL_DOMAIN = "cau.ac.kr"


PORTAL_EMAIL_ERROR = (
    "학교 이메일(@%s)로만 가입할 수 있습니다. 포탈 아이디만 입력해 주세요."
    % PORTAL_DOMAIN
)


def portal_email(value):
    """
    회원가입·이메일 인증에 쓰는 학교 이메일 정규화.

    프론트는 인증 메일 발송에는 전체 주소(hong@cau.ac.kr)를, 회원가입에는
    포탈 아이디(hong)만 보낸다. 둘이 같은 키로 정규화되어야 인증 기록을
    찾을 수 있으므로 항상 소문자 전체 주소로 되돌린다.

      'hong'                     -> 'hong@cau.ac.kr'
      'hong@cau.ac.kr'           -> 'hong@cau.ac.kr'
      'HONG@CAU.AC.KR'           -> 'hong@cau.ac.kr'
      ' hong @cau.ac.kr'         -> 'hong@cau.ac.kr'
      'hong@cau.ac.kr@cau.ac.kr' -> 'hong@cau.ac.kr'
      'abc@gmail.com'            -> None
      'abc@gmail.com@cau.ac.kr'  -> None
      ''                         -> None

    학교 도메인이 아니면 None 이다. 승인 절차를 없앤 근거가 "학교 메일을
    받을 수 있는 사람만 가입한다" 이므로, 여기서 막지 않으면 그 전제가
    성립하지 않는다. 화면은 아이디만 입력받지만 API 를 직접 호출하면
    전체 주소를 보낼 수 있다.

    다만 막아야 하는 것은 외부 이메일이지 "학교 이메일을 전체 주소로 쓴
    것" 이 아니다. 프론트가 입력값에 도메인을 문자열로 이어붙이므로
    (`${formData.email}@cau.ac.kr`) 사용자가 전체 주소를 타이핑하면
    'hong@cau.ac.kr@cau.ac.kr' 이 온다. 뜻이 분명하니 반복된 학교 도메인은
    걷어내고 받아준다. 외부 도메인은 이 과정에서 벗겨지지 않아 그대로 걸린다.
      'abc@gmail.com@cau.ac.kr' -> 'abc@gmail.com' -> '@' 가 남아 거부

    앞뒤 공백도 여기서 흡수한다. 프론트가 이어붙이기 때문에 사용자가 공백을
    남기면 ' hong @cau.ac.kr' 처럼 공백이 가운데로 들어가는데, 전체 strip
    으로는 안 없어져서 인증 때와 가입 때 키가 어긋나 "메일 인증이 안
    됐습니다" 로 조용히 실패했다.
    """
    value = (value or "").strip().lower()
    if not value:
        return None

    # 뒤에 붙은 학교 도메인을 (여러 번 붙었더라도) 걷어내 로컬파트만 남긴다.
    suffix = "@" + PORTAL_DOMAIN
    while value.endswith(suffix):
        value = value[: -len(suffix)].strip()

    # 남은 값에 '@' 가 있으면 학교 도메인이 아닌 주소다.
    if not value or "@" in value or any(ch.isspace() for ch in value):
        return None
    return "%s@%s" % (value, PORTAL_DOMAIN)


def legacy_email_address(value):
    """
    이미 가입된 계정의 저장된 email 값으로 발송 주소를 만든다.

    portal_email 과 달리 도메인을 강제하지 않는다. 도메인 제한은 신규 계정을
    만드는 회원가입에만 필요하고, 비밀번호 찾기는 이미 존재하는 계정의 등록된
    주소로 보내는 것이라 검사할 이유가 없다. 나중에 졸업생 가입 경로를 열면
    그들도 비밀번호 찾기를 써야 하므로, 이 경로는 열어두는 편이 맞다.
    """
    value = (value or "").strip()
    if not value:
        return None
    return value if "@" in value else "%s@%s" % (value, PORTAL_DOMAIN)


def email_candidates(value):
    """
    이메일로 회원을 찾을 때 비교할 후보값들.

    레거시가 email 에 포탈 아이디만 저장한 계정이 6,798명이고
    전체 주소로 저장된 계정도 26명 있다. 사용자는 둘 중 어느 형태로도
    입력할 수 있으므로 양쪽을 모두 후보로 놓고 찾는다.
      'hong@cau.ac.kr' -> ['hong@cau.ac.kr', 'hong']
      'hong'           -> ['hong', 'hong@cau.ac.kr']
    """
    value = (value or "").strip()
    if not value:
        return []
    if "@" in value:
        return [value, value.split("@", 1)[0]]
    return [value, "%s@%s" % (value, PORTAL_DOMAIN)]


def _issue_code(email):
    code = "".join(random.choices(string.digits, k=6))
    _email_codes[email] = {
        "code": code,
        "verified": False,
        "issued_at": datetime.now(),
    }
    return code


def _tokens_for(user):
    claims = {
        "user_info": {
            "id": user["id"],
            "name": user["name"],
            "role": user["role"],
        }
    }
    return (
        create_access_token(identity=user["login_id"], additional_claims=claims),
        create_refresh_token(identity=user["login_id"], additional_claims=claims),
    )


# =============================================================================
# 로그인
# =============================================================================
@auth_bp.route("/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    user = db.query_one(
        "SELECT `id`, `login_id`, `password`, `name`, `role` "
        "FROM `User` WHERE `login_id` = ?",
        (username,),
    )
    if user is None:
        return error_status("존재하지 않는 사용자입니다.", 401, "user_not_found")

    # 레거시 이관 계정은 비밀번호를 옮기지 않아 password 에 '$migrated$'
    # 표식만 들어 있다 (routes/reactivate.py 참고). 이 경우는 비밀번호가
    # 틀린 게 아니라 활성화를 먼저 거쳐야 하므로 별도 안내가 필요하다.
    if _needs_reactivation(user["password"]):
        return error_status(
            "기존 회원 계정입니다. 계정 활성화를 먼저 진행해 주세요.",
            401, "needs_reactivation",
        )

    if not _verify_password(user["password"], password):
        return error_status("아이디 또는 비밀번호가 일치하지 않습니다.",
                            401, "invalid_credentials")

    access_token, refresh_token = _tokens_for(user)
    return ok_status(
        "로그인 성공",
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "user": {
                "id": user["id"],
                "user_id": user["login_id"],
                "username": user["name"],
                "role": role_label(user["role"]),
                # 명세의 role(admin/user)은 그대로 두고, 매니저 화면 분기를 위해
                # 실제 값(ADMIN/MANAGER/USER)을 덧붙여 내려준다.
                "roleDetail": user["role"],
            },
        },
    )


# routes/reactivate.py의 SENTINEL_LIKE 와 같은 값. SQL LIKE 파라미터로 쓸 때는
# 리터럴로 SQL 문자열에 박아 넣지 않고 바인딩한다 — 드라이버가 pymysql 로
# 바뀌면 `%`/`$` 가 Python 문자열 포매팅과 충돌해 쿼리가 깨질 수 있다.
SENTINEL_LIKE = "%$migrated$%"


def _needs_reactivation(stored_password):
    """이관 후 비밀번호를 설정하지 않은 계정인지 (routes/reactivate.py 의 표식과 동일)."""
    return bool(stored_password) and "$migrated$" in stored_password


def _verify_password(stored, raw):
    """
    저장된 해시로만 검증한다. 해시가 아닌 저장값(평문 이관본, 미이관 계정의
    sentinel 등)은 무조건 False다. 평문 폴백은 저장값 자체가 로그인
    비밀번호가 되어 버리므로 제거했다.
    """
    if not stored or not raw:
        return False
    if stored.startswith(("scrypt:", "pbkdf2:", "argon2")):
        return check_password_hash(stored, raw)
    return False


# =============================================================================
# 회원가입
# =============================================================================
@auth_bp.route("/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or "").strip()
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""
    email = (body.get("email") or "").strip() or None
    backup_email = (body.get("backupEmail") or "").strip() or None
    phone = (body.get("phone") or "").strip() or None
    college = (body.get("college") or "").strip() or None
    major = (body.get("major") or "").strip() or None
    student_id = body.get("studentId")

    if not login_id or not name or not password:
        return fail_result("필수 항목(userId, name, password)이 누락되었습니다.")

    # 화면은 이 규칙을 강제로 입력시키지만, API 를 직접 호출하면 건너뛸 수
    # 있어 서버에서도 다시 본다 (프론트만 믿지 않는다).
    if not is_valid_password(password):
        return fail_result(PASSWORD_RULE_MESSAGE, error_code="invalid_password")

    # 학교 이메일만 허용한다. 화면은 아이디만 입력받지만 API 를 직접 호출하면
    # 외부 주소를 보낼 수 있어 여기서 막는다.
    portal = portal_email(email)
    if portal is None:
        return fail_result(PORTAL_EMAIL_ERROR, error_code="invalid_email_domain")

    # 메일 인증 확인 (인증 메일 발송 -> 코드 확인 순서를 강제)
    # 프론트가 email 에 포탈 아이디만 보내므로 전체 주소로 맞춰서 찾는다.
    # 예비 이메일(backupEmail)은 연락처로만 저장하고 인증 수단으로 쓰지 않는다.
    record = _email_codes.get(portal)
    if record is None or not record.get("verified"):
        return fail_result("메일 인증이 안 됐습니다.")

    if db.scalar("SELECT COUNT(*) FROM `User` WHERE `login_id` = ?", (login_id,)):
        return fail_result("이미 존재하는 아이디입니다.")

    # 같은 포탈 아이디(email)로 이미 가입한 계정이 있으면 막는다.
    # 레거시 데이터에 중복이 131건 남아 있어 DB UNIQUE 제약 대신 여기서 검사한다.
    # 대소문자와 앞뒤 공백은 무시한다.
    #
    # 다만 상대가 아직 활성화를 안 한(sentinel) 계정이면 막지 않는다 — 그
    # 계정은 아이디를 잊어버린 본인일 수도 있는데, 막아 버리면 재가입도 못
    # 하고 재활성화도(아이디를 모르니) 못 해 막다른 길이 된다. 상대가 이미
    # 활성 계정이면 여전히 막는다(그건 진짜 중복 가입 시도다).
    if email and db.scalar(
        "SELECT COUNT(*) FROM `User` "
        "WHERE LOWER(TRIM(`email`)) = ? AND `password` NOT LIKE ?",
        (email.lower(), SENTINEL_LIKE),
    ):
        return fail_result("사용자 정보가 존재합니다.", 409, error_code="email_exists")

    # 학번은 식별자라 문자열로 저장한다. 숫자로 바꾸면 앞자리 0 이 사라진다.
    student_id = str(student_id).strip() if student_id not in (None, "") else None
    if student_id == "":
        student_id = None

    db.execute(
        "INSERT INTO `User` "
        "(`login_id`, `password`, `name`, `email`, `sub_email`, `student_id`, "
        " `mobile`, `role`, `created_at`, `college`, `major`) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'USER', ?, ?, ?)",
        (login_id, generate_password_hash(password), name, email, backup_email,
         student_id, phone, datetime.now(), college, major),
    )
    _email_codes.pop(portal, None)
    return ok_result()


# =============================================================================
# 액세스 토큰 재발급
# =============================================================================
# 로그인이 refresh_token 을 돌려주는데 쓸 곳이 없어서, 액세스 토큰이 만료되는
# 15분 뒤부터 관리자 동작이 전부 401 이 됐다. (명세에 없는 추가 엔드포인트)
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user = current_user()
    if user is None:
        return error_status("사용자를 찾을 수 없습니다.", 401, "user_not_found")

    claims = {
        "user_info": {
            "id": user["id"],
            "name": user["name"],
            "role": user["role"],
        }
    }
    return ok_status(
        "액세스 토큰을 재발급했습니다.",
        data={
            "access_token": create_access_token(
                identity=user["login_id"], additional_claims=claims),
            "token_type": "Bearer",
        },
    )


# =============================================================================
# 로그아웃 / 토큰 검증
# =============================================================================
@auth_bp.route("/logout", methods=["POST"])
def logout():
    # JWT 는 서버에 상태를 두지 않으므로 클라이언트가 토큰을 폐기하면 된다.
    # 서버 측 무효화가 필요하면 jti 블록리스트 테이블을 추가해야 한다.
    return ok_status("로그아웃 되었습니다.")


@auth_bp.route("/protected", methods=["GET"])
@jwt_required()
def protected():
    user = current_user()
    if user is None:
        return error_status("사용자를 찾을 수 없습니다.", 401, "user_not_found")
    return ok_status(
        "인증된 요청입니다",
        data={
            "id": user["id"],
            "user_id": user["login_id"],
            "username": user["name"],
            "role": role_label(user["role"]),
        },
    )


# =============================================================================
# 아이디 / 비밀번호 찾기
# =============================================================================
@auth_bp.route("/id_search", methods=["POST"])
def id_search():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    portal_id = (body.get("portalId") or "").strip()
    if not name or not portal_id:
        return error_status("이름과 포탈 아이디를 입력해 주세요.", 400)

    candidates = email_candidates(portal_id)
    marks = ", ".join(["?"] * len(candidates))
    row = db.query_one(
        "SELECT `login_id` FROM `User` "
        "WHERE `name` = ? AND (`email` IN (%s) OR `sub_email` IN (%s)) "
        "ORDER BY `id` LIMIT 1" % (marks, marks),
        [name] + candidates + candidates,
    )
    if row is None:
        return error_status("일치하는 회원 정보가 없습니다.", 404, "user_not_found")
    return ok_status("아이디 찾기 성공", data={"userId": row["login_id"]})


@auth_bp.route("/pw_search", methods=["POST"])
def pw_search():
    """이름 + 아이디 + 이메일 확인 후 임시 비밀번호를 메일로 보낸다."""
    return _reset_password()


def _reset_password():
    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or body.get("id") or "").strip()
    name = (body.get("name") or "").strip()
    # pw_search.js 는 포탈 아이디 칸을 portalId 로 보낸다("email" 이 아니다).
    email = (body.get("email") or body.get("portalId") or "").strip()

    candidates = email_candidates(email)
    if not login_id or not name or not candidates:
        return error_status("아이디, 이름, 포탈 아이디를 모두 입력해 주세요.", 400, "invalid_input")

    marks = ", ".join(["?"] * len(candidates))
    row = db.query_one(
        "SELECT `id`, `login_id`, `name`, `email`, `sub_email`, `password` FROM `User` "
        "WHERE `login_id` = ? AND `name` = ? "
        "AND (`email` IN (%s) OR `sub_email` IN (%s))" % (marks, marks),
        [login_id, name] + candidates + candidates,
    )
    if row is None:
        return error_status("일치하는 회원 정보가 없습니다.", 404, "user_not_found")

    # 이관된 뒤 아직 활성화를 안 한 계정이면 임시 비밀번호로 비번만 바꿔주지
    # 않는다 — 그러면 강화된 비밀번호 기준도, 바뀐 필수 정보 입력도 건너뛰고
    # 예전 기준 그대로 로그인하게 된다. 재활성화 절차로 보낸다.
    if _needs_reactivation(row["password"]):
        return error_status(
            "기존 회원 계정은 계정 활성화를 먼저 진행해 주세요.",
            400, "needs_reactivation",
        )

    # 포탈 아이디만 저장된 계정이 6,798명이라 도메인을 붙여 발송 주소를 만든다.
    #
    # 여기는 portal_email 이 아니라 legacy_email_address 를 쓴다. 회원가입은
    # 신규 계정 생성이라 도메인 강제가 필요하지만, 비밀번호 찾기는 이미
    # 존재하는 계정의 등록된 주소로 보내는 것이라 도메인을 검사할 이유가 없다.
    # 졸업생 가입 경로를 열게 되면 그들도 이 기능을 써야 한다.
    target_email = legacy_email_address(row["email"])
    if not target_email or "@" not in target_email:
        return error_status("메일을 보낼 수 있는 주소가 없습니다.", 400, "no_email")

    temporary = "".join(random.choices(string.ascii_letters + string.digits, k=10))

    # 메일을 먼저 보내고 성공했을 때만 비밀번호를 바꾼다.
    # 순서가 반대면 발송이 실패했을 때 사용자는 받은 적 없는 임시 비밀번호로
    # 바뀌어 로그인할 수 없게 된다.
    if not _send_mail(target_email, "[중앙대학교 서울캠퍼스 총학생회] 임시 비밀번호",
                      "임시 비밀번호: %s\n로그인 후 반드시 변경해 주세요." % temporary):
        return error_status(
            "메일을 보내지 못했습니다. 비밀번호는 그대로입니다. "
            "잠시 후 다시 시도하거나 총학생회로 문의해 주세요.", 502, "mail_failed")

    db.execute("UPDATE `User` SET `password` = ? WHERE `id` = ?",
               (generate_password_hash(temporary), row["id"]))
    # 프론트가 어디로 보냈는지 화면에 표시하므로 name/email 을 함께 준다.
    # (레거시 app.py 응답과 같은 형태)
    return ok_status(
        "임시 비밀번호를 메일로 보냈습니다.",
        data={"name": row["name"], "email": target_email},
    )


# =============================================================================
# 메일 인증
# =============================================================================
@auth_bp.route("/email_verify", methods=["POST"])
def email_verify():
    body = request.get_json(silent=True) or {}
    raw_email = (body.get("email") or "").strip()
    name = (body.get("name") or "").strip()
    if not raw_email:
        return error_status("이메일을 입력해 주세요.", 400)

    # 학교 도메인이 아니면 코드를 발송하지 않는다. 발송한 뒤 가입 단계에서
    # 막으면 외부 주소로 메일만 나가고 사용자는 이유를 모른 채 실패한다.
    email = portal_email(raw_email)
    if email is None:
        return error_status(PORTAL_EMAIL_ERROR, 400, "invalid_email_domain")

    code = _issue_code(email)
    if not _send_mail(email, "[중앙대학교 서울캠퍼스 총학생회] 이메일 인증 코드",
                      "%s님, 인증 코드는 %s 입니다. (%d분 내 입력)"
                      % (name or "회원", code, CODE_TTL_SECONDS // 60)):
        _email_codes.pop(email, None)
        return error_status(
            "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요. "
            "계속 실패하면 총학생회 채널로 문의해 주세요.", 502, "mail_failed")

    return ok_status("인증 코드가 이메일로 전송되었습니다.")


@auth_bp.route("/verify_code", methods=["POST"])
def verify_code():
    body = request.get_json(silent=True) or {}
    email = portal_email(body.get("email"))
    code = (body.get("code") or "").strip()

    if email is None:
        return error_status(PORTAL_EMAIL_ERROR, 400, "invalid_email_domain")

    record = _email_codes.get(email)
    if record is None:
        return error_status("인증 요청 내역이 없습니다.", 400, "code_not_found")
    if (datetime.now() - record["issued_at"]).total_seconds() > CODE_TTL_SECONDS:
        _email_codes.pop(email, None)
        return error_status("인증 코드가 만료되었습니다.", 400, "code_expired")
    if record["code"] != code:
        return error_status("인증 코드가 일치하지 않습니다.", 400, "code_mismatch")

    record["verified"] = True
    return ok_status("이메일 인증이 완료되었습니다")


def _send_mail(to_address, subject, body):
    """
    Flask-Mail 이 설정돼 있으면 발송하고, 없으면 로그만 남긴다.
    (로컬 개발에서 메일 설정 없이도 흐름을 확인할 수 있도록)

    발송 성공 여부를 돌려준다. SMTP 예외를 그대로 올리면 Flask 가 500 과
    스택트레이스를 내보내서, 화면에는 "서버 오류" 만 뜨고 원인을 알 수 없다.
    여기서 잡아 로그에 원인을 남기고 호출한 쪽이 안내 문구를 고르게 한다.
    """
    mail = current_app.extensions.get("mail")
    if mail is None:
        current_app.logger.info("[MAIL:skipped] to=%s subject=%s body=%s",
                                to_address, subject, body)
        return True

    from flask_mail import Message
    message = Message(subject=subject, recipients=[to_address], body=body)
    try:
        mail.send(message)
        return True
    except smtplib.SMTPAuthenticationError:
        # Gmail 은 2단계 인증 계정의 "앱 비밀번호"(16자) 만 받는다.
        # 일반 계정 비밀번호를 넣으면 여기로 떨어진다.
        current_app.logger.error(
            "[MAIL:auth-failed] SMTP 로그인 거부. MAIL_PASSWORD 가 앱 비밀번호(16자)인지 "
            "확인하세요. 계정=%s", current_app.config.get("MAIL_USERNAME"))
        return False
    except (smtplib.SMTPException, OSError) as exc:
        current_app.logger.error("[MAIL:failed] to=%s error=%s", to_address, exc)
        return False
