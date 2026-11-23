# -*- coding: utf-8 -*-
"""
api_v2/routes/reactivate.py
===========================
기존 회원 계정 재활성화 (한시적 기능).

레거시 DB 를 이관할 때 비밀번호를 옮기지 않아 기존 회원 6,827명 전원이
로그인 불가 상태다. password 에는 DEFINE.NOLOGIN_PASSWORD 표식이 들어 있다.
비밀번호 찾기도 쓸 수 없다. email 컬럼에 포탈 아이디만 저장된 계정이
6,777건이라 화면에서 무엇을 입력해야 하는지 알 수 없기 때문이다.

그래서 아이디만 입력하면 서버가 그 계정의 등록된 이메일을 찾아 인증 코드를
보내고, 인증 후 새 비밀번호와 누락 정보를 받는 경로를 따로 둔다.

이관 때 저장된 email 값은 검증된 적이 없어(실제 그 메일함에 접근 가능한지
아무도 확인하지 않았다), 1~2단계만으로는 "지금도 학교 구성원인지"를
증명하지 못한다. 그래서 완료 직전에 사용자가 직접 입력한 포탈 아이디로
@cau.ac.kr 메일함 접근을 한 번 더 증명하게 한다(2.5단계).

    POST /api/reactivate/request        아이디 입력 -> 코드 발송
    POST /api/reactivate/verify         코드 확인
    POST /api/reactivate/portal-request 포탈 아이디 입력 -> 확인 코드 발송
    POST /api/reactivate/portal-verify  포탈 확인 코드 확인
    POST /api/reactivate/complete       새 비밀번호 + 누락 정보 (포탈 인증 필수)

이 기능은 한시적이다. 끝나면 이 파일과 routes/__init__.py 의 등록 한 줄만
지우면 완전히 사라진다. 코드를 지우지 않고 막으려면 환경변수
REACTIVATION_ENABLED=false 로 두면 다섯 엔드포인트가 모두 404 를 반환한다.

회원가입과 섞지 않는 이유
-------------------------
회원가입의 email_verify / verify_code 를 재사용하지 않는다. 회원가입은
사용자가 이메일을 지정하지만 재활성화는 서버가 DB 에서 찾아 결정한다.
재사용하면 임의 주소로 인증 코드를 받을 수 있어 계정 탈취 경로가 열린다.

인증 코드 저장소도 auth.py 의 _email_codes 와 분리한다. 같은 딕셔너리를 쓰면
재활성화로 받은 코드가 register() 의 조회에 걸려 그 주소로 신규 가입이
가능해진다. 키를 이메일이 아니라 login_id 로 두어 구조적으로 교차를 막는다.

도메인 검증을 하지 않는 이유
----------------------------
발송 주소를 사용자가 지정하지 않고 서버가 DB 에서 읽어 결정하므로 임의
주소 수신이 불가능하다. 기존 회원 26명은 email 에 naver/gmail 등 외부
주소가 들어 있는데, portal_email() 로 도메인을 강제하면 이들이 영구히
계정을 되찾을 수 없게 된다.
"""

import os
import random
import re
import string
from datetime import datetime

from flask import Blueprint, current_app, request
from werkzeug.security import generate_password_hash

from api_v2 import db
from api_v2.helpers import error_status, is_valid_password, ok_status, PASSWORD_RULE_MESSAGE
from api_v2.routes.auth import PORTAL_DOMAIN, PORTAL_EMAIL_ERROR, _send_mail, portal_email

reactivate_bp = Blueprint("v2_reactivate", __name__, url_prefix="/api/reactivate")


# =============================================================================
# 설정
# =============================================================================

# 코드를 지우지 않고 기능만 끄고 싶을 때 false 로 둔다.
def _enabled():
    return os.environ.get("REACTIVATION_ENABLED", "true").strip().lower() not in (
        "0", "false", "no", "off",
    )


