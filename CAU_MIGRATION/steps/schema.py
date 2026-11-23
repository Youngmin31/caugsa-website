# -*- coding: utf-8 -*-
"""
steps/schema.py
===============
신규 ERD 스키마 생성 / 초기화.
"""

import DEFINE
import utils


def run(ctx):
    target = ctx.target
    settings = ctx.settings

    existing = [t for t in DEFINE.NEW_TABLES if target.table_exists(t)]

    if settings.dry_run:
        would_create = [t for t in DEFINE.NEW_TABLES
                        if settings.drop_existing or t not in existing]
        utils.log("  [dry-run] CREATE TABLE 생략: %s" % ", ".join(would_create))
        return ctx.report.add(
            "스키마",
            생성예정_테이블=len(would_create),
            이미존재_테이블=len(existing),
            전체_테이블=len(DEFINE.NEW_TABLES),
        )

    if existing and not settings.drop_existing:
        non_empty = [t for t in existing if target.count(t) > 0]
        if non_empty:
            raise RuntimeError(
                "타깃 DB(%s)에 이미 데이터가 있는 테이블이 있습니다: %s\n"
                "  기존 내용을 지우고 새로 만들려면 --drop 을 사용하세요."
                % (settings.target.database, ", ".join(non_empty))
            )

    target.set_foreign_key_checks(False)
    try:
        if settings.drop_existing and existing:
            utils.log("  기존 테이블 삭제: %s" % ", ".join(reversed(DEFINE.NEW_TABLES)))
            for table in reversed(DEFINE.NEW_TABLES):
                target.execute("DROP TABLE IF EXISTS `%s`" % table)

        created = []
        for table in DEFINE.NEW_TABLES:
            if target.table_exists(table):
                utils.debug("%s : 이미 존재 (건너뜀)" % table)
                continue
            target.execute(DEFINE.ddl_for(table))
            created.append(table)
            utils.log("  CREATE TABLE %s" % table)
    finally:
        target.set_foreign_key_checks(True)

    target.commit()
    return ctx.report.add(
        "스키마",
        생성한_테이블=len(created),
        전체_테이블=len(DEFINE.NEW_TABLES),
    )


def export_ddl(path):
    """스키마 DDL 을 .sql 파일로 저장 (참고용)."""
    lines = [
        "-- CAUGSA 신규 스키마 (ERD 기준)",
        "-- CAU_MIGRATION/DEFINE.py 에서 자동 생성됨",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
    ]
    for table in reversed(DEFINE.NEW_TABLES):
        lines.append("DROP TABLE IF EXISTS `%s`;" % table)
    lines.append("")
    for table in DEFINE.NEW_TABLES:
        lines.append(DEFINE.ddl_for(table) + ";")
        lines.append("")
    lines.append("SET FOREIGN_KEY_CHECKS = 1;")

    utils.ensure_dir(__import__("os").path.dirname(path))
    with open(path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))
    return path
