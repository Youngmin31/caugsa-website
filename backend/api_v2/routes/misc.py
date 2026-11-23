# -*- coding: utf-8 -*-
"""
api_v2/routes/misc.py
=====================
명세: 헬스 체크 / 섹션 이미지 조회 / 고정 페이지 텍스트 콘텐츠 조회

  GET /api/hello
  GET /api/get-section/<section>
  GET /api/content/<key>

추가로 프론트가 메뉴·게시판 구조를 하드코딩하지 않아도 되도록
  GET /api/boards
를 제공한다. (신규 스키마는 Menu/Board 가 DB 에 있으므로 조회로 해결된다)
"""

import os

from flask import Blueprint, send_file

from api_v2 import db
from api_v2.helpers import fail_result, ok_result
from api_v2.routes.admin import (
    CONTENT_DEFAULTS, IMAGE_FILENAMES, IMAGE_FOLDER, read_content, read_holidays, section_images,
)

misc_bp = Blueprint("v2_misc", __name__, url_prefix="/api")


@misc_bp.route("/hello", methods=["GET"])
def hello():
    return "hello"


@misc_bp.route("/sections/<section>", methods=["GET"])
def list_section_images(section):
    """
    섹션에 올라간 이미지 목록. 화면에 나올 순서대로 URL 을 돌려준다.
    공개 페이지가 이 목록을 받아 전부 그린다.
    """
    if section not in IMAGE_FILENAMES:
        return fail_result("알 수 없는 섹션입니다: %s" % section, 404)
    names = section_images(section)
    return ok_result(
        images=[{"name": name, "url": "/api/sections/%s/%s" % (section, name)}
                for name in names])


@misc_bp.route("/sections/<section>/<name>", methods=["GET"])
def get_section_image_file(section, name):
    """목록에 있는 파일 한 장을 내려준다."""
    if section not in IMAGE_FILENAMES or name not in section_images(section):
        return fail_result("이미지를 찾을 수 없습니다.", 404)
    return send_file(os.path.join(IMAGE_FOLDER, name), as_attachment=False)


@misc_bp.route("/get-section/<section>", methods=["GET"])
def get_section_image(section):
    if section not in IMAGE_FILENAMES:
        return fail_result("알 수 없는 섹션입니다: %s" % section, 404)
    names = section_images(section)
    if not names:
        return fail_result("이미지를 찾을 수 없습니다.", 404)
    # 대표 이미지는 목록의 첫 장이다 (예전 URL 을 쓰는 화면과의 호환).
    return send_file(os.path.join(IMAGE_FOLDER, names[0]), as_attachment=False)


@misc_bp.route("/content/<key>", methods=["GET"])
def get_content(key):
    """
    고정 페이지의 텍스트/링크 콘텐츠. 관리자가 아직 한 번도 안 고쳤으면
    화면에 원래 있던 문구와 같은 기본값을 돌려준다 (admin.py 의 CONTENT_DEFAULTS).
    """
    if key not in CONTENT_DEFAULTS:
        return fail_result("알 수 없는 콘텐츠입니다: %s" % key, 404)
    return ok_result(data=read_content(key))


@misc_bp.route("/holidays", methods=["GET"])
def list_holidays():
    """공휴일 목록. 캘린더가 날짜 숫자를 빨간색으로 칠하는 데 쓴다."""
    return ok_result(data=read_holidays())


@misc_bp.route("/boards", methods=["GET"])
def list_boards():
    """메뉴 -> 게시판 트리. 프론트 네비게이션 구성을 DB 에서 가져간다."""
    rows = db.query_all(
        "SELECT m.`id` AS menu_id, m.`name` AS menu_name, "
        "       b.`id` AS board_id, b.`slug`, b.`name` AS board_name, b.`is_event`, "
        "       o.`name` AS organization, "
        "       (SELECT COUNT(*) FROM `Post` p WHERE p.`board_type` = b.`id`) AS post_count "
        "FROM `Menu` m "
        "LEFT JOIN `Board` b ON b.`menu_id` = m.`id` "
        "LEFT JOIN `Organization` o ON o.`id` = b.`organization_id` "
        "ORDER BY m.`id`, b.`id`"
    )

    menus = []
    index = {}
    for row in rows:
        menu = index.get(row["menu_id"])
        if menu is None:
            menu = {"id": row["menu_id"], "name": row["menu_name"], "boards": []}
            index[row["menu_id"]] = menu
            menus.append(menu)
        if row["board_id"] is None:
            continue
        menu["boards"].append({
            "id": row["board_id"],
            "slug": row["slug"],
            "name": row["board_name"],
            "isEvent": bool(row["is_event"]),
            "organization": row["organization"],
            "postCount": row["post_count"],
        })

    return ok_result(data=menus)