# 이메일이 비정상이라 코드를 보낼 수 없는 계정(운영 데이터 기준 2건)이
# 도달할 곳. 문의처가 없으면 그 사람들은 계정을 영영 되찾을 수 없다.
SUPPORT_CONTACT = os.environ.get("SUPPORT_CONTACT", "총학생회 (문의처 미설정)")

CODE_TTL_SECONDS = 60 * 10
MAX_CODE_ATTEMPTS = 5

# 같은 아이디로 연달아 코드를 요청하는 것을 막는 간격.
RESEND_INTERVAL_SECONDS = 60

# IP 당 시간당 발송 상한.
#
# 학교 네트워크는 NAT 로 여러 명이 같은 공인 IP 를 쓴다. 공지가 나간 직후
# 같은 건물에서 여러 학생이 동시에 시도하면 뒤에 온 사람이 막힌다. 그래서
# 상한을 넉넉히 잡는다. 한 사람이 악용하는 것을 막는 용도이지, 전체 발송량
# 통제는 아래 DAILY_SEND_LIMIT 이 담당한다.
IP_HOURLY_LIMIT = 30
IP_WINDOW_SECONDS = 60 * 60

# 하루 전체 발송 상한.
#
# Gmail 은 계정당 일일 발송 한도가 있다(일반 계정 약 500통). 한도를 넘기면
# 재활성화뿐 아니라 신규 가입 인증 메일까지 함께 막힌다. 재활성화 대상이
# 6,827명이라 어차피 여러 날에 걸쳐 진행되므로, 하루 상한을 두어 신규 가입
# 몫을 남긴다.
DAILY_SEND_LIMIT = int(os.environ.get("REACTIVATION_DAILY_LIMIT", "300"))

# 이관 계정 표식. CAU_MIGRATION/DEFINE.py 의 NOLOGIN_PASSWORD 와 짝을 이룬다.
SENTINEL_LIKE = "%$migrated$%"

# 요청 단계는 계정 존재 여부를 노출하지 않는다. 어떤 입력이든 같은 메시지다.
GENERIC_REQUEST_MESSAGE = (
    "등록된 이메일로 인증 코드를 보냈습니다. "
    "코드가 오지 않으면 %s 로 문의해 주세요." % SUPPORT_CONTACT
)


# =============================================================================
# 상태 (프로세스 메모리)
# =============================================================================
# auth.py 의 _email_codes 와 의도적으로 분리했다. 위 "회원가입과 섞지 않는
# 이유" 참고. gunicorn 워커가 1개라는 전제는 회원가입 인증과 동일하다.
_reactivation_codes = {}    # login_id -> {code, verified, issued_at, attempts, user_id}
_ip_requests = {}           # ip -> [datetime, ...]  실제 발송한 시각만 기록
_daily_sends = {"date": None, "count": 0}


def _daily_quota_exceeded():
    today = datetime.now().date()
    if _daily_sends["date"] != today:
        _daily_sends["date"] = today
        _daily_sends["count"] = 0
    return _daily_sends["count"] >= DAILY_SEND_LIMIT


def _record_send():
    _daily_sends["count"] += 1


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _ip_rate_exceeded(ip):
    """IP 당 시간당 발송 상한. 초과하면 True."""
    now = datetime.now()
    history = [
        stamp for stamp in _ip_requests.get(ip, [])
        if (now - stamp).total_seconds() < IP_WINDOW_SECONDS
    ]
    _ip_requests[ip] = history
    return len(history) >= IP_HOURLY_LIMIT


def _record_ip_request(ip):
    _ip_requests.setdefault(ip, []).append(datetime.now())


# =============================================================================
# 이메일 주소 결정
# =============================================================================
# 레거시 email 컬럼의 실제 분포 (운영 데이터 6,827건 기준)
#   6,777건 : 포탈 아이디만 (@ 없음)  -> @cau.ac.kr 을 붙인다
#      26건 : 전체 주소 (naver/gmail 등 외부 포함) -> 그대로 쓴다
#       2건 : 한글 등 비정상          -> 보낼 수 없다
# login_id 와 email 이 다른 계정이 886건이라, 반드시 email 컬럼을 기준으로
# 해야 한다. login_id + "@cau.ac.kr" 로 보내면 그 886명이 못 받는다.

