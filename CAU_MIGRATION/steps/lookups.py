# -*- coding: utf-8 -*-
"""
steps/lookups.py
================
마스터 데이터 이관: Menu / Organization / Board.

신규 구조는 메뉴 4개(총학생회 소개 / 총학생회 게시판 / 학생 자치 / 정보 마당)
아래 게시판 11개다. 레거시는 게시판을 국·위원회 단위로 쪼개 두었으므로
DEFINE.LEGACY_BOARD_MAP 으로 여러 레거시 게시판을 하나의 신규 게시판에 합친다.

결과는 ctx 에 저장되어 이후 단계(posts/events)에서 사용된다.
  ctx.menu_ids          : {메뉴명 -> Menu.id}
  ctx.organization_ids  : {기관명 -> Organization.id}
  ctx.boards            : {legacy_code -> {"id":…, "menu_id":…, …}}
  ctx.board_by_name     : {게시판명 -> {"id":…, "menu_id":…, …}}
"""

import DEFINE
import utils


def run(ctx):
    _load_menus(ctx)
    _load_organizations(ctx)
    counters = _load_boards(ctx)
    if not ctx.settings.dry_run:
        ctx.target.commit()
    return ctx.report.add("마스터 데이터", **counters)


def _next_fake_id(ctx):
    """dry-run 용 가상 PK 발급기."""
    ctx._fake_id = getattr(ctx, "_fake_id", 0) + 1
    return ctx._fake_id


# -----------------------------------------------------------------------------
# Menu
# -----------------------------------------------------------------------------
def _load_menus(ctx):
    target = ctx.target
    if ctx.settings.dry_run:
        ctx.menu_ids = {name: i for i, name in enumerate(DEFINE.MENUS, start=1)}
    else:
        for name in DEFINE.MENUS:
            target.execute("INSERT IGNORE INTO `Menu` (`name`) VALUES (?)", (name,))
        ctx.menu_ids = {
            row["name"]: row["id"]
            for row in target.fetch_all("SELECT `id`, `name` FROM `Menu`")
        }
    utils.log("  Menu          : %d건  (%s)" % (len(ctx.menu_ids), " / ".join(DEFINE.MENUS)))


# -----------------------------------------------------------------------------
# Organization
# -----------------------------------------------------------------------------
def _load_organizations(ctx):
    target = ctx.target
    if ctx.settings.dry_run:
        ctx.organization_ids = {name: i for i, name in enumerate(DEFINE.ORGANIZATIONS, start=1)}
    else:
        for name in DEFINE.ORGANIZATIONS:
            target.execute("INSERT IGNORE INTO `Organization` (`name`) VALUES (?)", (name,))
        ctx.organization_ids = {
            row["name"]: row["id"]
            for row in target.fetch_all("SELECT `id`, `name` FROM `Organization`")
        }
    utils.log("  Organization  : %d건" % len(ctx.organization_ids))


# -----------------------------------------------------------------------------
# Board
# -----------------------------------------------------------------------------
def _legacy_board_codes(ctx):
    """레거시 게시글에 실제로 등장하는 b_part 값 + 게시글 수."""
    sql = (
        "SELECT `b_part` AS code, COUNT(*) AS cnt "
        "FROM `%s` GROUP BY `b_part` ORDER BY `b_part`" % DEFINE.LEGACY_TABLES["board"]
    )
    return {utils.clean(r["code"]): int(r["cnt"])
            for r in ctx.source.fetch_all(sql)
            if utils.clean(r["code"])}


