# -*- coding: utf-8 -*-
"""
api_v2/routes/admin.py
======================
명세: 섹션 이미지 교체 / 고정 페이지 텍스트 콘텐츠 편집

  POST   /api/admin/image                     (레거시: 대표 이미지 1장 교체)
  POST   /api/admin/section/<section>         이미지 추가 (여러 장 가능)
  DELETE /api/admin/section/<section>/<name>  이미지 삭제
  PUT    /api/admin/content/<key>             고정 페이지 텍스트/링크 저장

승인 대기 회원 목록(/members)과 회원 승인(/certify)은 신규 ERD 에서
User.is_approved 가 빠지면서 함께 제거했다. 가입 즉시 로그인할 수 있다.
섹션 이미지는 레거시와 동일하게 파일로 관리한다 (DB 에 저장하지 않음).

한 섹션에 여러 장을 둘 수 있다. 파일명은 `<섹션>-<번호>.<확장자>` 이고
번호 순서가 곧 화면에 나오는 순서다. 레거시의 `<섹션>.jpg` 한 장도
목록의 맨 앞에 함께 잡힌다 (예전에 올린 이미지가 사라지지 않도록).

고정 페이지의 텍스트/링크(대여 안내처럼 화면에 직접 짜 넣던 문구)도 같은
이유로 DB 대신 JSON 파일 하나로 관리한다. 아래 "고정 페이지 텍스트 콘텐츠"
부분 참고.
"""

import json
import os
import re
import time

from flask import Blueprint, request

from api_v2 import db
from api_v2.helpers import (
    admin_only, admin_required, fail_result, ok_result, ROLE_ADMIN, ROLE_MANAGER, ROLE_USER,
)

admin_bp = Blueprint("v2_admin", __name__, url_prefix="/api/admin")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMAGE_FOLDER = os.environ.get(
    "SECTION_IMAGE_DIR",
    os.path.join(BASE_DIR, "..", "frontend", "src", "assets", "images", "02_intro_images"),
)

# 섹션 키 -> 파일명.
# 키는 프론트(pages/02_introduction/*.js)가 formData 에 담아 보내는 값과 같아야 한다.
IMAGE_FILENAMES = {
    "president_greetings": "president_greetings.jpg",
    "executive_committee": "executive_committee.jpg",
    "sub_committee": "sub_committee.jpg",
    "organization_chart": "organization_chart.jpg",
    "location": "location.jpg",
}

ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "webp"}


def section_images(section):
    """
    한 섹션의 이미지 파일명 목록. 화면에 나올 순서대로 돌려준다.

    - 레거시 대표 파일(`<섹션>.jpg`)이 있으면 맨 앞
    - 그다음 `<섹션>-<번호>.<확장자>` 를 번호순으로
    """
    if section not in IMAGE_FILENAMES:
        return []
    try:
        entries = os.listdir(IMAGE_FOLDER)
    except OSError:
        return []

    legacy = IMAGE_FILENAMES[section]
    numbered = []
    for name in entries:
        matched = re.fullmatch(re.escape(section) + r"-(\d+)\.([A-Za-z0-9]+)", name)
        if matched and matched.group(2).lower() in ALLOWED_IMAGE_EXT:
            numbered.append((int(matched.group(1)), name))
    numbered.sort()

    ordered = []
    if legacy in entries:
        ordered.append(legacy)
    ordered.extend(name for _, name in numbered)
    return ordered


def _next_index(section):
    """다음에 붙일 번호. 중간을 지워도 뒤 번호와 겹치지 않게 최대값 + 1 을 쓴다."""
    highest = 0
    for name in section_images(section):
        matched = re.fullmatch(re.escape(section) + r"-(\d+)\..+", name)
        if matched:
            highest = max(highest, int(matched.group(1)))
    return highest + 1


# =============================================================================
# 섹션 이미지 교체
# =============================================================================
@admin_bp.route("/image", methods=["POST"])
@admin_only
def update_section_image():
    section = request.form.get("section")
    if section not in IMAGE_FILENAMES:
        return fail_result("알 수 없는 섹션입니다: %s" % section)

    image = request.files.get("image")
    if image is None or not image.filename:
        return fail_result("이미지 파일이 없습니다.")

    extension = image.filename.rsplit(".", 1)[-1].lower() if "." in image.filename else ""
    if extension not in ALLOWED_IMAGE_EXT:
        return fail_result("허용되지 않는 이미지 형식입니다: %s" % extension)

    target = os.path.join(IMAGE_FOLDER, IMAGE_FILENAMES[section])
    try:
        os.makedirs(IMAGE_FOLDER, exist_ok=True)
        image.save(target)
    except OSError as exc:
        return fail_result("이미지 저장에 실패했습니다: %s" % exc, 500)

    return ok_result(message="이미지가 성공적으로 업데이트되었습니다.")