_LOCAL_PART = re.compile(r"^[A-Za-z0-9._%+-]+$")
_FULL_ADDRESS = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def delivery_address(stored_email):
    """저장된 email 값으로 발송 주소를 만든다. 불가능하면 None."""
    value = (stored_email or "").strip()
    if not value:
        return None
    if "@" in value:
        return value if _FULL_ADDRESS.match(value) else None
    return "%s@%s" % (value, PORTAL_DOMAIN) if _LOCAL_PART.match(value) else None


def mask_address(address):
    """hongildong@cau.ac.kr -> ho********@cau.ac.kr"""
    local, _, domain = (address or "").partition("@")
    if not local:
        return ""
    keep = local[:2] if len(local) > 2 else local[:1]
    return "%s%s@%s" % (keep, "*" * max(len(local) - len(keep), 1), domain)


# =============================================================================
# 1단계 — 요청
# =============================================================================
@reactivate_bp.route("/request", methods=["POST"])
def request_code():
    """
    아이디를 받아 그 계정의 등록된 이메일로 인증 코드를 보낸다.

    없는 아이디 / 이미 활성화된 계정 / 이메일이 비정상인 계정 모두 성공과
    같은 응답을 준다. 응답이 갈리면 아이디를 바꿔가며 회원 명부를 캘 수 있다.
    실제 발송은 조건을 만족할 때만 한다.
    """
    if not _enabled():
        return error_status("사용할 수 없는 기능입니다.", 404, "not_found")

    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or body.get("login_id") or "").strip()
    if not login_id:
        return error_status("아이디를 입력해 주세요.", 400, "invalid_input")

    ip = _client_ip()
    if _ip_rate_exceeded(ip):
        current_app.logger.warning(
            "[REACTIVATE:rate_limited] ip=%s login_id=%s", ip, login_id)
        return error_status(
            "요청이 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.",
            429, "rate_limited",
        )

    previous = _reactivation_codes.get(login_id)
    if previous and (datetime.now() - previous["issued_at"]).total_seconds() < RESEND_INTERVAL_SECONDS:
        return error_status(
            "인증 코드를 방금 보냈습니다. 잠시 후 다시 시도해 주세요.",
            429, "resend_too_soon",
        )

    user = db.query_one(
        "SELECT `id`, `login_id`, `name`, `email`, `password` "
        "FROM `User` WHERE `login_id` = ?",
        (login_id,),
    )

    # 아래 분기는 전부 같은 응답으로 끝난다. 다른 것은 발송 여부뿐이다.
    address = None
    if user is not None and _is_sentinel(user["password"]):
        address = delivery_address(user["email"])
        if address is None:
            # 이메일이 비정상인 계정. 보낼 방법이 없으므로 로그만 남긴다.
            current_app.logger.warning(
                "[REACTIVATE:no_address] login_id=%s user_id=%s email=%r",
                login_id, user["id"], user["email"])

    if address is None:
        return ok_status(GENERIC_REQUEST_MESSAGE)

    if _daily_quota_exceeded():
        # 여기서 막지 않으면 Gmail 한도에 걸려 신규 가입 인증까지 죽는다.
        current_app.logger.warning(
            "[REACTIVATE:daily_limit] login_id=%s count=%s",
            login_id, _daily_sends["count"])
        return error_status(
            "오늘 처리 가능한 요청을 모두 사용했습니다. 내일 다시 시도해 주세요.",
            429, "daily_limit",
        )

    code = "".join(random.choices(string.digits, k=6))
    sent = _send_mail(
        address,
        "[중앙대학교 서울캠퍼스 총학생회] 계정 활성화 인증 코드",
        "%s님, 계정 활성화 인증 코드는 %s 입니다. (%d분 내 입력)"
        % (user["name"] or "회원", code, CODE_TTL_SECONDS // 60),
    )
    if not sent:
        # 쿨다운/일일 발송 횟수 기록과 코드 저장을 전부 발송 성공 뒤로 미뤘기
        # 때문에, 실패했을 때 "되돌리는" 동작이 따로 필요 없다 — 애초에
        # 아무것도 기록되지 않는다. 사용자는 바로 다시 요청할 수 있다.
        current_app.logger.error(
            "[REACTIVATE:mail_failed] login_id=%s user_id=%s", login_id, user["id"])
        return error_status(
            "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요. "
            "계속 실패하면 총학생회 채널로 문의해 주세요.", 502, "mail_failed")

    _reactivation_codes[login_id] = {
        "code": code,
        "verified": False,
        "issued_at": datetime.now(),
        "attempts": 0,
        "user_id": user["id"],
    }
    _record_ip_request(ip)
    _record_send()
    return ok_status(GENERIC_REQUEST_MESSAGE, maskedEmail=mask_address(address))


def _is_sentinel(password):
    """이관 후 비밀번호를 설정하지 않은 계정인지."""
    return bool(password) and "$migrated$" in password


# =============================================================================
# 2단계 — 코드 확인
# =============================================================================
@reactivate_bp.route("/verify", methods=["POST"])
def verify_code():
    if not _enabled():
        return error_status("사용할 수 없는 기능입니다.", 404, "not_found")

    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or body.get("login_id") or "").strip()
    code = (body.get("code") or "").strip()

    record = _reactivation_codes.get(login_id)
    if record is None:
        return error_status("인증 요청 내역이 없습니다.", 400, "code_not_found")
    if (datetime.now() - record["issued_at"]).total_seconds() > CODE_TTL_SECONDS:
        _reactivation_codes.pop(login_id, None)
        return error_status("인증 코드가 만료되었습니다.", 400, "code_expired")

    if record["code"] != code:
        record["attempts"] += 1
        if record["attempts"] >= MAX_CODE_ATTEMPTS:
            # 6자리 숫자라 시도 횟수를 열어두면 무차별 대입이 가능하다.
            _reactivation_codes.pop(login_id, None)
            current_app.logger.warning(
                "[REACTIVATE:too_many_attempts] login_id=%s ip=%s",
                login_id, _client_ip())
            return error_status(
                "인증 시도 횟수를 초과했습니다. 처음부터 다시 시도해 주세요.",
                429, "too_many_attempts",
            )
        return error_status("인증 코드가 일치하지 않습니다.", 400, "code_mismatch")

    record["verified"] = True

    # 인증을 통과했으므로 본인으로 보고 기존 값을 채워 보낸다.
    # 1단계에서 주면 아이디만 알아도 남의 전화번호를 볼 수 있게 된다.
    user = db.query_one(
        "SELECT `name`, `mobile` FROM `User` WHERE `id` = ?", (record["user_id"],))
    return ok_status(
        "인증이 완료되었습니다.",
        prefill={
            "name": (user or {}).get("name") or "",
            "mobile": (user or {}).get("mobile") or "",
        },
    )


