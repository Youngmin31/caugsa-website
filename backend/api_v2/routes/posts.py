# -*- coding: utf-8 -*-
"""
api_v2/routes/posts.py
======================
명세: 게시글 목록 / 상세조회 / 작성 / 수정 / 삭제

  GET    /api/posts            ?board=&offset=&limit=&searchType=&searchTerm=
  GET    /api/posts/{id}       ?board=
  POST   /api/posts            (multipart/form-data, 관리자)
  PUT    /api/posts/{id}       (multipart/form-data, 관리자)
  DELETE /api/posts/{id}       ?board=  (관리자)

스키마 대응
-----------
  isNotice       -> Post.is_notice      (레거시 option_notice)
  비밀글          -> Post.is_secret      (레거시 option_bimil)
  hasAttachment  -> Attachment 존재 여부
  (댓글은 신규 ERD 에서 제외됨 - 레거시 Reply 는 미이관 JSON 으로만 보존)
  board          -> Board.slug

게시글 작성 명세의 isparticipate / event_date / form_date 는 Event 로 저장한다.
  isparticipate -> 참여행사 여부. 참이면 Event 행 생성
  event_date    -> Event.start_date / end_date
  form_date     -> Event.apply_due (신청 마감일)
"""

import os
import re

from flask import Blueprint, request
from flask_jwt_extended import verify_jwt_in_request
from werkzeug.utils import secure_filename

from api_v2 import db
from api_v2.helpers import (
    admin_required, current_user, fail_result, find_board,
    fmt_date, ok_result, to_int,
)
from api_v2.routes import files
from api_v2.settings import UPLOAD_DIR

posts_bp = Blueprint("v2_posts", __name__, url_prefix="/api/posts")

SEARCH_FIELDS = {
    "title": "p.`title`",
    "content": "p.`content`",
    "author": "u.`name`",
}

# 학생자치 메뉴의 게시판 중 회의록/자치활동보고/회계자료는 목록은 누구나
# 보이지만 글 상세는 로그인한 회원(가입이 @cau.ac.kr 로 제한되므로 학교
# 구성원)만 볼 수 있다. 회칙 및 세칙(3탭)은 비회원도 열람할 수 있다.
# frontend/src/config/boards.js 의 "autonomy" 메뉴 슬러그와 맞춰 둔다.
LOGIN_REQUIRED_BOARD_SLUGS = {
    "minutes", "activity-report", "accounting",
}

# 확장자 -> Attachment.file_type (CAU_MIGRATION/DEFINE.py 와 동일 규칙)
EXTENSION_TO_TYPE = {
    "jpg": "image", "jpeg": "image", "png": "image", "gif": "image",
    "bmp": "image", "webp": "image", "svg": "image", "heic": "image",
    "pdf": "pdf",
    "hwp": "document", "hwpx": "document", "doc": "document", "docx": "document",
    "txt": "document", "rtf": "document", "odt": "document",
    "xls": "spreadsheet", "xlsx": "spreadsheet", "csv": "spreadsheet",
    "ppt": "presentation", "pptx": "presentation",
    "zip": "archive", "rar": "archive", "7z": "archive",
    "mp4": "video", "mov": "video", "mp3": "audio",
}


def _file_type(filename):
    if not filename or "." not in filename:
        return "etc"
    return EXTENSION_TO_TYPE.get(filename.rsplit(".", 1)[-1].lower(), "etc")


