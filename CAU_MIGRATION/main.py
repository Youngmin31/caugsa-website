# -*- coding: utf-8 -*-
"""
main.py
=======
CAUGSA 레거시 DB -> 신규 ERD 스키마 마이그레이션 엔트리포인트.

사용법
------
    python CAU_MIGRATION/main.py                  # 실제 실행
    python CAU_MIGRATION/main.py --dry-run        # 읽기만 하고 쓰지 않음
    python CAU_MIGRATION/main.py --drop           # 타깃 테이블을 지우고 다시 생성
    python CAU_MIGRATION/main.py --hash-passwords # 비밀번호를 해시로 변환해 이관
    python CAU_MIGRATION/main.py --only users,posts

접속 정보는 caugsa-website/backend/.env -> CAU_MIGRATION/.env -> 환경변수 ->
CLI 인자 순으로 덮어쓴다. 자세한 내용은 README.md 참고.
"""

import argparse
import datetime
import os
import sys

# 어디서 실행하든 CAU_MIGRATION 모듈을 import 할 수 있게 한다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import config          # noqa: E402
import db              # noqa: E402
import DEFINE          # noqa: E402
import utils           # noqa: E402
from steps import (schema, lookups, users, posts, rules_split, events,  # noqa: E402
                   leftovers)


# =============================================================================
# 실행 컨텍스트
# =============================================================================
class Context(object):
    """단계 사이에 공유되는 상태."""

    def __init__(self, settings, source, target, report):
        self.settings = settings
        self.source = source
        self.target = target
        self.report = report
        self.now = datetime.datetime.now()

        # lookups 단계에서 채워짐
        self.menu_ids = {}
        self.organization_ids = {}
        self.boards = {}
        self.board_slugs = {}
        self.calendar_board = None
        self.legacy_board_counts = {}
        # users 단계에서 채워짐
        self.user_by_login = {}
        self.admin_logins = set()
        self.user_by_seq = {}
        # posts 단계에서 채워짐
        self.post_menu = {}


# 실행 순서 (--only 로 일부만 고를 수 있음)
STEPS = [
    ("schema", "신규 스키마 생성", schema.run),
    ("lookups", "메뉴 / 국·위원회 / 게시판", lookups.run),
    ("users", "회원 (mTb_Member2 -> User)", users.run),
    ("posts", "게시글 + 첨부파일 (BOARD_v1 -> Post/Attachment)", posts.run),
    ("rules-split", "회칙 및 세칙 3분할", rules_split.run),
    ("events", "행사 (calendar_events -> Event)", events.run),
    ("leftovers", "미이관 데이터 보존 (tbl_youtube, Reply)", leftovers.run),
]

# --only 로 뒷단계만 돌릴 때 반드시 먼저 채워야 하는 선행 단계
PREREQUISITES = {
    "posts": ["lookups", "users"],
    "rules-split": ["lookups"],
    "events": ["lookups"],
}


# =============================================================================
# CLI
# =============================================================================
def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="CAUGSA 레거시 DB를 신규 ERD 스키마로 마이그레이션합니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    src = parser.add_argument_group("소스 DB (기존 caugsa-website DB, 읽기 전용)")
    src.add_argument("--source-host")
    src.add_argument("--source-port", type=int)
    src.add_argument("--source-user")
    src.add_argument("--source-password")
    src.add_argument("--source-db")

    tgt = parser.add_argument_group("타깃 DB (신규 스키마)")
    tgt.add_argument("--target-host")
    tgt.add_argument("--target-port", type=int)
    tgt.add_argument("--target-user")
    tgt.add_argument("--target-password")
    tgt.add_argument("--target-db", help="기본값: <소스DB명>_v2")

    run = parser.add_argument_group("실행 옵션")
    run.add_argument("--dry-run", action="store_true",
                     help="소스를 읽고 변환까지만 하고 타깃에 쓰지 않는다")
    run.add_argument("--drop", dest="drop_existing", action="store_true",
                     help="타깃의 신규 테이블을 DROP 후 다시 생성한다")
    run.add_argument("--no-create-database", action="store_true",
                     help="타깃 DB 를 자동 생성하지 않는다")
    run.add_argument("--no-merge-events", action="store_true",
                     help="연속된 캘린더 일정을 하나의 행사로 합치지 않는다")
    run.add_argument("--only", help="실행할 단계 (쉼표 구분): %s" % ",".join(s[0] for s in STEPS))
    run.add_argument("--limit", type=int, help="테이블당 읽을 행 수 제한 (테스트용)")
    run.add_argument("--output-dir", help="리포트/덤프 저장 위치 (기본: CAU_MIGRATION/output)")
    run.add_argument("--export-ddl", action="store_true",
                     help="DB 접속 없이 신규 스키마 DDL 만 .sql 로 내보낸다")
    run.add_argument("--yes", "-y", action="store_true", help="확인 프롬프트 생략")
    run.add_argument("--verbose", "-v", action="store_true")

    args = parser.parse_args(argv)
    if args.only:
        names = {s[0] for s in STEPS}
        chosen = [s.strip() for s in args.only.split(",") if s.strip()]
        unknown = [s for s in chosen if s not in names]
        if unknown:
            parser.error("알 수 없는 단계: %s (사용 가능: %s)"
                         % (", ".join(unknown), ", ".join(sorted(names))))
        args.only = chosen
    return args


