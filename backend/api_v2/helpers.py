# -*- coding: utf-8 -*-
"""
api_v2/helpers.py
=================
응답 포맷 / 인증 데코레이터 / 공통 조회 헬퍼.

명세서의 응답 형태가 엔드포인트마다 두 갈래다.
  - `result`: "SUCCESS" | "FAIL"   (게시글·회원 관련)
  - `status`: "SUCCESS" | "ERROR"  (로그인·일정·메일 관련)
원본 명세를 그대로 따르기 위해 두 형태를 모두 제공한다.
"""

import datetime
import re
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from api_v2 import db

ROLE_ADMIN = "ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_USER = "USER"


# =============================================================================
# 비밀번호 규칙
# =============================================================================
# 영문/숫자/특수문자를 모두 포함한 8~20자. 서비스 이용약관(policy.js)이 이미
# "영문자와 숫자, 특수문자의 조합"으로 비밀번호를 정의하고 있어, 실제 검증
# 규칙을 그 문구에 맞춘다. 회원가입과 계정 활성화(재설정)가 같은 규칙을
# 쓰도록 여기 한 곳에만 둔다.
PASSWORD_ALLOWED_SPECIAL = "!@#$%^&*()_+-="
PASSWORD_RE = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[%s])[A-Za-z\d%s]{8,20}$"
    % (re.escape(PASSWORD_ALLOWED_SPECIAL), re.escape(PASSWORD_ALLOWED_SPECIAL))
)
PASSWORD_RULE_MESSAGE = (
    "비밀번호는 영문, 숫자, 특수문자(%s)를 모두 포함해 8~20자로 입력해 주세요."
    % PASSWORD_ALLOWED_SPECIAL
)


def is_valid_password(password):
    return bool(password) and bool(PASSWORD_RE.match(password))


# =============================================================================
# 응답 헬퍼
# =============================================================================
def ok_result(**payload):
    body = {"result": "SUCCESS"}
    body.update(payload)
    return jsonify(body), 200


def fail_result(message, status_code=400, **payload):
    body = {"result": "FAIL", "message": message}
    body.update(payload)
    return jsonify(body), status_code


def ok_status(message=None, **payload):
    body = {"status": "SUCCESS"}
    if message:
        body["message"] = message
    body.update(payload)
    return jsonify(body), 200


def error_status(message, status_code=400, error_code=None, **payload):
    body = {"status": "ERROR", "message": message}
    if error_code:
        body["error_code"] = error_code
    body.update(payload)
    return jsonify(body), status_code


def fmt_date(value):
    """YYYY-MM-DD (명세의 createdAt / event_date 형식)."""
    if value is None:
        return None
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.strftime("%Y-%m-%d")
    return str(value)[:10]


def fmt_datetime(value):
    """YYYY-MM-DD HH:MM:SS (명세의 댓글 date 형식)."""
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, datetime.date):
        return value.strftime("%Y-%m-%d 00:00:00")
    return str(value)


def to_int(value, default=None):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


# =============================================================================
# 인증
# =============================================================================
def current_user():
    """JWT 의 login_id 로 현재 사용자 행을 읽는다. 없으면 None."""
    login_id = get_jwt_identity()
    if not login_id:
        return None
    return db.query_one(
        "SELECT `id`, `login_id`, `name`, `role` "
        "FROM `User` WHERE `login_id` = ?",
        (login_id,),
    )


def role_label(role):
    """명세의 data.user.role 은 admin / user 두 값만 쓴다."""
    return "admin" if role in (ROLE_ADMIN, ROLE_MANAGER) else "user"