# =============================================================================
# 게시글 목록
# =============================================================================
@posts_bp.route("", methods=["GET"])
def list_posts():
    board = find_board(request.args.get("board"))
    if board is None:
        return fail_result("Invalid board type")

    offset = max(to_int(request.args.get("offset"), 0) or 0, 0)
    limit = to_int(request.args.get("limit"), 10) or 10
    limit = min(max(limit, 1), 100)

    search_term = (request.args.get("searchTerm") or "").strip()

    where = ["p.`board_type` = ?"]
    params = [board["id"]]
    if search_term:
        # 제목/내용/작성자를 가리지 않고 통째로 검색한다
        where.append(
            "(%s)" % " OR ".join("%s LIKE ?" % field for field in SEARCH_FIELDS.values())
        )
        params.extend(["%%%s%%" % search_term] * len(SEARCH_FIELDS))
    where_sql = " AND ".join(where)

    total_count = db.scalar(
        "SELECT COUNT(*) FROM `Post` p LEFT JOIN `User` u ON u.`id` = p.`writer` "
        "WHERE %s" % where_sql,
        params,
    ) or 0

    rows = db.query_all(
        "SELECT p.`id`, p.`title`, p.`created_at`, p.`view_count`, "
        "       p.`is_notice`, p.`is_secret`, "
        "       COALESCE(u.`name`, '알 수 없음') AS author, "
        # 본문 삽입 이미지는 '첨부파일 있음' 표시 대상이 아니다.
        "       EXISTS(SELECT 1 FROM `Attachment` a WHERE a.`post_id` = p.`id` "
        "              AND a.`file_type` <> ?) AS has_file "
        "FROM `Post` p LEFT JOIN `User` u ON u.`id` = p.`writer` "
        "WHERE %s "
        # 공지는 항상 위로, 그다음 최신순 (명세의 isNotice 용도)
        "ORDER BY p.`is_notice` DESC, p.`created_at` DESC, p.`id` DESC "
        "LIMIT ? OFFSET ?" % where_sql,
        # SELECT 안의 ? 가 WHERE 보다 앞서므로 파라미터도 맨 앞에 온다.
        [files.INLINE_FILE_TYPE] + params + [limit, offset],
    )

    thumbnails = _thumbnails_for([row["id"] for row in rows])
    events = _events_for([row["id"] for row in rows])

    data = []
    for index, row in enumerate(rows):
        event = events.get(row["id"]) or {}
        data.append({
            "id": row["id"],
            # 화면 표시 번호: 전체 개수에서 역순으로 매긴다
            "displayNumber": total_count - offset - index,
            "title": row["title"],
            "author": row["author"],
            "createdAt": fmt_date(row["created_at"]),
            "views": row["view_count"],
            "isNotice": bool(row["is_notice"]),
            "isSecret": bool(row["is_secret"]),
            "hasAttachment": bool(row["has_file"]),
            # 카드/갤러리 목록의 썸네일. 이미지가 없으면 None.
            "thumbnailUrl": thumbnails.get(row["id"]),
            # 참여 행사 글이면 행사 기간과 신청 마감일. 아니면 전부 None.
            "startDate": event.get("startDate"),
            "endDate": event.get("endDate"),
            "applyDue": event.get("applyDue"),
            "eventName": event.get("eventName"),
        })

    return ok_result(data=data, totalCount=total_count)


# 썸네일로 쓸 수 있는 첨부 종류. inline-image 는 본문에 삽입된 이미지다.
THUMBNAIL_FILE_TYPES = ("inline-image", "image")


def _thumbnails_for(post_ids):
    """
    {post_id: 썸네일 URL} 을 한 번의 쿼리로 만든다.

    우선순위는 "본문에 삽입된 첫 번째 이미지" 이고, 본문 이미지가 없으면
    첨부된 이미지 파일 중 첫 번째를 쓴다. inline-image 의 sort_order 에는
    본문 등장 순서가 들어 있다 (_sync_inline_images 참고).
    """
    if not post_ids:
        return {}

    placeholders = ", ".join(["?"] * len(post_ids))
    rows = db.query_all(
        "SELECT `post_id`, `name`, `file_type`, `sort_order`, `id` "
        "FROM `Attachment` "
        "WHERE `post_id` IN (%s) AND `file_type` IN (?, ?) "
        # 본문 이미지가 첨부 이미지보다 앞선다
        "ORDER BY `post_id`, `file_type` = ? DESC, `sort_order`, `id`"
        % placeholders,
        list(post_ids) + list(THUMBNAIL_FILE_TYPES) + [files.INLINE_FILE_TYPE],
    )

    thumbnails = {}
    for row in rows:
        # ORDER BY 덕분에 각 게시글의 첫 행이 곧 대표 이미지다
        thumbnails.setdefault(row["post_id"], _attachment_url(row["name"]))
    return thumbnails


