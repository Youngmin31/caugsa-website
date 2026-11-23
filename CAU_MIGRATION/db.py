# -*- coding: utf-8 -*-
"""
db.py
=====
DB 드라이버 추상화 계층.

mariadb (backend/requirements.txt 에 포함) 를 우선 사용하고,
없으면 PyMySQL 로 폴백한다. 두 드라이버의 파라미터 스타일 차이
( qmark `?` vs format `%s` ) 는 여기서 흡수한다.
"""

import DEFINE

_DRIVER = None
_DRIVER_NAME = None


def _load_driver():
    global _DRIVER, _DRIVER_NAME
    if _DRIVER is not None:
        return _DRIVER
    try:
        import mariadb  # type: ignore
        _DRIVER, _DRIVER_NAME = mariadb, "mariadb"
        return _DRIVER
    except ImportError:
        pass
    try:
        import pymysql  # type: ignore
        _DRIVER, _DRIVER_NAME = pymysql, "pymysql"
        return _DRIVER
    except ImportError:
        pass
    raise RuntimeError(
        "MariaDB/MySQL 드라이버를 찾을 수 없습니다.\n"
        "  pip install mariadb      (권장, backend/requirements.txt 와 동일)\n"
        "  또는 pip install PyMySQL"
    )


def driver_name():
    _load_driver()
    return _DRIVER_NAME


class Connection(object):
    """드라이버 차이를 감춘 얇은 커넥션 래퍼."""

    def __init__(self, raw, label="", has_database=True):
        self._raw = raw
        self.label = label
        # dry-run 중 타깃 DB 가 아직 없을 때 False. 이 경우 모든 테이블은
        # "존재하지 않음 / 0건" 으로 취급한다.
        self.has_database = has_database

    # -- 파라미터 스타일 -------------------------------------------------
    @staticmethod
    def _adapt(sql):
        """내부적으로 `?` 스타일을 쓰고, pymysql 이면 `%s` 로 바꾼다."""
        if driver_name() == "pymysql":
            return sql.replace("?", "%s")
        return sql

    # -- 조회 ------------------------------------------------------------
    def fetch_all(self, sql, params=None, dictionary=True):
        cur = self._cursor(dictionary)
        try:
            cur.execute(self._adapt(sql), params or ())
            return cur.fetchall()
        finally:
            cur.close()

    def fetch_one(self, sql, params=None, dictionary=True):
        cur = self._cursor(dictionary)
        try:
            cur.execute(self._adapt(sql), params or ())
            return cur.fetchone()
        finally:
            cur.close()

    def iter_rows(self, sql, params=None, batch=1000):
        """대용량 테이블을 배치로 읽는다."""
        cur = self._cursor(True)
        try:
            cur.execute(self._adapt(sql), params or ())
            while True:
                rows = cur.fetchmany(batch)
                if not rows:
                    break
                for row in rows:
                    yield row
        finally:
            cur.close()

    def scalar(self, sql, params=None):
        row = self.fetch_one(sql, params, dictionary=False)
        return None if row is None else row[0]

    # -- 실행 ------------------------------------------------------------
    def execute(self, sql, params=None):
        cur = self._cursor(False)
        try:
            cur.execute(self._adapt(sql), params or ())
            return cur.rowcount
        finally:
            cur.close()

    def execute_script(self, statements):
        for sql in statements:
            sql = sql.strip()
            if sql:
                self.execute(sql)

    def insert_many(self, sql, rows, chunk_size=None):
        """
        executemany 로 대량 INSERT.
        실패 시 해당 청크만 행 단위로 재시도해 문제 행을 특정할 수 있게 한다.
        """
        if not rows:
            return 0
        chunk_size = chunk_size or DEFINE.INSERT_CHUNK_SIZE
        adapted = self._adapt(sql)
        inserted = 0
        for start in range(0, len(rows), chunk_size):
            chunk = rows[start:start + chunk_size]
            cur = self._cursor(False)
            try:
                cur.executemany(adapted, chunk)
                inserted += len(chunk)
            except Exception:
                cur.close()
                inserted += self._insert_one_by_one(adapted, chunk)
                continue
            cur.close()
        return inserted

    def _insert_one_by_one(self, adapted_sql, chunk):
        ok = 0
        for row in chunk:
            cur = self._cursor(False)
            try:
                cur.execute(adapted_sql, row)
                ok += 1
            except Exception as exc:
                raise RuntimeError("INSERT 실패: %s\n  row=%r" % (exc, row))
            finally:
                cur.close()
        return ok

    def last_insert_id(self):
        return self.scalar("SELECT LAST_INSERT_ID()")

    # -- 트랜잭션 --------------------------------------------------------
    def commit(self):
        self._raw.commit()

    def rollback(self):
        try:
            self._raw.rollback()
        except Exception:
            pass

    def close(self):
        try:
            self._raw.close()
        except Exception:
            pass

    def set_foreign_key_checks(self, enabled):
        self.execute("SET FOREIGN_KEY_CHECKS = %d" % (1 if enabled else 0))

    def purge(self, tables):
        """
        해당 단계가 소유한 테이블을 비운다 (--only 재실행을 멱등하게 만든다).

        FOREIGN_KEY_CHECKS 를 끈 상태에서 지우므로 CASCADE/SET NULL 같은
        참조 동작이 실행되지 않는다. 예를 들어 User 를 다시 적재해도
        이미 이관된 Post.writer 가 NULL 로 지워지지 않는다.
        """
        removed = {}
        self.set_foreign_key_checks(False)
        try:
            for table in tables:
                if not self.table_exists(table):
                    continue
                count = self.count(table)
                if count:
                    self.execute("DELETE FROM `%s`" % table)
                    removed[table] = count
        finally:
            self.set_foreign_key_checks(True)
        return removed

    def table_exists(self, table):
        if not self.has_database:
            return False
        return bool(self.scalar(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            (table,),
        ))

    def count(self, table):
        if not self.has_database:
            return 0
        return self.scalar("SELECT COUNT(*) FROM `%s`" % table)

    # -- 내부 ------------------------------------------------------------
    def _cursor(self, dictionary):
        if not dictionary:
            return self._raw.cursor()
        if driver_name() == "pymysql":
            import pymysql.cursors  # type: ignore
            return self._raw.cursor(pymysql.cursors.DictCursor)
        return self._raw.cursor(dictionary=True)