def admin_required(fn):
    """게시판 작성/캘린더 수정 등 "관리자 업무" 엔드포인트. ADMIN/MANAGER 둘 다 통과한다."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return fail_result("사용자를 찾을 수 없습니다.", 401)
        if user["role"] not in (ROLE_ADMIN, ROLE_MANAGER):
            return fail_result("관리자 권한이 필요합니다.", 403)
        return fn(*args, **kwargs)
    return wrapper


def admin_only(fn):
    """ADMIN 전용 엔드포인트. 섹션 이미지/고정 콘텐츠/권한 관리처럼 MANAGER 에게는
    열어 주지 않는, 게시판·캘린더보다 넓은 범위의 작업에 쓴다."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return fail_result("사용자를 찾을 수 없습니다.", 401)
        if user["role"] != ROLE_ADMIN:
            return fail_result("관리자 권한이 필요합니다.", 403)
        return fn(*args, **kwargs)
    return wrapper


def jwt_user_required(fn):
    """로그인 사용자 전용 엔드포인트."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return fail_result("사용자를 찾을 수 없습니다.", 401)
        return fn(*args, **kwargs)
    return wrapper


def jwt_claims_role():
    """토큰 클레임에 실린 role (DB 조회 없이 쓰고 싶을 때)."""
    claims = get_jwt() or {}
    return (claims.get("user_info") or {}).get("role")


# =============================================================================
# 게시판 조회
# =============================================================================
# 명세서("게시글 작성")의 board 예시는 레거시 식별자(student-council 등)다.
# 마이그레이션은 국·위원회 단위 게시판을 주제 단위로 합쳤으므로 1:1 이 아니다.
# 아래 표는 CAU_MIGRATION/DEFINE.py 의 LEGACY_BOARD_MAP(레거시코드 -> 신규 게시판)과
# frontend/src/config/boards.js 의 LEGACY_PATH_MAP(구 URL -> 신 URL)이 일치하는 값이다.
# 신규 slug 가 정본이고, 레거시 값은 명세 호환을 위해서만 받아준다.
LEGACY_BOARD_SLUGS = {
    # 각 국·위원회 소식 -> 참여 행사 (board6/7/8/9/26/32/40~44 등)
    "student-council": "projects",
    "culture-committee": "projects",
    "welfare-committee": "projects",
    "human-rights-committee": "projects",
    "graduation-committee": "projects",
    "club-union": "projects",
    "promo-council": "projects",
    "edu-council": "projects",
    "strategy-council": "projects",
    "unity-council": "projects",
    "life-council": "projects",
    # 중앙운영위원회 회의록 -> 회의록 (board19)
    "central-committee": "minutes",
    # 자치활동보고는 이후 회의록에서 별도 게시판으로 분리됐다 (board15).
    "activity": "activity-report",
    # 회칙 및 세칙은 주체별 3개 게시판으로 나뉘었다 (CAU_MIGRATION rules-split 단계).
    # 프론트는 /autonomy/rules 한 페이지에서 탭으로 보여준다.
    "council-rules": "rules-council",      # board18 총학생회 회칙
    "department-rules": "rules-college",   # board17 단과대학 회칙
    "rules": "rules-council",              # 통합 시절 slug -> 첫 번째 탭
    # 공간조정회의 -> 대관 (board22)
    "space-adjustment": "venue",
    # 상주 사업 안내 -> 대여 (board3)
    "resident-business": "rental",
    # accounting(board20) / affiliate(board27) 는 레거시와 신규 slug 가 같다
}


def _board_by_slug(slug):
    return db.query_one(
        "SELECT b.`id`, b.`menu_id`, b.`slug`, b.`name`, b.`is_event`, "
        "       b.`organization_id`, m.`name` AS menu_name "
        "FROM `Board` b JOIN `Menu` m ON m.`id` = b.`menu_id` "
        "WHERE b.`slug` = ?",
        (slug,),
    )


def find_board(slug):
    """
    명세의 `board` 파라미터로 게시판을 찾는다.
    신규 slug 를 먼저 보고, 없으면 명세서의 레거시 식별자로 한 번 더 찾는다.
    """
    if not slug:
        return None
    slug = slug.strip()
    if not slug:
        return None

    board = _board_by_slug(slug)
    if board is None:
        mapped = LEGACY_BOARD_SLUGS.get(slug)
        if mapped:
            board = _board_by_slug(mapped)
    return board