def _update_event_for_post(post_id, board, form):
    """
    글에 딸린 Event 의 날짜를 고친다. 아직 없으면 새로 만든다.
    (레거시로 이관된 행사 글에는 Event 가 없는 경우가 있다)

    날짜를 비워서 보내면 캘린더에 올리지 않겠다는 뜻이므로 Event 를 지운다.
    """
    start_date = (form.get("event_date") or "").strip() or None

    if start_date is None:
        db.execute("DELETE FROM `Event` WHERE `post_id` = ?", (post_id,), commit=False)
        return

    end_date = (form.get("end_date") or "").strip() or start_date
    form_date = (form.get("form_date") or "").strip() or None

    # 캘린더 이름은 event_name 으로 받는다. 칸을 비워서 보내면 글 제목으로 되돌린다.
    if "event_name" in form:
        event_name = (form.get("event_name") or "").strip() or (form.get("title") or "").strip()
    else:
        event_name = (form.get("title") or "").strip()

    row = db.query_one(
        "SELECT `id` FROM `Event` WHERE `post_id` = ? ORDER BY `id` LIMIT 1",
        (post_id,),
    )
    if row is None:
        if board is None:
            return
        db.execute(
            "INSERT INTO `Event` "
            "(`organization_id`, `post_id`, `menu_id`, `is_visible`, "
            " `apply_due`, `start_date`, `end_date`, `name`) "
            "VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
            (board["organization_id"], post_id, board["menu_id"],
             form_date, start_date, end_date, event_name[:255]),
            commit=False,
        )
        return

    columns = ["`start_date` = ?", "`end_date` = ?", "`apply_due` = ?"]
    values = [start_date, end_date, form_date]
    if event_name:
        columns.append("`name` = ?")
        values.append(event_name[:255])

    db.execute(
        "UPDATE `Event` SET %s WHERE `id` = ?" % ", ".join(columns),
        values + [row["id"]],
        commit=False,
    )


def _events_for(post_ids):
    """
    {post_id: {startDate, endDate, applyDue}} 를 한 번의 쿼리로 만든다.

    참여 행사 게시판의 글은 작성 시 Event 가 함께 생기고(_create_event_for_post),
    행사 기간과 신청 마감일이 거기 들어 있다. 메인 화면의 D-day 뱃지와
    "참여 신청 ~ 날짜" 표시가 이 값을 쓴다. 행사 글이 아니면 키가 아예 없다.
    """
    if not post_ids:
        return {}

    placeholders = ", ".join(["?"] * len(post_ids))
    rows = db.query_all(
        "SELECT `post_id`, `start_date`, `end_date`, `apply_due`, `name` "
        "FROM `Event` WHERE `post_id` IN (%s) "
        "ORDER BY `post_id`, `id`" % placeholders,
        list(post_ids),
    )

    events = {}
    for row in rows:
        # 한 글에 행사가 여러 개 붙어 있으면 먼저 만들어진 것을 대표로 본다
        events.setdefault(row["post_id"], {
            "startDate": fmt_date(row["start_date"]),
            "endDate": fmt_date(row["end_date"]),
            "applyDue": fmt_date(row["apply_due"]),
            # 캘린더에 뜨는 이름. 글 제목과 다를 수 있어 수정 화면이 이 값을 띄운다.
            "eventName": row["name"],
        })
    return events


def _attachment_url(name):
    from urllib.parse import quote
    return files.INLINE_URL_PREFIX + quote(name or "")