def confirm(settings):
    utils.banner("CAUGSA DB 마이그레이션")
    utils.log("  드라이버   : %s" % db.driver_name())
    utils.log("  소스 DB    : %s  (읽기 전용)" % settings.source)
    utils.log("  타깃 DB    : %s" % settings.target)
    utils.log("  모드       : %s" % ("DRY-RUN (쓰기 없음)" if settings.dry_run else "실행"))
    if settings.drop_existing:
        utils.log("  주의       : 타깃의 신규 테이블을 DROP 후 재생성합니다")
    utils.log("  비밀번호   : 이관하지 않음 (전 계정 로그인 불가)")
    utils.log("  산출물     : %s" % settings.output_dir)


def prompt_yes_no(question):
    if not sys.stdin or not sys.stdin.isatty():
        return True
    try:
        answer = input("%s [y/N] " % question).strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    return answer in ("y", "yes")


# =============================================================================
# 검증
# =============================================================================
def verify(ctx):
    """이관 후 소스/타깃 건수를 비교한다."""
    utils.banner("검증")
    source, target = ctx.source, ctx.target

    checks = []
    legacy_members = source.scalar("SELECT COUNT(*) FROM `%s`" % DEFINE.LEGACY_TABLES["member"])
    # 중복 아이디를 병합하므로 기대 건수는 "서로 다른 login_id 수" 다.
    expected_members = source.scalar(
        "SELECT COUNT(DISTINCT LOWER(TRIM(`strId`))) FROM `%s` "
        "WHERE `strId` IS NOT NULL AND TRIM(`strId`) <> ''"
        % DEFINE.LEGACY_TABLES["member"]
    ) if DEFINE.MERGE_DUPLICATE_LOGIN_IDS else legacy_members
    legacy_posts_all = source.scalar(
        "SELECT COUNT(*) FROM `%s`" % DEFINE.LEGACY_TABLES["board"])
    # 확정 방침에 따라 admin 작성 글만 이관하므로, 기대 건수도 같은 조건으로 센다.
    # 전체 건수와 비교하면 의도한 제외까지 "차이"로 잡혀 진짜 불일치가 묻힌다.
    admin_where = DEFINE.admin_post_where()
    legacy_posts = source.scalar(
        "SELECT COUNT(*) FROM `%s` b WHERE %s"
        % (DEFINE.LEGACY_TABLES["board"], admin_where)
    )
    checks.append(("회원", expected_members, target.count("User")))
    checks.append(("게시글", legacy_posts, target.count("Post")))

    file_expr = " + ".join(
        "(CASE WHEN b.`%s` IS NOT NULL AND TRIM(b.`%s`) <> '' THEN 1 ELSE 0 END)" % (c, c)
        for c in DEFINE.LEGACY_FILE_COLUMNS
    )
    legacy_files = source.scalar(
        "SELECT COALESCE(SUM(%s), 0) FROM `%s` b WHERE %s"
        % (file_expr, DEFINE.LEGACY_TABLES["board"], admin_where)
    )
    checks.append(("첨부파일", legacy_files, target.count("Attachment")))

    ok = True
    for label, before, after in checks:
        diff = (after or 0) - (before or 0)
        mark = "OK " if diff == 0 else "차이"
        if diff != 0:
            ok = False
        utils.log("  [%s] %-8s 소스 %6s -> 타깃 %6s  (%+d)" % (mark, label, before, after, diff))

    orphan_posts = target.scalar(
        "SELECT COUNT(*) FROM `Post` p "
        "LEFT JOIN `Board` b ON b.`id` = p.`board_type` WHERE b.`id` IS NULL"
    )
    orphan_files = target.scalar(
        "SELECT COUNT(*) FROM `Attachment` a "
        "LEFT JOIN `Post` p ON p.`id` = a.`post_id` WHERE p.`id` IS NULL"
    )
    null_writers = target.scalar("SELECT COUNT(*) FROM `Post` WHERE `writer` IS NULL")
    utils.log("  [%s] 게시판 없는 게시글 : %d" % ("OK " if not orphan_posts else "차이", orphan_posts))
    utils.log("  [%s] 게시글 없는 첨부파일: %d" % ("OK " if not orphan_files else "차이", orphan_files))
    utils.log("  [   ] 작성자 미연결 게시글: %d" % null_writers)

    utils.log("")
    utils.log("  게시판별 게시글 수")
    rows = target.fetch_all(
        "SELECT m.`name` AS menu, b.`name` AS board, COUNT(p.`id`) AS cnt "
        "FROM `Board` b "
        "JOIN `Menu` m ON m.`id` = b.`menu_id` "
        "LEFT JOIN `Post` p ON p.`board_type` = b.`id` "
        "GROUP BY b.`id` ORDER BY m.`name`, cnt DESC"
    )
    for row in rows:
        utils.log("      %-12s %-28s %5d" % (row["menu"], row["board"], row["cnt"]))

    if expected_members != legacy_members:
        utils.log("  [   ] 회원 원본 %d행 중 중복 아이디 %d행이 병합됨"
                  % (legacy_members, legacy_members - expected_members))

    ctx.report.add(
        "검증",
        회원_소스행=legacy_members, 회원_기대=expected_members, 회원_타깃=target.count("User"),
        게시글_소스전체=legacy_posts_all,
        게시글_소스_admin분=legacy_posts, 게시글_타깃=target.count("Post"),
        첨부파일_소스=legacy_files, 첨부파일_타깃=target.count("Attachment"),
        고아_게시글=orphan_posts, 고아_첨부파일=orphan_files,
        작성자_미연결=null_writers,
        건수_일치=bool(ok),
    )
    return ok