# =============================================================================
# 섹션 이미지 여러 장 관리
# =============================================================================
@admin_bp.route("/section/<section>", methods=["POST"])
@admin_only
def add_section_images(section):
    """이미지를 추가한다. 한 번에 여러 개를 보내도 된다 (image / image[] / images)."""
    if section not in IMAGE_FILENAMES:
        return fail_result("알 수 없는 섹션입니다: %s" % section)

    incoming = []
    for key in ("image", "image[]", "images", "images[]", "file"):
        incoming.extend([f for f in request.files.getlist(key) if f and f.filename])
    if not incoming:
        return fail_result("이미지 파일이 없습니다.")

    try:
        os.makedirs(IMAGE_FOLDER, exist_ok=True)
    except OSError as exc:
        return fail_result("이미지 폴더를 만들지 못했습니다: %s" % exc, 500)

    index = _next_index(section)
    saved = []
    for item in incoming:
        extension = (item.filename.rsplit(".", 1)[-1].lower()
                     if "." in item.filename else "")
        if extension not in ALLOWED_IMAGE_EXT:
            return fail_result("허용되지 않는 이미지 형식입니다: %s" % extension)

        name = "%s-%d.%s" % (section, index, extension)
        try:
            item.save(os.path.join(IMAGE_FOLDER, name))
        except OSError as exc:
            return fail_result("이미지 저장에 실패했습니다: %s" % exc, 500)
        saved.append(name)
        index += 1

    return ok_result(message="이미지를 추가했습니다.", images=section_images(section),
                     added=saved)


@admin_bp.route("/section/<section>/<name>", methods=["DELETE"])
@admin_only
def delete_section_image(section, name):
    """이미지 한 장을 지운다. 그 섹션의 파일만 지울 수 있다."""
    if section not in IMAGE_FILENAMES:
        return fail_result("알 수 없는 섹션입니다: %s" % section)
    # 경로 조작 방지: 목록에 있는 이름만 받는다
    if name not in section_images(section):
        return fail_result("이미지를 찾을 수 없습니다.", 404)

    try:
        os.remove(os.path.join(IMAGE_FOLDER, name))
    except OSError as exc:
        return fail_result("이미지를 지우지 못했습니다: %s" % exc, 500)

    return ok_result(message="이미지를 지웠습니다.", images=section_images(section))


# =============================================================================
# 고정 페이지 텍스트 콘텐츠
# =============================================================================
#
# "대여" 안내처럼 게시판이 아니라 화면에 직접 짜 넣은 문구/링크를 관리자가
# 고칠 수 있게 한다. 이미지 섹션과 같은 이유로 DB 테이블을 새로 만들지 않고
# 키(key)마다 JSON 파일 하나를 둔다: <CONTENT_DIR>/<key>.json
#
# 키 -> 기본값. 파일이 아직 없으면(관리자가 한 번도 고치지 않았으면) 이
# 기본값을 그대로 내려준다 — 지금 화면에 하드코딩돼 있는 문구와 같으므로
# 배포 직후에도 화면이 바뀌지 않는다.
CONTENT_DIR = os.environ.get(
    "CONTENT_DIR", os.path.join(BASE_DIR, "content"),
)

CONTENT_DEFAULTS = {
    "rental": {
        "panelTitle": "상시 대여",
        "blocks": [
            {
                "heading": "대여 물품",
                "body": "보조배터리, 충전기, 우산, 돗자리, 고무링, 키스킨, "
                        "불법 카메라 탐지 기기, 듀라테이블, 캐노피, 수레",
            },
            {
                "heading": "일부 운영기간",
                "body": "플로터 사용, 캐노피, 듀라테이블 대여만 가능\n"
                        "사용일 기준 최소 2일 전 카카오톡 채널 "
                        "'중앙대학교 서울캠퍼스 총학생회'를 통해 예약 후 대여 가능",
            },
            {
                "heading": "기타 안내사항",
                "body": "중간고사 및 기말고사 시험기간에는 상주사업 운영을 중단합니다.\n"
                        "정상 운영 기간에 관한 안내는 추후 다른 홍보물을 통해 안내될 예정입니다.\n"
                        "운영 시간: (평일) 11:00 ~ 18:00",
            },
        ],
        "cards": [
            {"title": "학위복/졸업소품", "to": "/info/rental/list"},
            {"title": "학술정보원\n사물함", "to": "/info/rental/list"},
        ],
    },
}