# =============================================================================
# 게시글 상세조회
# =============================================================================
@posts_bp.route("/<int:post_id>", methods=["GET"])
def get_post(post_id):
    board = find_board(request.args.get("board"))

    where = "p.`id` = ?"
    params = [post_id]
    if board is not None:
        where += " AND p.`board_type` = ?"
        params.append(board["id"])

    row = db.query_one(
        "SELECT p.`id`, p.`title`, p.`content`, p.`created_at`, p.`updated_at`, "
        "       p.`view_count`, p.`is_notice`, p.`is_secret`, p.`board_type`, "
        "       COALESCE(u.`name`, '알 수 없음') AS author, "
        "       b.`slug` AS board_slug "
        "FROM `Post` p "
        "LEFT JOIN `User` u ON u.`id` = p.`writer` "
        "JOIN `Board` b ON b.`id` = p.`board_type` "
        "WHERE %s" % where,
        params,
    )
    if row is None:
        return fail_result("게시글을 찾을 수 없습니다.", 404)

    if row["board_slug"] in LOGIN_REQUIRED_BOARD_SLUGS:
        # optional=True: 토큰이 없어도 예외를 던지지 않고 그냥 통과시킨다.
        # 여기서 로그인 여부만 확인하고, 없으면 내용을 보여주지 않는다.
        verify_jwt_in_request(optional=True)
        if current_user() is None:
            return fail_result("로그인이 필요합니다.", 401, error_code="login_required")

    # 조회수 증가 (명세의 "조회수 증가" 예시)
    db.execute("UPDATE `Post` SET `view_count` = `view_count` + 1 WHERE `id` = ?",
               (post_id,))
    views = row["view_count"] + 1

    attachments = [
        {
            "id": a["id"],
            "name": a["name"],
            "fileType": a["file_type"],
            "fileSize": a["file_size"],
            "sortOrder": a["sort_order"],
        }
        # 본문에 삽입된 이미지는 이미 content 안에 <img> 로 들어가 있으므로
        # 첨부파일 목록에는 넣지 않는다 (DB 에는 그대로 남아 있다).
        for a in db.query_all(
            "SELECT `id`, `name`, `file_type`, `file_size`, `sort_order` "
            "FROM `Attachment` WHERE `post_id` = ? AND `file_type` <> ? "
            "ORDER BY `sort_order`",
            (post_id, files.INLINE_FILE_TYPE),
        )
    ]

    return ok_result(
        data={
            "id": row["id"],
            "title": row["title"],
            "content": row["content"],
            "author": row["author"],
            "createdAt": fmt_date(row["created_at"]),
            "updatedAt": fmt_date(row["updated_at"]),
            "views": views,
            "isNotice": bool(row["is_notice"]),
            "isSecret": bool(row["is_secret"]),
            "board": row["board_slug"],
            "attachments": attachments,
            # 참여 행사 글이면 행사 기간과 신청 마감일 (아니면 전부 None).
            # 수정 화면이 기존 값을 그대로 띄우려면 필요하다.
            **(_events_for([post_id]).get(post_id)
               or {"startDate": None, "endDate": None,
                   "applyDue": None, "eventName": None}),
        },
        # 명세 예시가 최상위에도 attachments 를 두고 있어 호환을 위해 유지
        attachments=attachments,
    )


