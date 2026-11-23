# -*- coding: utf-8 -*-
"""
api_v2/routes/events.py
=======================
명세: 일정 조회 / 추가 / 삭제

  GET    /api/events
  POST   /api/events   (관리자)
  DELETE /api/events   (관리자)

명세는 레거시 calendar_events 구조 그대로 (event_date, content) 를 주고받는다.
신규 Event 는 start_date / end_date 를 가지므로,
  - 조회: 기간 행사를 날짜별로 펼쳐서 (event_date, content) 목록으로 돌려준다
          -> 프론트 캘린더가 기존 형태 그대로 쓸 수 있다
  - 추가: start_date = end_date = event_date 로 하루짜리 Event 를 만든다
기간 정보를 그대로 쓰고 싶으면 ?expand=false 를 주면 원본 행이 나온다.
"""

import datetime

from flask import Blueprint, request

from api_v2 import db
from api_v2.helpers import (
    admin_required, error_status, fmt_date, ok_status, to_int,
)

events_bp = Blueprint("v2_events", __name__, url_prefix="/api/events")

# 기간 행사를 펼칠 때의 안전장치 (잘못된 데이터로 무한정 펼쳐지지 않도록)
MAX_EXPAND_DAYS = 366


@events_bp.route("", methods=["GET"])
def list_events():
    expand = (request.args.get("expand") or "true").lower() != "false"

    # 캘린더가 주관 기관별로 색을 달리하므로 기관 정보를 함께 내려준다.
    rows = db.query_all(
        "SELECT e.`id`, e.`name`, e.`start_date`, e.`end_date`, e.`apply_due`, "
        "       e.`is_visible`, e.`post_id`, e.`organization_id`, "
        "       o.`name` AS organization "
        "FROM `Event` e "
        "LEFT JOIN `Organization` o ON o.`id` = e.`organization_id` "
        "WHERE e.`is_visible` = 1 "
        "ORDER BY e.`start_date`, e.`id`"
    )

    if not expand:
        data = [
            {
                "id": r["id"],
                "content": r["name"],
                "startDate": fmt_date(r["start_date"]),
                "endDate": fmt_date(r["end_date"]),
                "applyDue": fmt_date(r["apply_due"]),
                "postId": r["post_id"],
                "organizationId": r["organization_id"],
                "organization": r["organization"],
            }
            for r in rows
        ]
        return ok_status(data=data)

    data = []
    one_day = datetime.timedelta(days=1)
    for row in rows:
        start = row["start_date"] or row["end_date"]
        if start is None:
            continue
        end = row["end_date"] or start
        if end < start:
            start, end = end, start
        if (end - start).days > MAX_EXPAND_DAYS:
            end = start + datetime.timedelta(days=MAX_EXPAND_DAYS)

        day = start
        while day <= end:
            data.append({
                "id": row["id"],
                "event_date": fmt_date(day),
                "content": row["name"],
                # 캘린더 색상 기준 (기관이 없으면 null -> 기본색)
                "organizationId": row["organization_id"],
                "organization": row["organization"],
            })
            day += one_day

    data.sort(key=lambda item: (item["event_date"], item["id"]))
    return ok_status(data=data)


