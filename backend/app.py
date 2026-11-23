import os

from dotenv import load_dotenv

# 다른 import보다 먼저 .env를 읽어서, 이후 모듈들이 os.getenv를 호출할 때
# 이미 환경변수가 채워져 있도록 한다. .env가 없으면 아무 일도 하지 않으므로
# 아래의 기본값 fallback이 그대로 적용된다.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

import base64  # noqa: E402
import hmac  # noqa: E402
import mimetypes  # noqa: E402
import secrets  # noqa: E402
from contextlib import contextmanager  # noqa: E402
from datetime import date, datetime  # noqa: E402
from functools import wraps  # noqa: E402
from pathlib import Path  # noqa: E402
from urllib.parse import quote  # noqa: E402
from uuid import uuid4  # noqa: E402

from flask import Flask, jsonify, request, send_file  # noqa: E402
from flask_cors import CORS  # noqa: E402
from flask_jwt_extended import (  # noqa: E402
    JWTManager,
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
    verify_jwt_in_request,
)
from flask_mail import Mail, Message  # noqa: E402
from werkzeug.security import check_password_hash, generate_password_hash  # noqa: E402
from werkzeug.utils import secure_filename  # noqa: E402

import dbconn  # noqa: E402


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.getenv(
    "UPLOAD_DIR",
    os.path.join(BASE_DIR, "uploads", "avanboard_v3"),
)
IMAGE_FOLDER = os.getenv(
    "IMAGE_FOLDER",
    os.path.join(
        BASE_DIR,
        "..",
        "frontend",
        "src",
        "assets",
        "images",
        "02_intro_images",
    ),
)