# =============================================================================
# 게시글 작성
# =============================================================================
@posts_bp.route("", methods=["POST"])
@admin_required
def create_post():
    form = request.form
    board = find_board(form.get("board"))
    if board is None:
        return fail_result("Invalid board type")

    title = (form.get("title") or "").strip()
    content = form.get("content") or ""
    if not title:
        return fail_result("제목을 입력해 주세요.")

    me = current_user()
    is_notice = _form_bool(form.get("isNotice") or form.get("option_notice"))
    is_secret = _form_bool(form.get("isSecret") or form.get("option_bimil"))

    _, post_id = db.execute(
        "INSERT INTO `Post` "
        "(`title`, `content`, `writer`, `board_type`, `menu_id`, "
        " `created_at`, `updated_at`, `view_count`, `is_notice`, `is_secret`) "
        "VALUES (?, ?, ?, ?, ?, NOW(), NULL, 0, ?, ?)",
        (title[:255], content, me["id"], board["id"], board["menu_id"],
         is_notice, is_secret),
        commit=False,
    )

    saved = _save_attachments(post_id, board["menu_id"], start_order=0)
    _sync_inline_images(post_id, board["menu_id"], content)

    # 참여행사면 Event 를 함께 만든다 (명세: isparticipate / event_date / form_date)
    if _form_bool(form.get("isparticipate")):
        _create_event_for_post(post_id, board, title, form)

    db.commit()
    return ok_result(
        boardId=post_id,
        message="Board post created successfully",
        attachments=saved,
    )


def _create_event_for_post(post_id, board, title, form):
    """
    is_event 게시판(참여 행사)의 글은 Event 를 함께 만든다.

    행사 기간은 시작일과 종료일을 모두 받는다. 종료일이 없으면 하루짜리로 본다.
    (명세는 event_date 하나만 정의하지만 기간 행사를 표현할 수 없어 확장했다)

    캘린더에 뜨는 이름(Event.name)은 event_name 으로 따로 받는다.
    글 제목은 대괄호 머리말까지 붙어 길 때가 많아 달력 칸에 그대로 쓰기 어렵다.
    안 보내면 예전처럼 글 제목을 쓴다.
    """
    start_date = (form.get("event_date") or form.get("start_date") or "").strip() or None
    end_date = (form.get("end_date") or "").strip() or start_date
    form_date = (form.get("form_date") or "").strip() or None
    event_name = (form.get("event_name") or "").strip() or title
    db.execute(
        "INSERT INTO `Event` "
        "(`organization_id`, `post_id`, `menu_id`, `is_visible`, "
        " `apply_due`, `start_date`, `end_date`, `name`) "
        "VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
        (board["organization_id"], post_id, board["menu_id"],
         form_date, start_date, end_date, event_name[:255]),
        commit=False,
    )


# =============================================================================
# 게시글 수정
# =============================================================================
@posts_bp.route("/<int:post_id>", methods=["PUT"])
@admin_required
def update_post(post_id):
    form = request.form
    board = find_board(form.get("board") or request.args.get("board"))

    existing = db.query_one(
        "SELECT `id`, `menu_id`, `board_type` FROM `Post` WHERE `id` = ?", (post_id,))
    if existing is None:
        return fail_result("게시글을 찾을 수 없습니다.", 404)
    if board is not None and existing["board_type"] != board["id"]:
        return fail_result("게시판이 일치하지 않습니다.", 400)

    columns = ["`updated_at` = NOW()"]
    values = []
    if form.get("title"):
        columns.append("`title` = ?")
        values.append(form["title"][:255])
    if form.get("content") is not None:
        columns.append("`content` = ?")
        values.append(form.get("content"))
    for key, column in (("isNotice", "is_notice"), ("isSecret", "is_secret")):
        if form.get(key) is not None:
            columns.append("`%s` = ?" % column)
            values.append(_form_bool(form.get(key)))

    values.append(post_id)
    db.execute("UPDATE `Post` SET %s WHERE `id` = ?" % ", ".join(columns),
               values, commit=False)

    # 수정 화면에서 뺀 기존 첨부를 지운다. 이 글의 일반 첨부만 대상이고
    # 본문 이미지(inline-image)는 _sync_inline_images 가 따로 관리한다.
    # 디스크 파일은 남겨 둔다 — 파일이 원본 이름으로 한 폴더에 저장되어
    # 같은 이름을 다른 글이 참조하고 있을 수 있다.
    removed = _delete_attachments(post_id, form.getlist("deleteAttachmentIds"))

    # 새 파일이 오면 이어붙인다 (기존 첨부는 유지)
    current_max = db.scalar(
        "SELECT COALESCE(MAX(`sort_order`), 0) FROM `Attachment` WHERE `post_id` = ?",
        (post_id,)) or 0
    saved = _save_attachments(post_id, existing["menu_id"], start_order=current_max)

    # 본문이 바뀌었으면 인라인 이미지 등록 상태도 맞춘다 (추가분 등록/삭제분 정리)
    if form.get("content") is not None:
        _sync_inline_images(post_id, existing["menu_id"], form.get("content"))

    # 행사 날짜 칸이 함께 오면 Event 를 맞춘다.
    #   값이 있으면  -> UPDATE (지우고 새로 만들지 않아 주관 기관이 보존된다)
    #   비어 있으면  -> 캘린더에서 내리겠다는 뜻이라 Event 를 지운다
    if "event_date" in form:
        _update_event_for_post(post_id, board, form)

    db.commit()
    message = ("Board post updated with new attachments" if saved
               else "Board post updated successfully")
    return ok_result(boardId=post_id, message=message, attachments=saved,
                     deletedAttachments=removed)