def _load_boards(ctx):
    used_codes = _legacy_board_codes(ctx)
    ctx.legacy_board_counts = used_codes

    # 1) 신규 게시판 11개 생성
    ctx.board_by_name = {}
    for definition in DEFINE.BOARD_DEFS:
        ctx.board_by_name[definition["name"]] = _upsert_board(ctx, definition)

    # 2) 레거시 코드 -> 신규 게시판 연결
    ctx.boards = {}
    ctx.board_slugs = {d["slug"]: ctx.board_by_name[d["name"]] for d in DEFINE.BOARD_DEFS}

    unmapped = []
    for code in sorted(used_codes):
        name = DEFINE.LEGACY_BOARD_MAP.get(code)
        if name is None:
            name = DEFINE.FALLBACK_BOARD
            unmapped.append((code, used_codes[code]))
        ctx.boards[code] = ctx.board_by_name[name]

    ctx.calendar_board = ctx.board_by_name[DEFINE.CALENDAR_BOARD_NAME]

    # 3) 로그 : 신규 게시판별로 합쳐지는 레거시 게시판과 게시글 수
    utils.log("  Board         : %d건" % len(ctx.board_by_name))
    rollup = {}
    for code, count in used_codes.items():
        name = DEFINE.LEGACY_BOARD_MAP.get(code, DEFINE.FALLBACK_BOARD)
        entry = rollup.setdefault(name, {"codes": [], "posts": 0})
        entry["codes"].append(code)
        entry["posts"] += count
    for definition in DEFINE.BOARD_DEFS:
        entry = rollup.get(definition["name"], {"codes": [], "posts": 0})
        utils.log("      %-9s %-14s %5d건  <- %s"
                  % (definition["menu"], definition["name"], entry["posts"],
                     ", ".join(sorted(entry["codes"])) or "(레거시 없음)"))

    for code, count in unmapped:
        ctx.report.warn(
            "매핑되지 않은 게시판 코드 '%s' (게시글 %d건) -> '%s' 로 이관. "
            "DEFINE.LEGACY_BOARD_MAP 에 추가하면 원하는 게시판으로 보낼 수 있습니다."
            % (code, count, DEFINE.FALLBACK_BOARD)
        )

    empty = [d["name"] for d in DEFINE.BOARD_DEFS
             if not rollup.get(d["name"], {}).get("posts")]
    if empty:
        utils.debug("레거시 게시글이 없는 신규 게시판: %s" % ", ".join(empty))

    return dict(
        메뉴=len(ctx.menu_ids),
        기관=len(ctx.organization_ids),
        게시판=len(ctx.board_by_name),
        레거시_게시판_코드=len(used_codes),
        매핑안된_코드=len(unmapped),
        게시글없는_게시판=len(empty),
    )


def _upsert_board(ctx, definition):
    """이름 기준으로 Board 를 만들거나 기존 id 를 돌려준다."""
    target = ctx.target
    menu_id = ctx.menu_ids[definition["menu"]]
    org_id = (ctx.organization_ids.get(definition["organization"])
              if definition["organization"] else None)

    if ctx.settings.dry_run:
        return {"id": _next_fake_id(ctx), "menu_id": menu_id, "slug": definition["slug"],
                "organization_id": org_id, "is_event": definition["is_event"]}

    # slug 는 API 가 ?board=student-council 형태로 게시판을 지정할 때 쓰는 키라
    # 이름이 바뀌어도 유지되도록 slug 를 기준으로 upsert 한다.
    existing = target.fetch_one(
        "SELECT `id` FROM `Board` WHERE `slug` = ?", (definition["slug"],))
    if existing:
        board_id = existing["id"]
        target.execute(
            "UPDATE `Board` SET `menu_id` = ?, `organization_id` = ?, "
            "`name` = ?, `is_event` = ? WHERE `id` = ?",
            (menu_id, org_id, definition["name"],
             1 if definition["is_event"] else 0, board_id),
        )
    else:
        target.execute(
            "INSERT INTO `Board` (`menu_id`, `organization_id`, `slug`, `name`, `is_event`) "
            "VALUES (?, ?, ?, ?, ?)",
            (menu_id, org_id, definition["slug"], definition["name"],
             1 if definition["is_event"] else 0),
        )
        board_id = target.last_insert_id()

    return {"id": board_id, "menu_id": menu_id, "slug": definition["slug"],
            "organization_id": org_id, "is_event": definition["is_event"]}