@events_bp.route("", methods=["POST"])
@admin_required
def create_event():
    """
    일정 추가.

    명세는 (event_date, content) 만 받지만, 메인 화면의 관리자 편집이
    기간과 주관 기관까지 지정하므로 end_date / organization_id 를 선택으로 받는다.
    (둘 다 없으면 예전처럼 기관 없는 하루짜리 일정이 된다)
    """
    body = request.get_json(silent=True) or {}
    event_date = (body.get("event_date") or "").strip()
    content = (body.get("content") or "").strip()
    end_date = (body.get("end_date") or "").strip() or event_date
    organization_id = to_int(body.get("organization_id"))

    if not event_date or not content:
        return error_status("event_date 와 content 는 필수입니다.", 400)
    if _parse_date(event_date) is None:
        return error_status("event_date 형식이 올바르지 않습니다 (YYYY-MM-DD).", 400)
    if _parse_date(end_date) is None:
        return error_status("end_date 형식이 올바르지 않습니다 (YYYY-MM-DD).", 400)
    if _parse_date(end_date) < _parse_date(event_date):
        return error_status("end_date 는 event_date 보다 앞설 수 없습니다.", 400)

    _, event_id = db.execute(
        "INSERT INTO `Event` "
        "(`organization_id`, `post_id`, `menu_id`, `is_visible`, "
        " `apply_due`, `start_date`, `end_date`, `name`) "
        "VALUES (?, NULL, NULL, 1, NULL, ?, ?, ?)",
        (organization_id, event_date, end_date, content[:255]),
    )
    return ok_status("일정 추가됨", id=event_id)


@events_bp.route("/<int:event_id>", methods=["PUT"])
@admin_required
def update_event(event_id):
    """
    일정 수정.

    지우고 다시 만들면 게시글 연결(post_id)이나 신청 마감일(apply_due) 같은
    다른 값이 날아가므로, 화면에서 고치는 항목만 UPDATE 한다.
    body 에 없는 항목은 건드리지 않는다.
    """
    body = request.get_json(silent=True) or {}
    row = db.query_one("SELECT `id` FROM `Event` WHERE `id` = ?", (event_id,))
    if row is None:
        return error_status("수정할 일정을 찾을 수 없습니다.", 404)

    sets = []
    params = []

    if "content" in body:
        content = (body.get("content") or "").strip()
        if not content:
            return error_status("content 는 비울 수 없습니다.", 400)
        sets.append("`name` = ?")
        params.append(content[:255])

    if "event_date" in body:
        start_date = (body.get("event_date") or "").strip()
        if _parse_date(start_date) is None:
            return error_status("event_date 형식이 올바르지 않습니다 (YYYY-MM-DD).", 400)
        sets.append("`start_date` = ?")
        params.append(start_date)

    if "end_date" in body:
        end_date = (body.get("end_date") or "").strip()
        if _parse_date(end_date) is None:
            return error_status("end_date 형식이 올바르지 않습니다 (YYYY-MM-DD).", 400)
        sets.append("`end_date` = ?")
        params.append(end_date)

    if "organization_id" in body:
        sets.append("`organization_id` = ?")
        params.append(to_int(body.get("organization_id")))

    if not sets:
        return error_status("수정할 항목이 없습니다.", 400)

    db.execute(
        "UPDATE `Event` SET %s WHERE `id` = ?" % ", ".join(sets),
        params + [event_id],
    )
    return ok_status("일정 수정됨", id=event_id)


@events_bp.route("", methods=["DELETE"])
@admin_required
def delete_event():
    body = request.get_json(silent=True) or {}
    event_id = to_int(body.get("id") or request.args.get("id"))

    if event_id is not None:
        rowcount, _ = db.execute("DELETE FROM `Event` WHERE `id` = ?", (event_id,))
    else:
        # 명세 예시는 (event_date, content) 로 지운다.
        event_date = (body.get("event_date") or "").strip()
        content = (body.get("content") or "").strip()
        if not event_date or not content:
            return error_status("id 또는 (event_date, content) 가 필요합니다.", 400)
        # 기간 행사도 해당 날짜를 포함하면 지운다.
        rowcount, _ = db.execute(
            "DELETE FROM `Event` WHERE `name` = ? "
            "AND ? BETWEEN COALESCE(`start_date`, ?) AND COALESCE(`end_date`, `start_date`)",
            (content, event_date, event_date),
        )

    if not rowcount:
        return error_status("삭제할 일정을 찾을 수 없습니다.", 404)
    return ok_status("Event deleted")


def _parse_date(value):
    try:
        return datetime.datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None