def _delete_attachments(post_id, raw_ids):
    """deleteAttachmentIds 로 온 첨부 행을 지우고 지운 개수를 돌려준다."""
    ids = sorted({i for i in (to_int(v) for v in raw_ids) if i})
    if not ids:
        return 0
    placeholders = ", ".join(["?"] * len(ids))
    count, _ = db.execute(
        "DELETE FROM `Attachment` "
        "WHERE `post_id` = ? AND `file_type` <> ? AND `id` IN (%s)" % placeholders,
        [post_id, files.INLINE_FILE_TYPE] + ids,
        commit=False,
    )
    return count


# =============================================================================
# 게시글 삭제
# =============================================================================
@posts_bp.route("/<int:post_id>", methods=["DELETE"])
@admin_required
def delete_post(post_id):
    board = find_board(request.args.get("board"))

    where = "`id` = ?"
    params = [post_id]
    if board is not None:
        where += " AND `board_type` = ?"
        params.append(board["id"])

    if not db.scalar("SELECT COUNT(*) FROM `Post` WHERE %s" % where, params):
        return fail_result("게시글을 찾을 수 없습니다.", 404)

    # Attachment 는 FK ON DELETE CASCADE 로 함께 삭제된다.
    #
    # Event 는 다르다. FK 가 ON DELETE SET NULL 이라 글만 지우면 일정 행이
    # post_id = NULL 인 채로 남아 캘린더에 계속 뜬다. 어느 글에서 온 것인지
    # 알 실마리까지 사라져 나중에 찾아 지우기도 어렵다.
    # 그래서 글보다 먼저 명시적으로 지운다.
    #
    # 관리자가 캘린더에서 직접 만든 일정은 처음부터 post_id 가 NULL 이라
    # 이 조건에 걸리지 않는다.
    removed_events, _ = db.execute(
        "DELETE FROM `Event` WHERE `post_id` = ?", (post_id,), commit=False)

    # 둘을 한 트랜잭션으로 묶는다. 글 삭제가 실패하면 일정도 되돌아간다.
    db.execute("DELETE FROM `Post` WHERE %s" % where, params, commit=False)
    db.commit()

    return ok_result(
        boardId=post_id,
        message="Board post deleted successfully",
        deletedEvents=removed_events,
    )


