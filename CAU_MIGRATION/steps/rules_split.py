# -*- coding: utf-8 -*-
"""
steps/rules_split.py
====================
"회칙 및 세칙" 게시판을 주체별 3개로 나눈다.

  회칙 및 세칙 - 총학생회     (rules-council)
  회칙 및 세칙 - 동아리연합회  (rules-club-union)
  회칙 및 세칙 - 단과대학     (rules-college)

이 단계만 따로 돌릴 수 있다. 전체 마이그레이션을 다시 하지 않고
이미 이관된 DB 의 회칙 게시글만 재분류하고 싶을 때 쓴다.

    cd caugsa-website
    python scripts/migrate.py --only rules-split --dry-run
    python scripts/migrate.py --only rules-split -y

분류 근거
---------
마이그레이션이 레거시 PK 를 그대로 쓰므로 (Post.id == BOARD_v1.b_idx)
소스의 b_part 를 id 로 정확히 되짚을 수 있다. 제목 추측에 기대지 않는다.
단 하나의 예외가 board17 안에 섞인 동아리연합회 회칙 4건이고,
이것만 DEFINE.RULES_SPLIT_RULES 의 제목 키워드로 가려낸다.

여러 번 돌려도 결과가 같다 (게시판은 slug 기준 upsert, 게시글은 재계산 후 덮어쓰기).
"""

import DEFINE
import utils
from steps import lookups


def run(ctx):
    target, settings = ctx.target, ctx.settings

    # 1) 대상 게시판 3개 확보 (없으면 만들고, 있으면 이름/기관만 갱신)
    boards = _ensure_boards(ctx)

    # 2) 레거시 b_part + 제목으로 각 게시글이 갈 게시판을 정한다
    plan = _build_plan(ctx, boards)
    if plan is None:
        return ctx.report.add("회칙 3분할", 이관=0)

    # 3) 실제 이동
    counters = {}
    moved = 0
    for board_name, post_ids in sorted(plan.items()):
        counters[board_name] = len(post_ids)
        if not post_ids:
            continue
        if settings.dry_run:
            utils.log("  [dry-run] %-22s %4d건 이동 생략" % (board_name, len(post_ids)))
            continue
        board = boards[board_name]
        moved += _move_posts(target, post_ids, board)
        utils.log("  %-22s %4d건" % (board_name, len(post_ids)))

    if not settings.dry_run:
        # 정리까지 끝낸 뒤 한 번에 커밋한다 (먼저 커밋하면 아래 DELETE 가 날아간다).
        _warn_leftovers(ctx)
        target.commit()

    counters["이동"] = moved
    return ctx.report.add("회칙 3분할", **counters)


# -----------------------------------------------------------------------------
def _ensure_boards(ctx):
    """3개 게시판을 slug 기준으로 upsert 하고 {게시판명: board} 를 돌려준다."""
    if not getattr(ctx, "menu_ids", None):
        lookups._load_menus(ctx)
    if not getattr(ctx, "organization_ids", None):
        lookups._load_organizations(ctx)

    wanted = {d["slug"]: d for d in DEFINE.BOARD_DEFS
              if d["slug"] in DEFINE.RULES_BOARD_SLUGS}

    boards = {}
    for slug in DEFINE.RULES_BOARD_SLUGS:
        definition = wanted[slug]
        boards[definition["name"]] = lookups._upsert_board(ctx, definition)
        utils.debug("게시판 확보: %s (%s)" % (definition["name"], slug))

    if not ctx.settings.dry_run:
        ctx.target.commit()
    return boards


def _build_plan(ctx, boards):
    """{게시판명: [post_id, ...]} 를 만든다."""
    source = ctx.source
    table = DEFINE.LEGACY_TABLES["board"]
    if not source.table_exists(table):
        utils.log("  소스에 %s 테이블이 없습니다 (건너뜀)" % table)
        return None

    codes = sorted({code for code, _, _ in DEFINE.RULES_SPLIT_RULES})
    placeholders = ", ".join(["?"] * len(codes))
    rows = source.fetch_all(
        "SELECT `b_idx`, `b_part`, `b_title` FROM `%s` WHERE `b_part` IN (%s)"
        % (table, placeholders),
        codes,
    )
    utils.log("  레거시 회칙 게시글 : %d건 (%s)" % (len(rows), ", ".join(codes)))

    plan = {name: [] for name in boards}
    for row in rows:
        code = utils.clean(row["b_part"])
        title = utils.clean(row["b_title"]) or ""
        name = _target_board(code, title)
        if name in plan:
            plan[name].append(row["b_idx"])
    return plan


def _target_board(code, title):
    """DEFINE.RULES_SPLIT_RULES 를 위에서부터 적용한다."""
    for rule_code, keyword, board_name in DEFINE.RULES_SPLIT_RULES:
        if rule_code != code:
            continue
        if keyword is None or keyword in title:
            return board_name
    return None


def _move_posts(target, post_ids, board):
    """Post.board_type / menu_id 를 새 게시판으로 갱신한다."""
    moved = 0
    chunk = DEFINE.INSERT_CHUNK_SIZE
    for start in range(0, len(post_ids), chunk):
        batch = post_ids[start:start + chunk]
        placeholders = ", ".join(["?"] * len(batch))
        rowcount = target.execute(
            "UPDATE `Post` SET `board_type` = ?, `menu_id` = ? WHERE `id` IN (%s)"
            % placeholders,
            [board["id"], board["menu_id"]] + list(batch),
        )
        moved += rowcount if isinstance(rowcount, int) else len(batch)
    return moved


def _warn_leftovers(ctx):
    """예전 통합 게시판(slug='rules')에 남은 글이 있으면 알린다."""
    row = ctx.target.fetch_one("SELECT `id` FROM `Board` WHERE `slug` = ?", ("rules",))
    if not row:
        return
    left = ctx.target.scalar(
        "SELECT COUNT(*) FROM `Post` WHERE `board_type` = ?", (row["id"],))
    if left:
        ctx.report.warn(
            "통합 게시판 'rules' 에 %d건이 남아 있습니다. "
            "소스에서 b_part 를 확인할 수 없는 글이므로 관리자 화면에서 옮겨 주세요." % left
        )
    else:
        ctx.target.execute("DELETE FROM `Board` WHERE `id` = ?", (row["id"],))
        utils.log("  빈 통합 게시판 'rules' 를 제거했습니다.")
