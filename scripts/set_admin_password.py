# -*- coding: utf-8 -*-
"""
scripts/set_admin_password.py
=============================
계정 하나의 비밀번호를 설정한다.

마이그레이션은 비밀번호를 이관하지 않아서 전 계정이 로그인 불가 상태다
(password = DEFINE.NOLOGIN_PASSWORD). 관리 기능을 쓰려면 관리자 계정
최소 하나의 비밀번호를 수동으로 넣어야 한다.

    python scripts/set_admin_password.py --db caugsa_v2_local \
        --login-id admin --password admin1234

접속 정보는 backend/.env 의 V2_DB_* 를 쓰고, 없으면 DB_* 로 떨어진다.
--db 를 반드시 명시해야 한다 (실수로 다른 DB 를 건드리지 않도록).
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(REPO_ROOT, "backend"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(REPO_ROOT, "backend", ".env"))

import mariadb  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402


# 운영 DB 이름. 실수로 여기에 쓰지 않도록 막는다.
PROTECTED_DB_NAMES = {"caugsa"}


def env(*names, **kw):
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return kw.get("default")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="대상 DB 이름")
    parser.add_argument("--login-id", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", default=None,
                        help="함께 지정할 role (예: ADMIN). 생략하면 안 바꾼다")
    args = parser.parse_args()

    if args.db in PROTECTED_DB_NAMES:
        sys.stderr.write(
            "'%s' 는 운영 DB 이름이라 이 스크립트로 변경할 수 없습니다.\n"
            "운영 계정은 서버에서 직접 처리하세요.\n" % args.db
        )
        return 2

    conn = mariadb.connect(
        host=env("V2_DB_HOST", "DB_HOST", default="localhost"),
        port=int(env("V2_DB_PORT", "DB_PORT", default="3306")),
        user=env("V2_DB_USER", "DB_USER", default="root"),
        password=env("V2_DB_PASSWORD", "DB_PASSWORD", default=""),
        database=args.db,
    )
    cur = conn.cursor()

    cur.execute(
        "SELECT `id`, `login_id`, `name`, `role` FROM `User` WHERE `login_id` = ?",
        (args.login_id,),
    )
    row = cur.fetchone()
    if row is None:
        sys.stderr.write("계정을 찾을 수 없습니다: %s\n" % args.login_id)
        return 1
    user_id, login_id, name, role = row

    hashed = generate_password_hash(args.password)
    if args.role:
        cur.execute(
            "UPDATE `User` SET `password` = ?, `role` = ? WHERE `id` = ?",
            (hashed, args.role, user_id),
        )
        role = args.role
    else:
        cur.execute(
            "UPDATE `User` SET `password` = ? WHERE `id` = ?", (hashed, user_id)
        )
    conn.commit()

    print("DB       : %s" % args.db)
    print("계정     : id=%s login_id=%s name=%s role=%s" % (user_id, login_id, name, role))
    print("비밀번호 : 설정 완료 (%s...)" % hashed[:24])

    cur.execute(
        "SELECT COUNT(*) FROM `User` WHERE `password` NOT LIKE '%%$migrated$%%'"
    )
    print("로그인 가능 계정 수: %d" % cur.fetchone()[0])
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