# =============================================================================
# 선행 단계 (--only 로 뒷단계만 돌릴 때 룩업 테이블만 메모리로 로드)
# =============================================================================
def preload(ctx, needed, selected=()):
    target = ctx.target
    # rules-split 은 자기가 쓸 게시판 3개를 직접 만들므로, 아직 없어도 진행한다.
    creates_own_boards = "rules-split" in selected
    if "lookups" in needed:
        ctx.menu_ids = {r["name"]: r["id"] for r in target.fetch_all("SELECT `id`,`name` FROM `Menu`")}
        ctx.organization_ids = {r["name"]: r["id"] for r in target.fetch_all("SELECT `id`,`name` FROM `Organization`")}
        ctx.board_by_name = {
            r["name"]: {"id": r["id"], "menu_id": r["menu_id"], "slug": r["slug"],
                        "organization_id": r["organization_id"],
                        "is_event": bool(r["is_event"])}
            for r in target.fetch_all(
                "SELECT `id`, `menu_id`, `organization_id`, `slug`, `name`, `is_event` "
                "FROM `Board`")
        }
        missing = [d["name"] for d in DEFINE.BOARD_DEFS if d["name"] not in ctx.board_by_name]
        if missing and not creates_own_boards:
            raise RuntimeError(
                "타깃에 게시판이 없습니다: %s\n"
                "  먼저 --only lookups (또는 전체 실행)로 마스터 데이터를 만드세요."
                % ", ".join(missing)
            )
        if missing:
            utils.log("  (선행) 아직 없는 게시판 %d건은 rules-split 단계가 만듭니다"
                      % len(missing))
        ctx.board_slugs = {d["slug"]: ctx.board_by_name[d["name"]]
                           for d in DEFINE.BOARD_DEFS if d["name"] in ctx.board_by_name}
        for code, name in DEFINE.LEGACY_BOARD_MAP.items():
            if name in ctx.board_by_name:
                ctx.boards[code] = ctx.board_by_name[name]
        ctx.calendar_board = ctx.board_by_name.get(DEFINE.CALENDAR_BOARD_NAME)
        utils.log("  (선행) Board %d건 / Menu %d건 로드"
                  % (len(ctx.board_by_name), len(ctx.menu_ids)))
    if "users" in needed:
        user_rows = target.fetch_all("SELECT `id`, `login_id`, `role` FROM `User`")
        ctx.user_by_login = {r["login_id"].lower(): r["id"] for r in user_rows}
        # posts 단계의 admin 필터가 --only posts 로 돌 때도 동작하도록 함께 채운다.
        ctx.admin_logins = {
            r["login_id"].lower() for r in user_rows
            if r["role"] in DEFINE.POST_KEEPER_ROLES
        }
        utils.log("  (선행) User %d건 로드 (admin %d건)"
                  % (len(ctx.user_by_login), len(ctx.admin_logins)))
    if "posts" in needed:
        ctx.post_menu = {
            r["id"]: r["menu_id"]
            for r in target.fetch_all("SELECT `id`, `menu_id` FROM `Post`")
        }
        utils.log("  (선행) Post %d건 로드" % len(ctx.post_menu))