# =============================================================================
# 2.5단계 — 포탈 아이디 추가 인증
# =============================================================================
# 이관 당시 email 컬럼에 들어간 값(포탈 아이디로 추정)은 검증된 적이 없다 —
# 실제로 그 메일함에 접근 가능한지 아무도 확인하지 않았다. 그래서 1~2단계
# (기존 저장값 기준 발송/확인)는 그대로 두고, 여기서 사용자가 "지금 직접
# 입력한" 포탈 아이디로 @cau.ac.kr 메일함 접근을 한 번 더 증명하게 한다.
#
# 이메일(1~2단계) 통과 시점부터 이 단계용 10분을 별도로 센다. 왕복이 하나
# 늘었는데 전체를 1단계 발송 시각 기준 10분 안에 끝내라고 하면 너무 빠듯하다.

# 운영 데이터 기준(2026-09, 읽기 전용 집계): 활성화 대상 6,822명 중 130명의
# 저장된 이메일 값이 다른 계정과 겹친다. 그 중 129명은 상대도 아직
# 미활성(이관) 계정이라 당장 충돌이 나지 않고, 실제 활성 계정과 겹치는
# 경우는 1건뿐이다. 겹치는 그룹(59개) 중 53개는 이름까지 같아 "동일인의
# 중복 계정"으로 보이고, 6개만 이름이 달라 다른 사람 간 우연한 겹침이다.
# 결론: 막다른 길이 되지 않도록, 겹치면 바로 회원가입으로 안내한다.


