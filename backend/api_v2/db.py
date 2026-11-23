# -*- coding: utf-8 -*-
"""
api_v2/db.py
============
신규 스키마 DB 커넥션 + 쿼리 헬퍼.

요청 단위로 커넥션을 열고 teardown 에서 닫는다 (Flask `g` 사용).
접속 정보는 환경변수 -> backend/.env 순으로 읽는다.

  V2_DB_HOST / V2_DB_PORT / V2_DB_USER / V2_DB_PASSWORD / V2_DB_NAME
  없으면 DB_* 를 쓰고, DB 이름만 `<DB_NAME>_v2` 로 바꾼다.
"""

import os

from flask import g

try:
    import mariadb as _driver
    _DRIVER = "mariadb"
except ImportError:  # pragma: no cover
    import pymysql as _driver
    _DRIVER = "pymysql"


def _env(*names, **kwargs):
    default = kwargs.get("default")
    for name in names:
        value = os.environ.get(name)
        if value not in (None, ""):
            return value
    return default


def db_config():
    base_name = _env("DB_NAME", default="caugsa_local")
    return {
        "host": _env("V2_DB_HOST", "DB_HOST", default="localhost"),
        "port": int(_env("V2_DB_PORT", "DB_PORT", default=3306)),
        "user": _env("V2_DB_USER", "DB_USER", default="root"),
        "password": _env("V2_DB_PASSWORD", "DB_PASSWORD", default=""),
        "database": _env("V2_DB_NAME", default="%s_v2" % base_name),
    }


def _connect():
    cfg = db_config()
    if _DRIVER == "pymysql":
        cfg["charset"] = "utf8mb4"
    return _driver.connect(**cfg)


def get_conn():
    """요청 스코프 커넥션."""
    if "v2_conn" not in g:
        g.v2_conn = _connect()
    return g.v2_conn


def close_conn(_exc=None):
    conn = g.pop("v2_conn", None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


def _cursor(dictionary=True):
    conn = get_conn()
    if not dictionary:
        return conn.cursor()
    if _DRIVER == "pymysql":
        import pymysql.cursors
        return conn.cursor(pymysql.cursors.DictCursor)
    return conn.cursor(dictionary=True)


def _adapt(sql):
    """내부적으로 `?` 스타일을 쓰고 pymysql 이면 `%s` 로 바꾼다."""
    return sql.replace("?", "%s") if _DRIVER == "pymysql" else sql


def query_all(sql, params=None):
    cur = _cursor()
    try:
        cur.execute(_adapt(sql), params or ())
        return cur.fetchall()
    finally:
        cur.close()


def query_one(sql, params=None):
    cur = _cursor()
    try:
        cur.execute(_adapt(sql), params or ())
        return cur.fetchone()
    finally:
        cur.close()


def scalar(sql, params=None):
    cur = _cursor(dictionary=False)
    try:
        cur.execute(_adapt(sql), params or ())
        row = cur.fetchone()
        return None if row is None else row[0]
    finally:
        cur.close()


def execute(sql, params=None, commit=True):
    """INSERT/UPDATE/DELETE. (rowcount, lastrowid) 반환."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(_adapt(sql), params or ())
        rowcount = cur.rowcount
        lastrowid = getattr(cur, "lastrowid", None)
        if commit:
            conn.commit()
        return rowcount, lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def commit():
    get_conn().commit()


def rollback():
    try:
        get_conn().rollback()
    except Exception:
        pass
