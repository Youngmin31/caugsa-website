# -*- coding: utf-8 -*-
"""
steps/events.py
===============
calendar_events -> Event

레거시 calendar_events 는 (날짜 1개, 내용) 구조라 여러 날에 걸친 행사가
같은 내용의 행으로 날짜마다 쪼개져 있다. 신규 Event 는 start_date/end_date 를
가지므로 "내용이 같고 날짜가 연속된" 행들을 하나의 행사로 합친다.
(--no-merge-events 로 끄면 1행 = 1행사로 그대로 이관)

컬럼 매핑
---------
  content      -> Event.name
  event_date   -> Event.start_date / end_date  (연속 구간이면 범위로 병합)
  (없음)       -> apply_due       : 레거시에 신청 마감일 없음
  (없음)       -> organization_id : 레거시에 주관 기관 없음 -> 총학생회
  (없음)       -> post_id         : 레거시 캘린더는 게시글과 연결되지 않음
  -            -> is_visible = 1  (캘린더에 노출되던 데이터이므로)
"""

import datetime

import DEFINE
import utils

INSERT_SQL = (
    "INSERT INTO `Event` "
    "(`organization_id`, `post_id`, `menu_id`, `is_visible`, "
    " `apply_due`, `start_date`, `end_date`, `name`) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
)


def run(ctx):
    source, target, settings = ctx.source, ctx.target, ctx.settings

    sql = (
        "SELECT `id`, `event_date`, `content` FROM `%s` "
        "ORDER BY `content`, `event_date`" % DEFINE.LEGACY_TABLES["calendar"]
    )
    if settings.limit:
        sql += " LIMIT %d" % settings.limit

    raw = []
    skipped = 0
    for row in source.iter_rows(sql):
        event_date = utils.to_date(row.get("event_date"))
        name = utils.clean(row.get("content"))
        if event_date is None or not name:
            skipped += 1
            continue
        raw.append((name, event_date))

    grouped = _merge(raw) if settings.merge_events else [(n, d, d) for n, d in raw]

    org_id = ctx.organization_ids.get(DEFINE.ORG_GSA)
    rows = [
        (
            org_id,
            None,                       # post_id : 레거시 캘린더에는 연결된 게시글 없음
            None,                       # menu_id : post_id 가 NULL 이므로 함께 NULL
            1,                          # is_visible
            None,                       # apply_due
            start,
            end,
            utils.truncate(name, 255),
        )
        for name, start, end in grouped
    ]

    if settings.dry_run:
        utils.log("  [dry-run] Event %d건 INSERT 생략" % len(rows))
    else:
        for table, count in target.purge(["Event"]).items():
            utils.log("  기존 %s %d건 삭제 후 재적재" % (table, count))
        inserted = target.insert_many(INSERT_SQL, rows)
        target.commit()
        utils.log("  Event         : %d건 이관" % inserted)

    if skipped:
        ctx.report.warn("날짜 또는 내용이 비어 이관하지 못한 캘린더 행 %d건" % skipped)

    ctx.report.warn(
        "Event.post_id / apply_due 는 레거시에 대응 데이터가 없어 NULL 입니다. "
        "행사 게시판(is_event=1)의 게시글과 연결하려면 운영 화면에서 지정해야 합니다."
    )

    return ctx.report.add(
        "행사 (calendar_events -> Event)",
        읽은_행=len(raw) + skipped,
        이관=len(rows),
        기간병합으로_합쳐진_행=len(raw) - len(grouped),
        제외=skipped,
    )


def _merge(raw):
    """
    [(name, date), ...] 를 내용이 같고 날짜가 하루씩 이어지는 구간 단위로 묶어
    [(name, start_date, end_date), ...] 로 만든다.
    """
    by_name = {}
    for name, day in raw:
        by_name.setdefault(name, []).append(day)

    merged = []
    one_day = datetime.timedelta(days=1)
    for name in sorted(by_name):
        days = sorted(set(by_name[name]))
        start = prev = days[0]
        for day in days[1:]:
            if day - prev == one_day:
                prev = day
                continue
            merged.append((name, start, prev))
            start = prev = day
        merged.append((name, start, prev))

    merged.sort(key=lambda item: (item[1], item[0]))
    return merged
