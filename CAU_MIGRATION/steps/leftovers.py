# -*- coding: utf-8 -*-
"""
steps/leftovers.py
==================
신규 ERD 에 대응 테이블이 없는 레거시 테이블(Reply, tbl_youtube)을
JSON 으로 덤프해 둔다.

ERD 를 그대로 따르면 이 데이터는 이관 대상이 아니지만, 그렇다고 삭제하면
복구가 불가능하므로 output/unmigrated/ 아래에 원본을 보존한다.
나중에 신규 스키마에 댓글/유튜브 테이블이 추가되면 이 파일로 재적재할 수 있다.
"""

import os

import DEFINE
import utils


def run(ctx):
    source, settings = ctx.source, ctx.settings
    out_dir = os.path.join(settings.output_dir, "unmigrated")

    counters = {}
    for table, reason in DEFINE.UNMIGRATED_TABLES:
        if not source.table_exists(table):
            utils.debug("%s : 소스에 없음 (건너뜀)" % table)
            continue
        rows = source.fetch_all("SELECT * FROM `%s`" % table)
        path = utils.dump_json(
            os.path.join(out_dir, "%s.json" % table),
            {"table": table, "reason": reason, "row_count": len(rows), "rows": rows},
        )
        counters[table] = len(rows)
        utils.log("  %-14s: %d건 -> %s" % (table, len(rows), os.path.relpath(path, settings.output_dir)))
        ctx.report.warn(
            "%s (%d건)은 신규 ERD 에 대응 테이블이 없어 이관하지 않았습니다 (%s). "
            "원본은 output/unmigrated/%s.json 에 보존했습니다."
            % (table, len(rows), reason, table)
        )

    return ctx.report.add("미이관 데이터 보존", **counters)