# 각 필드의 최대 길이 (너무 긴 값이 들어가 화면이 깨지는 걸 막는 정도의 느슨한 상한)
_CONTENT_MAX = {"panelTitle": 60, "heading": 60, "body": 2000, "title": 60, "to": 300}


def read_content(key):
    """key 의 저장된 콘텐츠. 파일이 없거나 읽지 못하면 기본값으로 돌아간다."""
    if key not in CONTENT_DEFAULTS:
        return None
    path = os.path.join(CONTENT_DIR, "%s.json" % key)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return CONTENT_DEFAULTS[key]


def _clean_text(value, max_len):
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text[:max_len]


def _is_safe_link(value):
    """
    카드 연결 링크로 허용하는 형태만 통과시킨다.
      - 사이트 안 경로: "/" 로 시작 (단 "//host/..." 는 프로토콜 상대 경로로
        실제로는 외부 주소이므로 제외)
      - 외부 주소: http:// 또는 https:// 로 시작
    그 밖(javascript:, data: 등)은 전부 막는다.
    """
    if not value:
        return False
    if value.startswith("//"):
        return False
    if value.startswith("/"):
        return True
    return bool(re.match(r"^https?://", value, re.IGNORECASE))


def _sanitize_rental(body):
    """rental 콘텐츠 모양 검사 + 다듬기. 모양이 안 맞으면 None."""
    if not isinstance(body, dict):
        return None

    panel_title = _clean_text(body.get("panelTitle"), _CONTENT_MAX["panelTitle"])
    if not panel_title:
        return None

    blocks = []
    for raw in body.get("blocks") or []:
        if not isinstance(raw, dict):
            return None
        heading = _clean_text(raw.get("heading"), _CONTENT_MAX["heading"])
        block_body = _clean_text(raw.get("body"), _CONTENT_MAX["body"])
        if not heading or block_body is None:
            return None
        blocks.append({"heading": heading, "body": block_body})
    if not blocks:
        return None

    cards = []
    for raw in body.get("cards") or []:
        if not isinstance(raw, dict):
            return None
        title = _clean_text(raw.get("title"), _CONTENT_MAX["title"])
        to = _clean_text(raw.get("to"), _CONTENT_MAX["to"])
        if not title or not _is_safe_link(to):
            return None
        cards.append({"title": title, "to": to})
    if not cards:
        return None

    return {"panelTitle": panel_title, "blocks": blocks, "cards": cards}


# 키 -> 검사 함수. 새 고정 페이지를 편집 가능하게 만들 때 여기 하나만 추가하면 된다.
_CONTENT_SANITIZERS = {"rental": _sanitize_rental}


@admin_bp.route("/content/<key>", methods=["PUT"])
@admin_only
def update_content(key):
    if key not in CONTENT_DEFAULTS:
        return fail_result("알 수 없는 콘텐츠입니다: %s" % key, 404)

    body = request.get_json(silent=True) or {}
    sanitizer = _CONTENT_SANITIZERS.get(key)
    data = sanitizer(body) if sanitizer else None
    if data is None:
        return fail_result("콘텐츠 형식이 올바르지 않습니다.")

    try:
        os.makedirs(CONTENT_DIR, exist_ok=True)
        path = os.path.join(CONTENT_DIR, "%s.json" % key)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
    except OSError as exc:
        return fail_result("콘텐츠 저장에 실패했습니다: %s" % exc, 500)

    return ok_result(message="저장했습니다.", data=data)