# =============================================================================
# 엔트리포인트
# =============================================================================
def main(argv=None):
    utils.force_utf8_stdout()
    args = parse_args(argv)
    utils.set_verbose(args.verbose)

    # --export-ddl : DB 접속 없이 스키마만 내보낸다
    if args.export_ddl:
        out_dir = args.output_dir or config.OUTPUT_DIR
        path = schema.export_ddl(os.path.join(out_dir, "new_schema.sql"))
        utils.log("신규 스키마 DDL 저장: %s" % path)
        return 0

    try:
        db.driver_name()          # 드라이버 유무를 먼저 확인
        settings = config.build_settings(args)
    except (ValueError, RuntimeError) as exc:
        utils.log("설정 오류: %s" % exc)
        return 2

    confirm(settings)
    if not settings.dry_run and not args.yes:
        if not prompt_yes_no("\n위 설정으로 마이그레이션을 진행할까요?"):
            utils.log("취소했습니다.")
            return 1

    utils.ensure_dir(settings.output_dir)

    if not settings.dry_run and settings.create_database:
        db.ensure_database(settings.target)

    source = target = None
    report = utils.Report()
    exit_code = 0
    try:
        source = db.connect(settings.source, label="source")
        target = db.connect_target(settings.target, dry_run=settings.dry_run)
        ctx = Context(settings, source, target, report)

        selected = args.only or [name for name, _, _ in STEPS]

        # --only 로 뒷단계만 돌릴 때 필요한 선행 데이터를 메모리에 로드
        needed = set()
        for name in selected:
            for prereq in PREREQUISITES.get(name, []):
                if prereq not in selected:
                    needed.add(prereq)
        if needed:
            utils.step_header(0, len(selected), "선행 데이터 로드")
            preload(ctx, needed, selected)

        runnable = [s for s in STEPS if s[0] in selected]
        for index, (name, title, func) in enumerate(runnable, start=1):
            utils.step_header(index, len(runnable), title)
            func(ctx)

        if not settings.dry_run and "posts" in selected and "schema" in selected:
            verify(ctx)

        report.render()
        path = report.save(settings.output_dir)
        utils.log("  리포트: %s" % path)
        utils.log("")
        utils.log("완료. 신규 DB: %s" % settings.target)

    except Exception as exc:
        if target is not None:
            target.rollback()
        utils.log("")
        utils.log("!! 마이그레이션 실패: %s" % exc)
        if args.verbose:
            import traceback
            traceback.print_exc()
        exit_code = 1
    finally:
        for conn in (source, target):
            if conn is not None:
                conn.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
