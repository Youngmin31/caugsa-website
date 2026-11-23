# -*- coding: utf-8 -*-
"""
api_v2/routes/user.py
=====================
명세: 내 정보 조회 / 내 정보 수정

  GET /api/user/profile
  PUT /api/user/profile

명세의 응답 키(userId, backupEmail, phone)를 신규 스키마 컬럼에 매핑한다.

주소(zipCode / address1 / address2)는 신규 ERD 에서 제외되어 더 이상
주고받지 않는다. 명세서 예시에는 아직 남아 있으니 함께 갱신해야 한다.
"""

from flask import Blueprint, request
from werkzeug.security import generate_password_hash

from api_v2 import db
from api_v2.helpers import (
    fail_result, is_valid_password, jwt_user_required, ok_result, PASSWORD_RULE_MESSAGE,
)

user_bp = Blueprint("v2_user", __name__, url_prefix="/api/user")

# 명세의 요청 키 -> DB 컬럼
#
# email(포탈 아이디)은 계정을 식별하는 값이라 수정 대상이 아니다.
# 요청에 email 이 들어와도 무시한다.
EDITABLE_FIELDS = {
    "backupEmail": "sub_email",
    "phone": "mobile",
    "college": "college",
    "major": "major",
}


@user_bp.route("/profile", methods=["GET"])
@jwt_user_required
def get_profile():
    from api_v2.helpers import current_user
    me = current_user()

    row = db.query_one(
        "SELECT `id`, `login_id`, `name`, `email`, `sub_email`, `mobile`, "
        "       `student_id`, `college`, `major`, `role` "
        "FROM `User` WHERE `id` = ?",
        (me["id"],),
    )
    if row is None:
        return fail_result("사용자를 찾을 수 없습니다.", 404)

    return ok_result(
        message="사용자 정보 로드 성공",
        data={
            "id": row["id"],
            "userId": row["login_id"],
            "name": row["name"],
            "email": row["email"],
            "backupEmail": row["sub_email"],
            "phone": row["mobile"],
            "studentId": row["student_id"],
            "college": row["college"],
            "major": row["major"],
        },
    )


@user_bp.route("/profile", methods=["PUT"])
@jwt_user_required
def update_profile():
    from api_v2.helpers import current_user
    me = current_user()
    body = request.get_json(silent=True) or {}

    columns = []
    values = []
    for key, column in EDITABLE_FIELDS.items():
        if key in body:
            columns.append("`%s` = ?" % column)
            values.append((body.get(key) or None))

    # 비밀번호는 반드시 해시로 저장한다.
    password = body.get("password")
    if password:
        if not is_valid_password(password):
            return fail_result(PASSWORD_RULE_MESSAGE, error_code="invalid_password")
        columns.append("`password` = ?")
        values.append(generate_password_hash(password))

    if not columns:
        return fail_result("수정할 항목이 없습니다.")

    values.append(me["id"])
    db.execute("UPDATE `User` SET %s WHERE `id` = ?" % ", ".join(columns), values)
    return ok_result(message="사용자 정보가 성공적으로 업데이트되었습니다.")