os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY", "local-development-key-change-before-production"
)
app.config["MAX_CONTENT_LENGTH"] = int(
    os.getenv("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024))
)
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", "465"))
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_USE_TLS"] = os.getenv("MAIL_USE_TLS", "false").lower() == "true"
app.config["MAIL_USE_SSL"] = os.getenv("MAIL_USE_SSL", "true").lower() == "true"

CORS(app, resources={r"/api/*": {"origins": "*"}})
jwt = JWTManager(app)
mail = Mail(app)

REVOKED_TOKENS = set()
EMAIL_VERIFICATIONS = {}
MAX_ATTACHMENTS = 10
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
IMAGE_FILENAMES = {
    "president_greetings": "총학생회소개.png",
    "executive_committee": "중앙집행위원회.png",
    "sub_committee": "산하위원회.png",
    "location": "오시는길.png",
    "organization_chart": "조직도.png",
}


@jwt.token_in_blocklist_loader
def is_token_revoked(_jwt_header, jwt_payload):
    return jwt_payload["jti"] in REVOKED_TOKENS


@contextmanager
def database(dictionary=True):
    connection = dbconn.connect_to_db()
    cursor = connection.cursor(dictionary=dictionary)
    try:
        yield connection, cursor
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def json_body():
    return request.get_json(silent=True) or {}


def form_or_json_body():
    if request.form:
        return request.form
    return json_body()


def parse_boolean(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_positive_int(value, default=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def normalize_portal_email(value):
    value = (value or "").strip()
    if not value:
        return ""
    return value if "@" in value else f"{value}@cau.ac.kr"


def password_matches(stored_password, submitted_password):
    """저장된 해시로만 비밀번호를 검증한다.

    해시가 아닌 저장값(평문, 빈 값, 미이관 계정의 sentinel 등)은 무조건
    False다. 과거에는 평문 비교 폴백이 있었으나, 저장값이 그대로 로그인
    비밀번호가 되어 버리는 문제가 있어 제거했다. 비밀번호는 반드시
    generate_password_hash 로 기록해야 한다.
    """
    if not stored_password or not submitted_password:
        return False
    if stored_password.startswith(("scrypt:", "pbkdf2:")):
        return check_password_hash(stored_password, submitted_password)
    return False


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            claims = get_jwt()
            role = claims.get("role")
            if not role:
                legacy_user_info = claims.get("user_info", {})
                role = "admin" if legacy_user_info.get("intGubun") == 9 else "user"
            if role != "admin":
                return jsonify(
                    status="ERROR",
                    message="관리자 권한이 필요합니다.",
                    error_code="admin_required",
                ), 403
        except Exception as exc:
            return jsonify(
                status="ERROR",
                message="인증 실패",
                error_code="auth_failed",
                details=str(exc),
            ), 401
        return fn(*args, **kwargs)

    return wrapper


def get_board(cursor, board_name):
    cursor.execute(
        """
        SELECT id, menu_id, organization_id, name, is_event
        FROM `Board`
        WHERE name = %s
        """,
        (board_name,),
    )
    return cursor.fetchone()


def current_user(cursor):
    cursor.execute(
        """
        SELECT id, login_id, name, role, is_approved
        FROM `User`
        WHERE login_id = %s
        """,
        (get_jwt_identity(),),
    )
    return cursor.fetchone()


def remove_files(paths):
    for path in paths:
        try:
            Path(path).unlink(missing_ok=True)
        except OSError:
            app.logger.warning("Failed to remove attachment: %s", path)


def save_attachments(cursor, post_id, menu_id, files):
    files = [item for item in files if item and item.filename]
    if len(files) > MAX_ATTACHMENTS:
        raise ValueError("첨부파일은 최대 10개까지 등록 가능합니다.")

    saved_paths = []
    for sort_order, uploaded_file in enumerate(files):
        original_name = os.path.basename(uploaded_file.filename)
        safe_name = secure_filename(original_name)
        extension = Path(safe_name or original_name).suffix.lower()
        stored_name = f"{uuid4().hex}{extension}"
        file_path = os.path.join(UPLOAD_DIR, stored_name)
        uploaded_file.save(file_path)
        saved_paths.append(file_path)

        file_size = os.path.getsize(file_path)
        file_type = uploaded_file.mimetype or mimetypes.guess_type(original_name)[0]
        cursor.execute(
            """
            INSERT INTO `Attachment`
                (file_type, name, stored_name, file_size, sort_order, post_id, menu_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                file_type,
                original_name,
                stored_name,
                file_size,
                sort_order,
                post_id,
                menu_id,
            ),
        )
    return saved_paths


def validate_iso_date(value, field_name, required=False):
    if not value:
        if required:
            raise ValueError(f"{field_name} is required")
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must use YYYY-MM-DD format") from exc


def send_plain_email(subject, recipient, body):
    if not app.config.get("MAIL_USERNAME") or not app.config.get("MAIL_PASSWORD"):
        app.logger.error("MAIL_USERNAME and MAIL_PASSWORD must be configured")
        return False
    try:
        message = Message(
            subject,
            sender=app.config["MAIL_USERNAME"],
            recipients=[recipient],
            body=body,
        )
        mail.send(message)
        return True
    except Exception:
        app.logger.exception("Email delivery failed")
        return False


@app.route("/api/hello", methods=["GET"])
def health_check():
    return "hello"


# ---------------------------------------------------------------------------
# Authentication and user profile
# ---------------------------------------------------------------------------


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = json_body()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify(
            status="ERROR",
            message="아이디와 비밀번호를 모두 입력해주세요.",
            error_code="invalid_input",
        ), 400

    try:
        with database() as (_connection, cursor):
            cursor.execute(
                """
                SELECT id, login_id, password, name, role, is_approved
                FROM `User`
                WHERE login_id = %s
                """,
                (username,),
            )
            user = cursor.fetchone()
    except Exception:
        app.logger.exception("Login query failed")
        return jsonify(
            status="ERROR",
            message="서버 오류가 발생했습니다.",
            error_code="server_error",
        ), 500

    if not user:
        return jsonify(
            status="ERROR",
            message="존재하지 않는 사용자입니다.",
            error_code="user_not_found",
        ), 401
    if not password_matches(user["password"], password):
        return jsonify(
            status="ERROR",
            message="아이디 또는 비밀번호가 일치하지 않습니다.",
            error_code="invalid_credentials",
        ), 401
    if not user["is_approved"]:
        return jsonify(
            status="ERROR",
            message="관리자 승인이 필요합니다.",
            error_code="certify_required",
        ), 403

    role = user["role"] if user["role"] in {"admin", "user"} else "user"
    claims = {
        "role": role,
        "user_info": {
            "intSeq": user["id"],
            "strName": user["name"],
            "intGubun": 9 if role == "admin" else 1,
        },
    }
    access_token = create_access_token(identity=user["login_id"], additional_claims=claims)
    refresh_token = create_refresh_token(identity=user["login_id"], additional_claims=claims)
    return jsonify(
        status="SUCCESS",
        message="로그인 성공",
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "user": {
                "id": user["id"],
                "user_id": user["login_id"],
                "username": user["name"],
                "role": role,
            },
        },
    ), 200


@app.route("/api/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh_access_token():
    claims = get_jwt()
    role = claims.get("role", "user")
    return jsonify(
        status="SUCCESS",
        data={
            "access_token": create_access_token(
                identity=get_jwt_identity(),
                additional_claims={"role": role, "user_info": claims.get("user_info", {})},
            ),
            "token_type": "Bearer",
        },
    ), 200


@app.route("/api/auth/logout", methods=["POST"])
@jwt_required(verify_type=False)
def logout():
    REVOKED_TOKENS.add(get_jwt()["jti"])
    return jsonify(status="SUCCESS", message="로그아웃되었습니다."), 200


@app.route("/api/auth/register", methods=["POST"])
@app.route("/api/user/register", methods=["POST"])
def register():
    data = json_body()
    required_fields = ("name", "userId", "password", "email", "phone")
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        return jsonify(
            result="FAIL",
            message=f"필수 필드가 누락되었습니다: {', '.join(missing)}",
        ), 400

    login_id = str(data["userId"]).strip()
    email = str(data["email"]).strip()
    verification_email = normalize_portal_email(email)
    verification = EMAIL_VERIFICATIONS.get(verification_email)
    if not verification or not verification.get("verified"):
        return jsonify(result="FAIL", message="메일 인증이 안 됐습니다."), 400

    student_id = data.get("studentId")
    if student_id in (None, ""):
        student_id = None
    else:
        student_id = parse_positive_int(student_id)
        if student_id is None:
            return jsonify(result="FAIL", message="학번은 양의 정수여야 합니다."), 400

    try:
        with database() as (connection, cursor):
            cursor.execute("SELECT id FROM `User` WHERE login_id = %s", (login_id,))
            if cursor.fetchone():
                return jsonify(result="FAIL", message="이미 존재하는 아이디입니다."), 409
            if student_id is not None:
                cursor.execute("SELECT id FROM `User` WHERE student_id = %s", (student_id,))
                if cursor.fetchone():
                    return jsonify(result="FAIL", message="이미 등록된 학번입니다."), 409

            cursor.execute(
                """
                INSERT INTO `User` (
                    login_id, password, name, email, sub_email, student_id,
                    mobile, role, is_approved, college, major,
                    zip_code, address1, address2
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'user', FALSE, %s, %s, %s, %s, %s)
                """,
                (
                    login_id,
                    generate_password_hash(str(data["password"])),
                    str(data["name"]).strip(),
                    email,
                    data.get("backupEmail") or None,
                    student_id,
                    str(data["phone"]).strip(),
                    data.get("college") or None,
                    data.get("major") or None,
                    data.get("zipCode") or None,
                    data.get("address1") or None,
                    data.get("address2") or None,
                ),
            )
            connection.commit()
        EMAIL_VERIFICATIONS.pop(verification_email, None)
        return jsonify(result="SUCCESS"), 201
    except Exception:
        app.logger.exception("Registration failed")
        return jsonify(result="FAIL", message="서버 오류"), 500


@app.route("/api/auth/protected", methods=["GET"])
@jwt_required()
def protected():
    try:
        with database() as (_connection, cursor):
            user = current_user(cursor)
        if not user:
            return jsonify(
                status="ERROR",
                message="사용자 정보를 찾을 수 없습니다.",
                error_code="user_not_found",
            ), 404
        return jsonify(
            status="SUCCESS",
            message="인증된 요청입니다",
            data={
                "id": user["id"],
                "user_id": user["login_id"],
                "username": user["name"],
                "role": user["role"],
            },
        ), 200
    except Exception:
        app.logger.exception("Token verification failed")
        return jsonify(
            status="ERROR",
            message="인증에 실패했습니다. 다시 로그인해주세요.",
            error_code="authentication_failed",
        ), 401


@app.route("/api/user/profile", methods=["GET"])
@jwt_required()
def get_user_profile():
    try:
        with database() as (_connection, cursor):
            cursor.execute(
                """
                SELECT id, login_id, name, zip_code, address1, address2,
                       mobile, email, sub_email, student_id, college, major
                FROM `User`
                WHERE login_id = %s
                """,
                (get_jwt_identity(),),
            )
            user = cursor.fetchone()
        if not user:
            return jsonify(
                result="ERROR",
                message="사용자 정보를 찾을 수 없습니다.",
                error_code="user_not_found",
            ), 404
        return jsonify(
            result="SUCCESS",
            message="사용자 정보 로드 성공",
            data={
                "id": user["id"],
                "userId": user["login_id"],
                "name": user["name"],
                "zipCode": user["zip_code"],
                "address1": user["address1"],
                "address2": user["address2"],
                "phone": user["mobile"],
                "email": user["email"],
                "backupEmail": user["sub_email"],
                "studentId": user["student_id"],
                "college": user["college"],
                "major": user["major"],
            },
        ), 200
    except Exception:
        app.logger.exception("Profile query failed")
        return jsonify(
            result="ERROR",
            message="서버 오류가 발생했습니다.",
            error_code="server_error",
        ), 500


@app.route("/api/user/profile", methods=["PUT"])
@app.route("/api/user/update", methods=["PUT"])
@jwt_required()
def update_user_profile():
    data = json_body()
    allowed_fields = {
        "password": "password",
        "zipCode": "zip_code",
        "address1": "address1",
        "address2": "address2",
        "phone": "mobile",
        "email": "email",
        "backupEmail": "sub_email",
        "college": "college",
        "major": "major",
    }
    updates = []
    values = []
    for api_field, column in allowed_fields.items():
        if api_field not in data:
            continue
        value = data[api_field]
        if api_field == "password":
            if not isinstance(value, str) or len(value) < 8:
                return jsonify(
                    result="ERROR",
                    message="비밀번호는 8자 이상이어야 합니다.",
                    error_code="invalid_password",
                ), 400
            value = generate_password_hash(value)
        updates.append(f"`{column}` = %s")
        values.append(value or None)

    if not updates:
        return jsonify(
            result="ERROR",
            message="수정할 필드가 없습니다.",
            error_code="no_fields_to_update",
        ), 400

    try:
        with database() as (connection, cursor):
            cursor.execute("SELECT id FROM `User` WHERE login_id = %s", (get_jwt_identity(),))
            if not cursor.fetchone():
                return jsonify(
                    result="ERROR",
                    message="사용자 정보를 찾을 수 없습니다.",
                    error_code="user_not_found",
                ), 404
            values.append(get_jwt_identity())
            cursor.execute(
                f"UPDATE `User` SET {', '.join(updates)} WHERE login_id = %s",
                tuple(values),
            )
            connection.commit()
        return jsonify(
            result="SUCCESS",
            message="사용자 정보가 성공적으로 업데이트되었습니다.",
        ), 200
    except Exception:
        app.logger.exception("Profile update failed")
        return jsonify(
            result="ERROR",
            message="서버 오류가 발생했습니다.",
            error_code="server_error",
        ), 500


@app.route("/api/auth/id_search", methods=["POST"])
def find_id():
    data = json_body()
    name = (data.get("name") or "").strip()
    portal_id = (data.get("portalId") or "").strip()
    if not name or not portal_id:
        return jsonify(
            status="ERROR",
            message="이름과 포탈아이디를 모두 입력해주세요.",
            error_code="invalid_input",
        ), 400
    full_email = normalize_portal_email(portal_id)
    try:
        with database() as (_connection, cursor):
            cursor.execute(
                """
                SELECT login_id FROM `User`
                WHERE name = %s AND email IN (%s, %s)
                """,
                (name, portal_id, full_email),
            )
            user = cursor.fetchone()
        if not user:
            return jsonify(
                status="ERROR",
                message=f"{name}님은 회원에 등록되어 있지 않습니다.",
                error_code="user_not_found",
            ), 404
        return jsonify(
            status="SUCCESS",
            message="아이디 찾기 성공",
            data={"userId": user["login_id"]},
        ), 200
    except Exception:
        app.logger.exception("ID search failed")
        return jsonify(
            status="ERROR",
            message="서버 오류가 발생했습니다.",
            error_code="server_error",
        ), 500


def reset_password(email_column, request_email, portal_email=False):
    data = json_body()
    user_id = (data.get("userId") or "").strip()
    name = (data.get("name") or "").strip()
    email = (data.get(request_email) or "").strip()
    if not user_id or not name or not email:
        return jsonify(
            status="ERROR",
            message="아이디, 이름과 이메일을 모두 입력해주세요.",
            error_code="invalid_input",
        ), 400

    candidates = [email]
    if portal_email:
        candidates.append(normalize_portal_email(email))
    try:
        with database() as (connection, cursor):
            placeholders = ", ".join(["%s"] * len(candidates))
            cursor.execute(
                f"""
                SELECT id, name, `{email_column}` AS target_email
                FROM `User`
                WHERE login_id = %s AND name = %s
                  AND `{email_column}` IN ({placeholders})
                """,
                (user_id, name, *candidates),
            )
            user = cursor.fetchone()
            if not user or not user["target_email"]:
                return jsonify(
                    status="ERROR",
                    message=f"{name}님의 입력하신 정보와 맞는 로그인정보가 없습니다.",
                    error_code="user_not_found",
                ), 404

            destination = (
                normalize_portal_email(user["target_email"])
                if portal_email
                else user["target_email"]
            )
            temporary_password = secrets.token_urlsafe(8)
            body = (
                f"안녕하세요 {name}님,\n\n"
                f"임시 비밀번호: {temporary_password}\n\n"
                "로그인 후 반드시 비밀번호를 변경해주세요."
            )
            if not send_plain_email(
                "중앙대학교 총학생회 임시 비밀번호 안내",
                destination,
                body,
            ):
                return jsonify(
                    status="ERROR",
                    message="이메일 발송에 실패했습니다.",
                    error_code="email_delivery_failed",
                ), 503
            cursor.execute(
                "UPDATE `User` SET password = %s WHERE id = %s",
                (generate_password_hash(temporary_password), user["id"]),
            )
            connection.commit()
        return jsonify(
            status="SUCCESS",
            message="비밀번호 찾기 성공",
            data={"name": user["name"], "email": destination},
        ), 200
    except Exception:
        app.logger.exception("Password reset failed")
        return jsonify(
            status="ERROR",
            message="서버 오류가 발생했습니다.",
            error_code="server_error",
        ), 500


@app.route("/api/auth/pw_search", methods=["POST"])
def find_password():
    return reset_password("email", "portalId", portal_email=True)


@app.route("/api/auth/pw_search_by_email", methods=["POST"])
def find_password_by_email():
    return reset_password("sub_email", "email")


@app.route("/api/auth/email_verify", methods=["POST"])
def send_verification_code():
    data = json_body()
    name = (data.get("name") or "").strip()
    email = normalize_portal_email(data.get("email"))
    if not name or not email:
        return jsonify(
            status="ERROR",
            message="이름과 이메일을 모두 입력해주세요.",
            error_code="invalid_input",
        ), 400

    verification_code = f"{secrets.randbelow(1_000_000):06d}"
    body = (
        f"안녕하세요 {name}님,\n\n"
        f"인증 코드: {verification_code}\n\n"
        "5분 이내에 입력해주세요."
    )
    if not send_plain_email(
        "중앙대학교 총학생회 이메일 인증 코드",
        email,
        body,
    ):
        return jsonify(
            status="ERROR",
            message="이메일 발송에 실패했습니다.",
            error_code="email_delivery_failed",
        ), 503

    EMAIL_VERIFICATIONS[email] = {
        "code": verification_code,
        "created_at": datetime.now(),
        "verified": False,
    }
    return jsonify(
        status="SUCCESS",
        message="인증 코드가 이메일로 전송되었습니다.",
    ), 200


@app.route("/api/auth/verify_code", methods=["POST"])
def verify_email_code():
    data = json_body()
    email = normalize_portal_email(data.get("email"))
    input_code = str(data.get("code") or "")
    record = EMAIL_VERIFICATIONS.get(email)
    if not record:
        return jsonify(status="ERROR", message="인증 요청이 없습니다"), 400
    if record["verified"]:
        return jsonify(status="ALREADY", message="이미 인증되었습니다"), 200
    if (datetime.now() - record["created_at"]).total_seconds() > 300:
        EMAIL_VERIFICATIONS.pop(email, None)
        return jsonify(status="EXPIRED", message="인증 코드가 만료되었습니다"), 400
    if not hmac.compare_digest(record["code"], input_code):
        return jsonify(status="INVALID", message="인증 코드가 일치하지 않습니다"), 400
    record["verified"] = True
    return jsonify(status="SUCCESS", message="이메일 인증이 완료되었습니다"), 200


# ---------------------------------------------------------------------------
# Administrator member management
# ---------------------------------------------------------------------------


@app.route("/api/admin/members", methods=["GET"])
@app.route("/api/admin/member", methods=["GET"])
@admin_required
def get_pending_members():
    offset = max(request.args.get("offset", default=0, type=int) or 0, 0)
    limit = min(max(request.args.get("limit", default=10, type=int) or 10, 1), 100)
    try:
        with database() as (_connection, cursor):
            cursor.execute("SELECT COUNT(*) AS total FROM `User` WHERE is_approved = FALSE")
            total_count = cursor.fetchone()["total"]
            cursor.execute(
                """
                SELECT login_id, name, created_at, is_approved
                FROM `User`
                WHERE is_approved = FALSE
                ORDER BY created_at DESC, id DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            rows = cursor.fetchall()
        members = [
            {
                "id": row["login_id"],
                "displayNumber": total_count - offset - index,
                "name": row["name"],
                "createdAt": row["created_at"].strftime("%Y-%m-%d"),
                "mailok": "Y",
                "certify": int(row["is_approved"]),
            }
            for index, row in enumerate(rows)
        ]
        return jsonify(result="SUCCESS", data=members, totalCount=total_count), 200
    except Exception:
        app.logger.exception("Pending member query failed")
        return jsonify(result="FAIL", message="서버 오류가 발생했습니다."), 500


@app.route("/api/admin/certify", methods=["POST"])
@admin_required
def approve_member():
    member_id = json_body().get("id")
    if member_id in (None, ""):
        return jsonify(result="FAIL", message="No id value"), 400
    try:
        with database() as (connection, cursor):
            cursor.execute(
                "SELECT id, is_approved FROM `User` WHERE login_id = %s OR id = %s",
                (str(member_id), parse_positive_int(member_id, 0)),
            )
            member = cursor.fetchone()
            if not member:
                return jsonify(result="FAIL", message="The user is not found"), 404
            cursor.execute(
                """
                UPDATE `User`
                SET is_approved = TRUE
                WHERE login_id = %s OR id = %s
                """,
                (str(member_id), parse_positive_int(member_id, 0)),
            )
            connection.commit()
        return jsonify(result="SUCCESS", message="Authorize Member successfully"), 200
    except Exception:
        app.logger.exception("Member approval failed")
        return jsonify(result="FAIL", message="Failed to Authorize Member"), 500


# ---------------------------------------------------------------------------
# Posts and attachments
# ---------------------------------------------------------------------------


@app.route("/api/posts", methods=["GET"])
@app.route("/api/dbtest", methods=["GET"])
def list_posts():
    board_name = (request.args.get("board") or "").strip()
    offset = max(request.args.get("offset", default=0, type=int) or 0, 0)
    limit = min(max(request.args.get("limit", default=10, type=int) or 10, 1), 100)
    search_type = (request.args.get("searchType") or "").strip()
    search_term = (request.args.get("searchTerm") or "").strip()
    search_columns = {"title": "p.title", "content": "p.content", "author": "u.name"}

    try:
        with database() as (_connection, cursor):
            board = get_board(cursor, board_name)
            if not board:
                return jsonify(result="FAIL", message="Invalid board type"), 400

            conditions = ["p.board_type = %s"]
            parameters = [board["id"]]
            if search_term:
                if search_type not in search_columns:
                    return jsonify(result="FAIL", message="Invalid search type"), 400
                conditions.append(f"{search_columns[search_type]} LIKE %s")
                parameters.append(f"%{search_term}%")
            where_clause = " AND ".join(conditions)

            cursor.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM `Post` p
                JOIN `User` u ON u.id = p.writer
                WHERE {where_clause}
                """,
                tuple(parameters),
            )
            total_count = cursor.fetchone()["total"]
            cursor.execute(
                f"""
                SELECT p.id, p.title, u.name AS author, p.created_at,
                       p.view_count, p.is_notice,
                       EXISTS(
                           SELECT 1 FROM `Attachment` a WHERE a.post_id = p.id
                       ) AS has_attachment
                FROM `Post` p
                JOIN `User` u ON u.id = p.writer
                WHERE {where_clause}
                ORDER BY p.is_notice DESC, p.created_at DESC, p.id DESC
                LIMIT %s OFFSET %s
                """,
                (*parameters, limit, offset),
            )
            rows = cursor.fetchall()

        posts = [
            {
                "id": row["id"],
                "displayNumber": total_count - offset - index,
                "title": row["title"],
                "author": row["author"],
                "createdAt": row["created_at"].strftime("%Y-%m-%d"),
                "views": row["view_count"],
                "isNotice": bool(row["is_notice"]),
                "hasAttachment": bool(row["has_attachment"]),
            }
            for index, row in enumerate(rows)
        ]
        return jsonify(result="SUCCESS", data=posts, totalCount=total_count), 200
    except Exception:
        app.logger.exception("Post list query failed")
        return jsonify(result="FAIL", message="서버 오류가 발생했습니다."), 500


@app.route("/api/posts/<int:post_id>", methods=["GET"])
@app.route("/api/detail_board", methods=["GET"])
def get_post(post_id=None):
    post_id = post_id or request.args.get("id", default=0, type=int)
    board_name = (request.args.get("board") or "").strip()
    if not post_id:
        return jsonify(result="FAIL", message="Invalid board ID"), 400

    try:
        with database() as (connection, cursor):
            conditions = ["p.id = %s"]
            parameters = [post_id]
            if board_name:
                conditions.append("b.name = %s")
                parameters.append(board_name)
            cursor.execute(
                f"""
                SELECT p.id, p.title, p.content, p.created_at, p.view_count,
                       u.name AS author
                FROM `Post` p
                JOIN `User` u ON u.id = p.writer
                JOIN `Board` b ON b.id = p.board_type
                WHERE {' AND '.join(conditions)}
                """,
                tuple(parameters),
            )
            post = cursor.fetchone()
            if not post:
                return jsonify(result="FAIL", message="게시글을 찾을 수 없습니다."), 404
            cursor.execute(
                """
                SELECT id, name, file_type, file_size
                FROM `Attachment`
                WHERE post_id = %s
                ORDER BY sort_order, id
                """,
                (post_id,),
            )
            attachment_rows = cursor.fetchall()
            cursor.execute(
                "UPDATE `Post` SET view_count = view_count + 1 WHERE id = %s",
                (post_id,),
            )
            connection.commit()

        attachment_names = [row["name"] for row in attachment_rows]
        return jsonify(
            result="SUCCESS",
            data={
                "title": post["title"],
                "author": post["author"],
                "content": post["content"],
                "createdAt": post["created_at"].strftime("%Y-%m-%d"),
                "views": post["view_count"],
                "attachments": attachment_names,
                "attachmentDetails": attachment_rows,
                "reply": [],
            },
            attachments=attachment_names,
        ), 200
    except Exception:
        app.logger.exception("Post detail query failed")
        return jsonify(result="FAIL", message="서버 오류가 발생했습니다."), 500


@app.route("/api/posts", methods=["POST"])
@app.route("/api/create_board", methods=["POST"])
@admin_required
def create_post():
    data = form_or_json_body()
    board_name = (data.get("board") or "").strip()
    title = (data.get("title") or "").strip()
    content = data.get("content") or ""
    if not board_name:
        return jsonify(result="FAIL", message="Invalid board type"), 400
    if not title:
        return jsonify(result="FAIL", message="Title is required"), 400

    saved_paths = []
    try:
        with database() as (connection, cursor):
            board = get_board(cursor, board_name)
            if not board:
                return jsonify(result="FAIL", message="Invalid board type"), 400
            user = current_user(cursor)
            if not user:
                return jsonify(result="FAIL", message="User not found"), 404

            cursor.execute(
                """
                INSERT INTO `Post`
                    (title, content, writer, board_type, menu_id, is_notice)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    title,
                    content,
                    user["id"],
                    board["id"],
                    board["menu_id"],
                    parse_boolean(data.get("isNotice")),
                ),
            )
            post_id = cursor.lastrowid
            saved_paths = save_attachments(
                cursor,
                post_id,
                board["menu_id"],
                request.files.getlist("file"),
            )

            if parse_boolean(data.get("isparticipate")):
                event_date = validate_iso_date(data.get("event_date"), "event_date", True)
                apply_date = validate_iso_date(data.get("form_date"), "form_date")
                end_date = validate_iso_date(data.get("end_date"), "end_date") or event_date
                cursor.execute(
                    """
                    INSERT INTO `Event` (
                        organization_id, post_id, is_visible, apply_date,
                        start_date, end_date, name, menu_id
                    ) VALUES (%s, %s, TRUE, %s, %s, %s, %s, %s)
                    """,
                    (
                        board["organization_id"],
                        post_id,
                        apply_date,
                        event_date,
                        end_date,
                        title,
                        board["menu_id"],
                    ),
                )
            connection.commit()
        return jsonify(
            result="SUCCESS",
            message="Board post created successfully",
            boardId=post_id,
        ), 201
    except ValueError as exc:
        remove_files(saved_paths)
        return jsonify(result="FAIL", message=str(exc)), 400
    except Exception:
        remove_files(saved_paths)
        app.logger.exception("Post creation failed")
        return jsonify(result="FAIL", message="서버 오류가 발생했습니다."), 500


@app.route("/api/posts/<int:post_id>", methods=["PUT"])
@app.route("/api/update_board", methods=["PUT"])
@admin_required
def update_post(post_id=None):
    data = form_or_json_body()
    post_id = post_id or parse_positive_int(data.get("id"))
    board_name = (data.get("board") or "").strip()
    title = (data.get("title") or "").strip()
    content = data.get("content") or ""
    if not post_id or not title:
        return jsonify(result="FAIL", message="Board ID and title are required"), 400

    new_paths = []
    old_paths = []
    try:
        with database() as (connection, cursor):
            board = get_board(cursor, board_name) if board_name else None
            if board_name and not board:
                return jsonify(result="FAIL", message="Invalid board type"), 400
            cursor.execute(
                """
                SELECT p.id, p.board_type, p.menu_id, b.organization_id
                FROM `Post` p
                JOIN `Board` b ON b.id = p.board_type
                WHERE p.id = %s
                """,
                (post_id,),
            )
            existing = cursor.fetchone()
            if not existing:
                return jsonify(result="FAIL", message="Board post not found"), 404
            board_id = board["id"] if board else existing["board_type"]
            menu_id = board["menu_id"] if board else existing["menu_id"]
            organization_id = (
                board["organization_id"] if board else existing["organization_id"]
            )
            notice_value = (
                parse_boolean(data.get("isNotice")) if "isNotice" in data else None
            )
            cursor.execute(
                """
                UPDATE `Post`
                SET title = %s, content = %s, board_type = %s, menu_id = %s,
                    is_notice = COALESCE(%s, is_notice)
                WHERE id = %s
                """,
                (
                    title,
                    content,
                    board_id,
                    menu_id,
                    notice_value,
                    post_id,
                ),
            )

            uploaded_files = request.files.getlist("file")
            if any(item and item.filename for item in uploaded_files):
                cursor.execute(
                    "SELECT stored_name FROM `Attachment` WHERE post_id = %s",
                    (post_id,),
                )
                old_paths = [
                    os.path.join(UPLOAD_DIR, row["stored_name"])
                    for row in cursor.fetchall()
                ]
                cursor.execute("DELETE FROM `Attachment` WHERE post_id = %s", (post_id,))
                new_paths = save_attachments(cursor, post_id, menu_id, uploaded_files)

            if "isparticipate" in data:
                if parse_boolean(data.get("isparticipate")):
                    event_date = validate_iso_date(data.get("event_date"), "event_date", True)
                    apply_date = validate_iso_date(data.get("form_date"), "form_date")
                    end_date = validate_iso_date(data.get("end_date"), "end_date") or event_date
                    cursor.execute("SELECT id FROM `Event` WHERE post_id = %s", (post_id,))
                    event = cursor.fetchone()
                    if event:
                        cursor.execute(
                            """
                            UPDATE `Event`
                            SET organization_id = %s, apply_date = %s,
                                start_date = %s, end_date = %s, name = %s,
                                menu_id = %s, is_visible = TRUE
                            WHERE id = %s
                            """,
                            (
                                organization_id,
                                apply_date,
                                event_date,
                                end_date,
                                title,
                                menu_id,
                                event["id"],
                            ),
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO `Event` (
                                organization_id, post_id, is_visible, apply_date,
                                start_date, end_date, name, menu_id
                            ) VALUES (%s, %s, TRUE, %s, %s, %s, %s, %s)
                            """,
                            (
                                organization_id,
                                post_id,
                                apply_date,
                                event_date,
                                end_date,
                                title,
                                menu_id,
                            ),
                        )
                else:
                    cursor.execute("DELETE FROM `Event` WHERE post_id = %s", (post_id,))
            connection.commit()
        remove_files(old_paths)
        return jsonify(
            result="SUCCESS",
            message="Board post updated with new attachments",
            boardId=post_id,
        ), 200
    except ValueError as exc:
        remove_files(new_paths)
        return jsonify(result="FAIL", message=str(exc)), 400
    except Exception:
        remove_files(new_paths)
        app.logger.exception("Post update failed")
        return jsonify(result="FAIL", message="서버 오류가 발생했습니다."), 500


@app.route("/api/posts/<int:post_id>", methods=["DELETE"])
@app.route("/api/delete_board", methods=["DELETE"])
@admin_required
def delete_post(post_id=None):
    post_id = post_id or request.args.get("id", default=0, type=int)
    board_name = (request.args.get("board") or "").strip()
    if not post_id:
        return jsonify(result="FAIL", message="Invalid board ID"), 400

    paths = []
    try:
        with database() as (connection, cursor):
            parameters = [post_id]
            board_condition = ""
            if board_name:
                board_condition = " AND b.name = %s"
                parameters.append(board_name)
            cursor.execute(
                f"""
                SELECT p.id
                FROM `Post` p
                JOIN `Board` b ON b.id = p.board_type
                WHERE p.id = %s{board_condition}
                """,
                tuple(parameters),
            )
            if not cursor.fetchone():
                return jsonify(result="FAIL", message="Board post not found"), 404
            cursor.execute(
                "SELECT stored_name FROM `Attachment` WHERE post_id = %s",
                (post_id,),
            )
            paths = [
                os.path.join(UPLOAD_DIR, row["stored_name"])
                for row in cursor.fetchall()
            ]
            cursor.execute("DELETE FROM `Post` WHERE id = %s", (post_id,))
            connection.commit()
        remove_files(paths)
        return jsonify(
            result="SUCCESS",
            message="Board post deleted successfully",
            boardId=post_id,
        ), 200
    except Exception:
        app.logger.exception("Post deletion failed")
        return jsonify(result="FAIL", message="서버 오류가 발생했습니다."), 500


@app.route("/api/files/download", methods=["POST"])
def download_attachment():
    data = json_body()
    encoded_name = data.get("fileName")
    if not encoded_name:
        return jsonify(error="File name is required"), 400
    try:
        file_name = base64.b64decode(encoded_name, validate=True).decode("utf-8")
    except Exception:
        file_name = data.get("originalName") or encoded_name
    file_name = os.path.basename(file_name)
    post_id = parse_positive_int(data.get("postId"))

    try:
        with database() as (_connection, cursor):
            conditions = ["name = %s"]
            parameters = [file_name]
            if post_id:
                conditions.append("post_id = %s")
                parameters.append(post_id)
            cursor.execute(
                f"""
                SELECT name, stored_name, file_type
                FROM `Attachment`
                WHERE {' AND '.join(conditions)}
                ORDER BY id DESC
                LIMIT 1
                """,
                tuple(parameters),
            )
            attachment = cursor.fetchone()
        if not attachment:
            return jsonify(error="File not found"), 404
        file_path = os.path.join(UPLOAD_DIR, attachment["stored_name"])
        if not os.path.isfile(file_path):
            return jsonify(error="File not found"), 404
        mime_type = attachment["file_type"] or "application/octet-stream"
        response = send_file(
            file_path,
            as_attachment=True,
            download_name=attachment["name"],
            mimetype=mime_type,
        )
        encoded_filename = quote(attachment["name"])
        response.headers["Content-Disposition"] = (
            f"attachment; filename=\"{encoded_filename}\"; "
            f"filename*=UTF-8''{encoded_filename}"
        )
        return response
    except Exception:
        app.logger.exception("Attachment download failed")
        return jsonify(error="Error downloading file"), 500


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


@app.route("/api/events", methods=["GET"])
def get_events():
    try:
        with database() as (_connection, cursor):
            cursor.execute(
                """
                SELECT id, start_date, name
                FROM `Event`
                WHERE is_visible = TRUE
                ORDER BY start_date, id
                """
            )
            rows = cursor.fetchall()
        return jsonify(
            status="SUCCESS",
            data=[
                {
                    "id": row["id"],
                    "event_date": row["start_date"].strftime("%Y-%m-%d"),
                    "content": row["name"],
                }
                for row in rows
            ],
        ), 200
    except Exception:
        app.logger.exception("Event list query failed")
        return jsonify(status="ERROR", message="서버 오류가 발생했습니다."), 500


@app.route("/api/events", methods=["POST"])
@admin_required
def add_event():
    data = json_body()
    content = (data.get("content") or "").strip()
    try:
        event_date = validate_iso_date(data.get("event_date"), "event_date", True)
        end_date = validate_iso_date(data.get("end_date"), "end_date") or event_date
        apply_date = validate_iso_date(data.get("apply_date"), "apply_date")
    except ValueError as exc:
        return jsonify(status="ERROR", message=str(exc)), 400
    if not content:
        return jsonify(status="ERROR", message="날짜와 내용이 필요합니다."), 400

    try:
        with database() as (connection, cursor):
            cursor.execute(
                """
                INSERT INTO `Event`
                    (is_visible, apply_date, start_date, end_date, name)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    parse_boolean(data.get("is_visible"), True),
                    apply_date,
                    event_date,
                    end_date,
                    content,
                ),
            )
            event_id = cursor.lastrowid
            connection.commit()
        return jsonify(status="SUCCESS", message="일정 추가됨", data={"id": event_id}), 201
    except Exception:
        app.logger.exception("Event creation failed")
        return jsonify(status="ERROR", message="서버 오류가 발생했습니다."), 500


@app.route("/api/events", methods=["DELETE"])
@admin_required
def delete_event():
    data = json_body()
    event_id = parse_positive_int(data.get("id"))
    content = (data.get("content") or "").strip()
    event_date = data.get("event_date")
    if not event_id and (not content or not event_date):
        return jsonify(
            status="ERROR",
            message="id 또는 event_date와 content가 필요합니다.",
        ), 400
    try:
        with database() as (connection, cursor):
            if event_id:
                cursor.execute("DELETE FROM `Event` WHERE id = %s", (event_id,))
            else:
                cursor.execute(
                    """
                    DELETE FROM `Event`
                    WHERE start_date = %s AND name = %s
                    ORDER BY id
                    LIMIT 1
                    """,
                    (event_date, content),
                )
            if cursor.rowcount == 0:
                return jsonify(status="ERROR", message="No matching event found"), 404
            connection.commit()
        return jsonify(status="SUCCESS", message="Event deleted"), 200
    except Exception:
        app.logger.exception("Event deletion failed")
        return jsonify(status="ERROR", message="서버 오류가 발생했습니다."), 500


# ---------------------------------------------------------------------------
# Introduction section images
# ---------------------------------------------------------------------------


def allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


@app.route("/api/get-section/<section>", methods=["GET"])
@app.route("/api/get-section-image/<section>", methods=["GET"])
def get_section_image(section):
    filename = IMAGE_FILENAMES.get(section)
    if not filename:
        return jsonify(result="ERROR", message="존재하지 않는 섹션입니다."), 404
    file_path = os.path.join(IMAGE_FOLDER, filename)
    if not os.path.isfile(file_path):
        return jsonify(result="ERROR", message="이미지 파일이 존재하지 않습니다."), 404
    return send_file(file_path, as_attachment=False)


@app.route("/api/admin/image", methods=["POST"])
@app.route("/api/update-section-image", methods=["POST"])
@admin_required
def update_section_image():
    uploaded_image = request.files.get("image")
    section = request.form.get("section")
    if not uploaded_image or not uploaded_image.filename:
        return jsonify(result="ERROR", message="이미지 파일이 누락되었습니다."), 400
    if section not in IMAGE_FILENAMES:
        return jsonify(result="ERROR", message="존재하지 않는 섹션입니다."), 404
    if not allowed_image(uploaded_image.filename):
        return jsonify(result="ERROR", message="허용되지 않는 파일 형식입니다."), 400
    os.makedirs(IMAGE_FOLDER, exist_ok=True)
    uploaded_image.save(os.path.join(IMAGE_FOLDER, IMAGE_FILENAMES[section]))
    return jsonify(result="SUCCESS", message="이미지가 성공적으로 업데이트되었습니다."), 200


if __name__ == "__main__":
    app.run(port=int(os.getenv("PORT", "5001")), debug=False)