def _portal_duplicate(portal_local, exclude_user_id):
    """
    겹침 검사. 레거시 email 값은 'hong' 과 'hong@cau.ac.kr' 두 형태가 섞여
    있어(회원가입 register() 의 검사도 같은 이유로 둘 다 봐야 하는데, 거긴
    새로 가입하는 쪽이 항상 bare 라 놓치는 사례가 있다) 두 형태를 모두 본다.
    """
    bare = portal_local.lower()
    full = "%s@%s" % (bare, PORTAL_DOMAIN)
    return db.query_one(
        "SELECT `id` FROM `User` "
        "WHERE LOWER(TRIM(`email`)) IN (?, ?) AND `id` <> ?",
        (bare, full, exclude_user_id),
    )


PORTAL_DUPLICATE_MESSAGE = (
    "이미 다른 계정에 등록된 포탈 아이디입니다. "
    "새로 가입하시면 바로 이용하실 수 있습니다."
)


@reactivate_bp.route("/portal-request", methods=["POST"])
def portal_request():
    if not _enabled():
        return error_status("사용할 수 없는 기능입니다.", 404, "not_found")

    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or body.get("login_id") or "").strip()
    raw_portal_id = (body.get("portalId") or "").strip()

    record = _reactivation_codes.get(login_id)
    if record is None or not record.get("verified"):
        return error_status("이메일 인증을 먼저 완료해 주세요.", 400, "not_verified")

    # 이메일(1~2단계) 인증 자체가 오래됐는데 포탈 단계를 아직 시작도 안 했다면
    # 처음부터 다시 받게 한다. 포탈 단계가 이미 시작된 뒤로는 자체 TTL(아래)이
    # 대신 이 역할을 한다.
    if not record.get("portal_issued_at") and (
        datetime.now() - record["issued_at"]
    ).total_seconds() > CODE_TTL_SECONDS:
        _reactivation_codes.pop(login_id, None)
        return error_status(
            "인증이 만료되었습니다. 처음부터 다시 시도해 주세요.",
            400, "code_expired",
        )

    portal = portal_email(raw_portal_id)
    if portal is None:
        return error_status(PORTAL_EMAIL_ERROR, 400, "invalid_email_domain")
    portal_local = portal.split("@", 1)[0]

    previous_portal_at = record.get("portal_issued_at")
    if previous_portal_at and (
        datetime.now() - previous_portal_at
    ).total_seconds() < RESEND_INTERVAL_SECONDS:
        return error_status(
            "인증 코드를 방금 보냈습니다. 잠시 후 다시 시도해 주세요.",
            429, "resend_too_soon",
        )

    # 메일을 보내기 전에 미리 걸러 둔다(최종 확정은 complete() 에서 다시 본다 —
    # 그 사이 다른 요청이 같은 아이디를 먼저 가져갈 수도 있어서다).
    if _portal_duplicate(portal_local, record["user_id"]):
        return error_status(PORTAL_DUPLICATE_MESSAGE, 409, "email_exists")

    ip = _client_ip()
    if _ip_rate_exceeded(ip):
        current_app.logger.warning(
            "[REACTIVATE:portal_rate_limited] ip=%s login_id=%s", ip, login_id)
        return error_status(
            "요청이 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.",
            429, "rate_limited",
        )
    if _daily_quota_exceeded():
        current_app.logger.warning(
            "[REACTIVATE:portal_daily_limit] login_id=%s count=%s",
            login_id, _daily_sends["count"])
        return error_status(
            "오늘 처리 가능한 요청을 모두 사용했습니다. 내일 다시 시도해 주세요.",
            429, "daily_limit",
        )

    code = "".join(random.choices(string.digits, k=6))
    sent = _send_mail(
        portal,
        "[중앙대학교 서울캠퍼스 총학생회] 포탈 아이디 확인 코드",
        "포탈 아이디 확인 코드는 %s 입니다. (%d분 내 입력)"
        % (code, CODE_TTL_SECONDS // 60),
    )
    if not sent:
        # record 를 아직 건드리지 않았으므로 되돌릴 것도 없다 — 쿨다운도
        # 일일 발송 횟수도 그대로라 사용자는 바로 다시 요청할 수 있다.
        current_app.logger.error(
            "[REACTIVATE:portal_mail_failed] login_id=%s user_id=%s",
            login_id, record["user_id"])
        return error_status(
            "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요. "
            "계속 실패하면 총학생회 채널로 문의해 주세요.", 502, "mail_failed")

    record["portal_id"] = portal_local
    record["portal_code"] = code
    record["portal_issued_at"] = datetime.now()
    record["portal_verified"] = False
    record["portal_attempts"] = 0

    _record_ip_request(ip)
    _record_send()
    return ok_status(
        "포탈 아이디로 확인 코드를 보냈습니다.",
        maskedEmail=mask_address(portal),
    )


@reactivate_bp.route("/portal-verify", methods=["POST"])
def portal_verify():
    if not _enabled():
        return error_status("사용할 수 없는 기능입니다.", 404, "not_found")

    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or body.get("login_id") or "").strip()
    code = (body.get("code") or "").strip()

    record = _reactivation_codes.get(login_id)
    if record is None or not record.get("portal_code"):
        return error_status("포탈 인증 요청 내역이 없습니다.", 400, "portal_code_not_found")

    if (datetime.now() - record["portal_issued_at"]).total_seconds() > CODE_TTL_SECONDS:
        record.pop("portal_code", None)
        record.pop("portal_issued_at", None)
        record.pop("portal_id", None)
        record["portal_verified"] = False
        return error_status(
            "포탈 인증 코드가 만료되었습니다. 다시 요청해 주세요.",
            400, "portal_code_expired",
        )

    if record["portal_code"] != code:
        record["portal_attempts"] = record.get("portal_attempts", 0) + 1
        if record["portal_attempts"] >= MAX_CODE_ATTEMPTS:
            _reactivation_codes.pop(login_id, None)
            current_app.logger.warning(
                "[REACTIVATE:portal_too_many_attempts] login_id=%s ip=%s",
                login_id, _client_ip())
            return error_status(
                "인증 시도 횟수를 초과했습니다. 처음부터 다시 시도해 주세요.",
                429, "portal_too_many_attempts",
            )
        return error_status("포탈 인증 코드가 일치하지 않습니다.", 400, "portal_code_mismatch")

    record["portal_verified"] = True
    return ok_status("포탈 인증이 완료되었습니다.")


