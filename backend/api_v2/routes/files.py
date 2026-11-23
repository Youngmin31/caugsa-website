# -*- coding: utf-8 -*-
"""
api_v2/routes/files.py
======================
명세: 첨부파일 다운로드

  POST /api/files/download
    fileName     : Base64 로 인코딩된 UTF-8 파일명 (필수)
    originalName : Base64 디코딩 실패 시 폴백 (선택)
    postId       : 게시글 ID (명세상 "현재 미사용, TODO")

`postId` 를 활용해 실제로 그 게시글의 첨부파일인지 검증한다.
(명세는 미사용이라고 되어 있으나, 검증 없이 파일명만 받으면 업로드
디렉터리의 임의 파일을 내려받을 수 있어 postId 가 오면 확인한다.)
"""

import base64
import os
import re
import uuid

from flask import Blueprint, request, send_file

from api_v2 import db
from api_v2.helpers import admin_required, fail_result, ok_result, to_int
from api_v2.settings import UPLOAD_DIR

files_bp = Blueprint("v2_files", __name__, url_prefix="/api/files")

# 본문에 삽입되는 이미지. 일반 첨부와 구분하려고 file_type 을 따로 쓴다.
INLINE_FILE_TYPE = "inline-image"
INLINE_IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "webp", "bmp"}
INLINE_URL_PREFIX = "/api/files/image?name="
MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024

# 본문(HTML)에서 우리가 올린 인라인 이미지 파일명을 뽑아내는 패턴
_INLINE_SRC_RE = re.compile(
    re.escape(INLINE_URL_PREFIX) + r"([A-Za-z0-9._-]+)")


def inline_names_in(content):
    """
    본문에서 참조 중인 인라인 이미지 파일명을 '본문에 나온 순서대로' 돌려준다.

    카드 목록 썸네일이 "본문의 첫 번째 이미지" 라서 순서가 의미를 가진다.
    같은 이미지를 두 번 넣으면 처음 위치만 남긴다.
    """
    if not content:
        return []
    seen = set()
    ordered = []
    for name in _INLINE_SRC_RE.findall(content):
        if name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


@files_bp.route("/download", methods=["POST"])
def download():
    body = request.get_json(silent=True) or request.form or {}
    encoded = body.get("fileName")
    original = body.get("originalName")
    post_id = to_int(body.get("postId"))

    file_name = _decode(encoded) or original
    if not file_name:
        return fail_result("fileName 이 필요합니다.")

    # 경로 조작 차단: 파일명만 취한다.
    file_name = os.path.basename(file_name.replace("\\", "/"))
    if not file_name or file_name in (".", ".."):
        return fail_result("잘못된 파일명입니다.")

    # 첨부파일 테이블에 실제로 등록된 파일인지 확인
    if post_id is not None:
        registered = db.scalar(
            "SELECT COUNT(*) FROM `Attachment` WHERE `post_id` = ? AND `name` = ?",
            (post_id, file_name),
        )
    else:
        registered = db.scalar(
            "SELECT COUNT(*) FROM `Attachment` WHERE `name` = ?", (file_name,))
    if not registered:
        return fail_result("등록되지 않은 첨부파일입니다.", 404)

    path = os.path.join(UPLOAD_DIR, file_name)
    if not os.path.isfile(path):
        return fail_result("파일을 찾을 수 없습니다: %s" % file_name, 404)

    return send_file(path, as_attachment=True, download_name=file_name)


def _decode(encoded):
    if not encoded:
        return None
    try:
        # urlsafe / 표준 Base64 모두 허용하고 패딩을 보정한다.
        text = encoded.strip()
        padding = "=" * (-len(text) % 4)
        try:
            raw = base64.urlsafe_b64decode(text + padding)
        except Exception:
            raw = base64.b64decode(text + padding)
        return raw.decode("utf-8")
    except Exception:
        return None


# =============================================================================
# 본문 삽입용 이미지
# =============================================================================
@files_bp.route("/image", methods=["POST"])
@admin_required
def upload_inline_image():
    """
    에디터에서 이미지를 본문에 넣을 때 먼저 파일만 올린다.

    게시글이 아직 없을 수 있으므로(작성 화면) 여기서는 파일만 저장하고
    Attachment 행은 만들지 않는다. 게시글 저장 시 본문에 남아 있는 이미지만
    posts.py 가 Attachment 로 등록한다. (넣었다 지운 이미지는 등록되지 않는다)
    """
    item = request.files.get("image") or request.files.get("file")
    if item is None or not item.filename:
        return fail_result("이미지 파일이 필요합니다.")

    ext = item.filename.rsplit(".", 1)[-1].lower() if "." in item.filename else ""
    if ext not in INLINE_IMAGE_EXT:
        return fail_result(
            "허용되지 않는 이미지 형식입니다: %s (%s)"
            % (ext or "확장자 없음", ", ".join(sorted(INLINE_IMAGE_EXT))))

    # 본문에 URL 로 실리므로 한글·공백 없는 안전한 이름을 새로 만든다.
    stored_name = "inline_%s.%s" % (uuid.uuid4().hex, ext)

    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        path = os.path.join(UPLOAD_DIR, stored_name)
        item.save(path)
        size = os.path.getsize(path)
    except OSError as exc:
        return fail_result("이미지를 저장하지 못했습니다: %s" % exc, 500)

    if size > MAX_INLINE_IMAGE_BYTES:
        try:
            os.remove(path)
        except OSError:
            pass
        return fail_result("이미지가 너무 큽니다 (최대 %dMB)."
                           % (MAX_INLINE_IMAGE_BYTES // (1024 * 1024)))

    return ok_result(
        message="이미지를 업로드했습니다.",
        data={
            "name": stored_name,
            "originalName": item.filename,
            "fileSize": size,
            "url": INLINE_URL_PREFIX + stored_name,
        },
    )


@files_bp.route("/image", methods=["GET"])
def serve_inline_image():
    """
    <img src> 로 직접 불러가는 경로라 GET + inline 이어야 한다.

    본문 삽입 이미지와 목록 썸네일(첨부된 이미지)이 모두 이 경로를 쓴다.
    파일명만 받아 아무 파일이나 내주지 않도록, download 와 같은 기준으로
    Attachment 에 등록된 이름인지 확인한다.
    """
    name = request.args.get("name") or ""
    name = os.path.basename(name.replace("\\", "/"))
    if not name or name in (".", ".."):
        return fail_result("잘못된 파일명입니다.")

    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in INLINE_IMAGE_EXT:
        return fail_result("이미지 파일이 아닙니다.", 404)

    # 방금 업로드하고 아직 게시글에 저장되지 않은 이미지는 등록 전이라
    # 이름 규칙(inline_<uuid>)으로 허용한다. 그 외에는 등록 여부를 본다.
    if not name.startswith("inline_"):
        registered = db.scalar(
            "SELECT COUNT(*) FROM `Attachment` WHERE `name` = ?", (name,))
        if not registered:
            return fail_result("등록되지 않은 이미지입니다.", 404)

    path = os.path.join(UPLOAD_DIR, name)
    if not os.path.isfile(path):
        return fail_result("이미지를 찾을 수 없습니다.", 404)

    return send_file(path, as_attachment=False)