# =============================================================================
# 첨부파일 저장
# =============================================================================
def _save_attachments(post_id, menu_id, start_order=0):
    """
    multipart 의 file / file[] / file_1, file_2 ... 를 모두 받아 저장한다.
    실제 파일은 UPLOAD_DIR 에 두고 DB 에는 파일명·크기만 기록한다.

    개수 제한은 두지 않는다. 예전에는 10개까지만 받았는데, 레거시 명세가
    file_1..file_10 이라는 고정된 이름을 쓰던 흔적이었다. 지금은 실제로 들어온
    file_N 키를 번호순으로 훑으므로 몇 개가 오든 그대로 저장된다.
    """
    files = []
    for key in ("file", "file[]", "files", "files[]"):
        files.extend([f for f in request.files.getlist(key) if f and f.filename])

    numbered = sorted(
        (key for key in request.files if re.fullmatch(r"file_\d+", key)),
        key=lambda key: int(key.split("_")[1]),
    )
    for key in numbered:
        files.extend([f for f in request.files.getlist(key) if f and f.filename])

    if not files:
        return []

    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    except OSError:
        pass

    saved = []
    order = start_order
    for item in files:
        order += 1
        original_name = item.filename
        # 한글 파일명을 유지하되 경로 조작 문자는 제거한다.
        safe_name = secure_filename(original_name) or ("file_%d" % order)
        stored_name = original_name.replace("/", "_").replace("\\", "_")
        path = os.path.join(UPLOAD_DIR, stored_name)

        size = None
        try:
            item.save(path)
            size = os.path.getsize(path)
        except OSError:
            # 파일 저장이 실패해도 DB 행은 남기지 않는다.
            continue

        _, attachment_id = db.execute(
            "INSERT INTO `Attachment` "
            "(`file_type`, `name`, `file_size`, `sort_order`, `created_at`, "
            " `post_id`, `menu_id`) "
            "VALUES (?, ?, ?, ?, NOW(), ?, ?)",
            (_file_type(original_name), stored_name[:255], size, order,
             post_id, menu_id),
            commit=False,
        )
        saved.append({"id": attachment_id, "name": stored_name,
                      "sortOrder": order, "fileSize": size,
                      "safeName": safe_name})
    return saved


def _form_bool(value):
    if value is None:
        return 0
    return 1 if str(value).strip().lower() in ("1", "true", "y", "yes", "on", "-1") else 0


def _sync_inline_images(post_id, menu_id, content):
    """
    본문에 삽입된 이미지를 Attachment 에 반영한다.

    일반 첨부와 달리 본문(HTML)이 유일한 근거다. 그래서 저장할 때마다
    "지금 본문이 참조하는 이미지" 와 "DB 에 등록된 인라인 이미지" 를 맞춘다.
      - 본문에 새로 생긴 이미지 -> Attachment 행 추가
      - 본문에서 지워진 이미지  -> Attachment 행 삭제 (파일은 남겨 둔다)
    file_type 이 'inline-image' 인 행만 건드리므로 일반 첨부는 영향이 없다.
    """
    referenced = files.inline_names_in(content)          # 본문 등장 순서
    referenced_set = set(referenced)

    registered = {
        row["name"]: row["id"]
        for row in db.query_all(
            "SELECT `id`, `name` FROM `Attachment` "
            "WHERE `post_id` = ? AND `file_type` = ?",
            (post_id, files.INLINE_FILE_TYPE),
        )
    }

    # sort_order 에 본문 순서를 넣어 둔다. 목록 썸네일이 "첫 번째 이미지" 라서
    # 순서가 결과에 영향을 준다.
    for order, name in enumerate(referenced):
        if name in registered:
            db.execute(
                "UPDATE `Attachment` SET `sort_order` = ? WHERE `id` = ?",
                (order, registered[name]), commit=False)
            continue
        path = os.path.join(files.UPLOAD_DIR, name)
        size = os.path.getsize(path) if os.path.isfile(path) else None
        db.execute(
            "INSERT INTO `Attachment` "
            "(`file_type`, `name`, `file_size`, `sort_order`, `created_at`, "
            " `post_id`, `menu_id`) "
            "VALUES (?, ?, ?, ?, NOW(), ?, ?)",
            (files.INLINE_FILE_TYPE, name[:255], size, order, post_id, menu_id),
            commit=False,
        )

    for name in set(registered) - referenced_set:
        db.execute("DELETE FROM `Attachment` WHERE `id` = ?",
                   (registered[name],), commit=False)