# =============================================================================
# 3단계 — 완료
# =============================================================================
STUDENT_ID_RE = re.compile(r"^\d{4,12}$")
MOBILE_RE = re.compile(r"^\d{2,3}-\d{3,4}-\d{4}$")


@reactivate_bp.route("/complete", methods=["POST"])
def complete():
    """
    새 비밀번호와 누락 정보를 저장한다.

    role 은 건드리지 않는다. 이관 계정에는 ADMIN 15명, MANAGER 23명이 섞여
    있어 덮어쓰면 권한이 날아간다.
    """
    if not _enabled():
        return error_status("사용할 수 없는 기능입니다.", 404, "not_found")

    body = request.get_json(silent=True) or {}
    login_id = (body.get("userId") or body.get("login_id") or "").strip()

    record = _reactivation_codes.get(login_id)
    if record is None or not record.get("verified"):
        return error_status("이메일 인증이 필요합니다.", 400, "not_verified")
    if not record.get("portal_verified"):
        return error_status("포탈 이메일 인증이 필요합니다.", 400, "portal_not_verified")
    # 포탈 인증을 통과한 뒤로는 그 발송 시각 기준 10분이 이 단계의 만료 기준이다
    # (이메일 1~2단계 자체의 유효기간은 portal-request 에서 이미 확인했다).
    if (datetime.now() - record["portal_issued_at"]).total_seconds() > CODE_TTL_SECONDS:
        _reactivation_codes.pop(login_id, None)
        return error_status("인증이 만료되었습니다. 처음부터 다시 시도해 주세요.",
                            400, "code_expired")

    password = body.get("password") or ""
    student_id = (body.get("studentId") or "").strip()
    college = (body.get("college") or "").strip()
    major = (body.get("major") or "").strip()
    mobile = (body.get("phone") or body.get("mobile") or "").strip()

    # 검증 규칙은 신규 가입(signup.js)과 같게 맞춘다.
    errors = {}
    if not is_valid_password(password):
        errors["password"] = PASSWORD_RULE_MESSAGE
    if not STUDENT_ID_RE.match(student_id):
        errors["studentId"] = "학번은 숫자 4~12자리여야 합니다."
    if not college:
        errors["college"] = "단과대를 선택해 주세요."
    if not major:
        errors["major"] = "학과를 선택해 주세요."
    if not MOBILE_RE.match(mobile):
        errors["phone"] = "연락처를 010-1234-5678 형식으로 입력해 주세요."
    if errors:
        return error_status("입력값을 확인해 주세요.", 400, "invalid_input",
                            errors=errors)

    # 학번 중복은 막지 않는다. 편입·재입학으로 학번이 바뀌기도 하고 오타도
    # 있는데, 여기서 막으면 그 계정은 영구히 사용 불가가 된다.
    # 대신 관리자가 나중에 정리할 수 있도록 기록만 남긴다.
    warning = None
    duplicate = db.query_one(
        "SELECT `id`, `login_id` FROM `User` "
        "WHERE `student_id` = ? AND `id` <> ? LIMIT 1",
        (student_id, record["user_id"]),
    )
    if duplicate:
        warning = "이미 등록된 학번입니다. 본인 학번이 맞다면 그대로 진행하세요."
        current_app.logger.warning(
            "[REACTIVATE:duplicate_student_id] login_id=%s student_id=%s "
            "existing_user_id=%s existing_login_id=%s",
            login_id, student_id, duplicate["id"], duplicate["login_id"])

    # portal-request 때 한 번 걸렀지만, 그 사이 다른 요청이 같은 포탈 아이디로
    # 먼저 활성화를 끝냈을 수 있어 저장 직전에 다시 확정한다.
    if _portal_duplicate(record["portal_id"], record["user_id"]):
        return error_status(PORTAL_DUPLICATE_MESSAGE, 409, "email_exists")

    # WHERE 에 sentinel 조건을 다시 넣는다. 인증과 저장 사이에 이미 활성화된
    # 계정을 덮어쓰지 않기 위한 안전장치다. email 은 이관 때 검증 없이 들어온
    # 값을 포탈 인증으로 실제 확인된 값으로 바꿔 끼운다.
    affected, _ = db.execute(
        "UPDATE `User` SET `password` = ?, `student_id` = ?, `college` = ?, "
        "       `major` = ?, `mobile` = ?, `email` = ? "
        "WHERE `id` = ? AND `password` LIKE ?",
        (generate_password_hash(password), student_id, college, major, mobile,
         record["portal_id"], record["user_id"], SENTINEL_LIKE),
    )
    if not affected:
        _reactivation_codes.pop(login_id, None)
        return error_status("이미 활성화된 계정입니다. 로그인해 주세요.",
                            409, "already_active")

    _reactivation_codes.pop(login_id, None)
    current_app.logger.info(
        "[REACTIVATE:done] login_id=%s user_id=%s", login_id, record["user_id"])

    # 토큰은 발급하지 않는다. 새 비밀번호로 직접 로그인하게 한다.
    return ok_status("계정이 활성화되었습니다. 새 비밀번호로 로그인해 주세요.",
                     warning=warning)