def connect(cfg, with_database=True, autocommit=False, label=""):
    """DbConfig 로 접속한다."""
    drv = _load_driver()
    kwargs = cfg.kwargs(with_database=with_database)
    if _DRIVER_NAME == "pymysql":
        kwargs["charset"] = "utf8mb4"
        kwargs["autocommit"] = autocommit
        raw = drv.connect(**kwargs)
    else:
        raw = drv.connect(**kwargs)
        try:
            raw.autocommit = autocommit
        except Exception:
            pass
    conn = Connection(raw, label or cfg.database)
    conn.execute("SET NAMES utf8mb4")
    return conn


def connect_target(cfg, dry_run=False, label="target"):
    """
    타깃 DB 에 접속한다.
    dry-run 중 DB 가 아직 없으면 DB 를 만들지 않고 서버에만 접속해,
    "빈 타깃" 으로 간주하고 검증을 계속한다.
    """
    try:
        return connect(cfg, with_database=True, label=label)
    except Exception:
        if not dry_run:
            raise
        conn = connect(cfg, with_database=False, label=label)
        conn.has_database = False
        return conn


def ensure_database(cfg):
    """타깃 DB 가 없으면 만든다."""
    conn = connect(cfg, with_database=False, autocommit=True, label="server")
    try:
        conn.execute(
            "CREATE DATABASE IF NOT EXISTS `%s` "
            "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" % cfg.database
        )
    finally:
        conn.close()