# =============================================================================
# 매니저 권한 부여
# =============================================================================
#
# 매니저(MANAGER)는 게시판 글 작성/캘린더 수정만 할 수 있고(@admin_required 로
# 걸린 엔드포인트), 섹션 이미지/고정 콘텐츠처럼 @admin_only 로 걸린 범위는
# 볼 수 없다. 그 역할을 부여/해제하는 화면도 그래서 ADMIN 전용이다.
# ADMIN 계정 자체는 이 화면에서 건드리지 않는다 (실수로 관리자를 내리는 사고 방지).
@admin_bp.route("/users", methods=["GET"])
@admin_only
def search_users():
    query = (request.args.get("query") or "").strip()
    role = (request.args.get("role") or "").strip().upper()

    if role:
        # 역할로 전체 목록을 본다 (현재 매니저 목록 표시용). 검색어는 쓰지 않는다.
        if role not in (ROLE_USER, ROLE_MANAGER, ROLE_ADMIN):
            return fail_result("role 값이 올바르지 않습니다.")
        rows = db.query_all(
            "SELECT `id`, `login_id`, `name`, `role` FROM `User` "
            "WHERE `role` = ? ORDER BY `login_id` LIMIT 200",
            (role,),
        )
    elif query:
        like = "%%%s%%" % query
        rows = db.query_all(
            "SELECT `id`, `login_id`, `name`, `role` FROM `User` "
            "WHERE `login_id` LIKE ? OR `name` LIKE ? "
            "ORDER BY `login_id` LIMIT 20",
            (like, like),
        )
    else:
        return fail_result("검색어를 입력해 주세요.")

    return ok_result(data=[
        {"id": r["id"], "loginId": r["login_id"], "name": r["name"], "role": r["role"]}
        for r in rows
    ])


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@admin_only
def update_user_role(user_id):
    body = request.get_json(silent=True) or {}
    role = (body.get("role") or "").strip().upper()
    if role not in (ROLE_USER, ROLE_MANAGER):
        return fail_result("role 은 USER 또는 MANAGER 여야 합니다.")

    row = db.query_one("SELECT `id`, `role` FROM `User` WHERE `id` = ?", (user_id,))
    if row is None:
        return fail_result("사용자를 찾을 수 없습니다.", 404)
    if row["role"] == ROLE_ADMIN:
        return fail_result("관리자 계정은 이 화면에서 변경할 수 없습니다.", 403)

    db.execute("UPDATE `User` SET `role` = ? WHERE `id` = ?", (role, user_id))
    return ok_result(message="권한을 변경했습니다.")


# =============================================================================
# 공휴일
# =============================================================================
#
# 캘린더 날짜 숫자를 토(파랑)/일(빨강)로 칠하는 것과 같은 급의 표시용 데이터라,
# 섹션 이미지/콘텐츠(ADMIN 전용)가 아니라 일정 수정과 같은 권한(admin_required,
# ADMIN/MANAGER 둘 다 허용)으로 관리한다. 이벤트와 달리 DB 테이블을 새로 만들
# 만큼 무겁지 않아 콘텐츠와 같은 방식으로 JSON 파일 하나에 둔다.
HOLIDAYS_FILE = os.path.join(CONTENT_DIR, "holidays.json")
HOLIDAY_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def read_holidays():
    """공휴일 목록. [{date, name}], 날짜순 정렬. 파일이 없으면 빈 목록."""
    try:
        with open(HOLIDAYS_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    if not isinstance(data, list):
        return []
    cleaned = [
        {"date": item["date"], "name": str(item.get("name") or "")[:60]}
        for item in data
        if isinstance(item, dict) and HOLIDAY_DATE_RE.match(str(item.get("date", "")))
    ]
    return sorted(cleaned, key=lambda item: item["date"])


def _write_holidays(holidays):
    os.makedirs(CONTENT_DIR, exist_ok=True)
    with open(HOLIDAYS_FILE, "w", encoding="utf-8") as fh:
        json.dump(holidays, fh, ensure_ascii=False, indent=2)


@admin_bp.route("/holidays", methods=["POST"])
@admin_required
def add_holiday():
    body = request.get_json(silent=True) or {}
    date = (body.get("date") or "").strip()
    name = (body.get("name") or "").strip()[:60]

    if not HOLIDAY_DATE_RE.match(date):
        return fail_result("날짜는 YYYY-MM-DD 형식이어야 합니다.")
    if not name:
        return fail_result("공휴일 이름을 입력해 주세요.")

    holidays = [h for h in read_holidays() if h["date"] != date]
    holidays.append({"date": date, "name": name})
    holidays.sort(key=lambda item: item["date"])
    _write_holidays(holidays)
    return ok_result(message="공휴일을 추가했습니다.", data=holidays)


@admin_bp.route("/holidays/<date>", methods=["DELETE"])
@admin_required
def delete_holiday(date):
    holidays = [h for h in read_holidays() if h["date"] != date]
    _write_holidays(holidays)
    return ok_result(message="공휴일을 지웠습니다.", data=holidays)
