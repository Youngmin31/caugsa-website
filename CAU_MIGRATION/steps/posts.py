# -*- coding: utf-8 -*-
"""
steps/posts.py
==============
BOARD_v1 -> Post + Attachment

컬럼 매핑
---------
  b_idx      -> Post.id           (PK 유지: 기존 URL/북마크 보존)
  b_title    -> Post.title
  b_text     -> Post.content
  userid     -> Post.writer       (User.login_id 로 조회, 없으면 NULL)
  b_part     -> Post.board_type   (Board.id 로 변환) + Post.menu_id
  b_writeday -> Post.created_at
  b_read     -> Post.view_count
  file_1..10 -> Attachment 행 (정렬 순서 1..10)

이관 대상
---------
확정 방침에 따라 운영진이 작성한 게시글만 이관한다. 판별 기준은
userid='admin' (레거시 create_board 하드코딩) 또는 작성자의 role 이
ADMIN·MANAGER (intGubun 9·6·5) 인 경우다. 학생 개인 작성분과 그
첨부파일 행은 생성하지 않는다. 소스 DB 의 BOARD_v1 은 읽기만 하므로
원본은 그대로 남는다.

레거시 BOARD_v1 은 첨부파일을 file_1 ~ file_10 컬럼에 원본 파일명으로만
보관한다. filetype/filesize 컬럼은 실데이터가 비어 있어 파일명 확장자에서
file_type 을 추론하고 file_size 는 NULL 로 둔다.
"""

import DEFINE
import utils

POST_SQL = (
    "INSERT INTO `Post` "
    "(`id`, `title`, `content`, `writer`, `board_type`, `menu_id`, "
    " `updated_at`, `created_at`, `view_count`, `is_notice`, `is_secret`) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
)

ATTACHMENT_SQL = (
    "INSERT INTO `Attachment` "
    "(`file_type`, `name`, `file_size`, `sort_order`, `created_at`, `post_id`, `menu_id`) "
    "VALUES (?, ?, ?, ?, ?, ?, ?)"
)


def run(ctx):
    source, target, settings = ctx.source, ctx.target, ctx.settings

    columns = [
        "b_idx", "b_part", "b_title", "b_text", "b_name", "userid",
        "b_writeday", "b_read", "re_level", "option_notice", "option_bimil",
    ] + DEFINE.LEGACY_FILE_COLUMNS
    select = ", ".join("`%s`" % c for c in columns)
    sql = "SELECT %s FROM `%s` ORDER BY `b_idx`" % (select, DEFINE.LEGACY_TABLES["board"])
    if settings.limit:
        sql += " LIMIT %d" % settings.limit

    post_rows = []
    attachment_rows = []
    skipped_no_board = 0
    skipped_not_admin = 0
    unknown_writers = []
    anonymous_posts = 0
    reply_posts = 0
    notice_count = 0
    secret_count = 0
    # ctx 에 저장해 events 단계에서 게시글 연결에 사용
    ctx.post_menu = {}

    for row in source.iter_rows(sql):
        post_id = utils.to_int(row.get("b_idx"))
        if post_id is None:
            skipped_no_board += 1
            continue

        code = utils.clean(row.get("b_part"))
        board = ctx.boards.get(code)
        if board is None:
            # 메뉴는 4개로 고정이라 미분류 게시판을 새로 만들지 않고
            # 지정된 기본 게시판으로 보낸다 (lookups 단계에서 경고 기록됨).
            board = ctx.board_by_name.get(DEFINE.FALLBACK_BOARD)
            if board is None:
                skipped_no_board += 1
                continue

        title = utils.truncate(utils.clean(row.get("b_title")) or "(제목 없음)", 255)
        content = utils.text(row.get("b_text"))
        created_at = utils.to_datetime(row.get("b_writeday")) or ctx.now
        view_count = utils.to_int(row.get("b_read"), 0) or 0

        login = utils.clean(row.get("userid"))
        login_key = login.lower() if login else None

        # 확정 방침: admin 이 작성한 글만 이관한다. 학생 작성분은 폐기.
        # 판별 기준 두 가지의 합집합:
        #   (1) userid = 'admin'
        #       레거시 app.py 의 create_board 가 @admin_required 아래에서
        #       userid 를 'admin' 으로 하드코딩했다. Flask 로 작성된 관리자
        #       글은 실제 작성자와 무관하게 전부 이 값이다.
        #   (2) 작성자의 role 이 DEFINE.POST_KEEPER_ROLES 에 있음
        #       (intGubun 9=ADMIN, 6·5=MANAGER). Flask 이전 시스템 시절
        #       글은 실제 아이디가 남아 있다.
        # MANAGER 작성분도 유지한다. 개인 게시물이 아니라 사물함 신청 안내·
        # 규찰대 모집 같은 위원회 공식 공지이고, api_v2 도 MANAGER 를 ADMIN 과
        # 동일 권한으로 취급한다.
        if not (login_key == DEFINE.LEGACY_ADMIN_LOGIN
                or (login_key is not None and login_key in ctx.admin_logins)):
            skipped_not_admin += 1
            continue

        if login:
            writer = ctx.user_by_login.get(login_key)
            if writer is None:
                # userid='admin' 이 회원 테이블에 실계정으로 없는 경우가 여기 걸린다.
                # 글은 살리고 작성자만 비운다 (Post.writer 는 NULL 허용).
                unknown_writers.append({
                    "b_idx": post_id,
                    "userid": login,
                    "b_name": utils.clean(row.get("b_name")),
                    "b_title": title,
                })
        else:
            writer = None
            anonymous_posts += 1

        if utils.to_int(row.get("re_level"), 0):
            reply_posts += 1

        # 레거시는 체크박스를 -1(참) / 0·NULL(거짓)로 저장했다. (ASP 시절 관습)
        is_notice = (1 if utils.to_int(row.get("option_notice"), 0)
                     in DEFINE.LEGACY_TRUE_VALUES else 0)
        is_secret = (1 if utils.to_int(row.get("option_bimil"), 0)
                     in DEFINE.LEGACY_TRUE_VALUES else 0)
        notice_count += is_notice
        secret_count += is_secret

        post_rows.append((
            post_id,
            title,
            content,
            writer,
            board["id"],
            board["menu_id"],
            None,           # updated_at : 레거시에 수정일 컬럼이 없음
            created_at,
            view_count,
            is_notice,
            is_secret,
        ))
        ctx.post_menu[post_id] = board["menu_id"]

        order = 0
        for column in DEFINE.LEGACY_FILE_COLUMNS:
            filename = utils.clean(row.get(column))
            if not filename:
                continue
            order += 1
            attachment_rows.append((
                utils.file_type_of(filename),
                utils.truncate(filename, 255),
                None,          # file_size : 레거시 filesize 컬럼이 비어 있음
                order,
                created_at,
                post_id,
                board["menu_id"],
            ))

    if settings.dry_run:
        utils.log("  [dry-run] Post %d건 / Attachment %d건 INSERT 생략"
                  % (len(post_rows), len(attachment_rows)))
    else:
        for table, count in target.purge(["Attachment", "Post"]).items():
            utils.log("  기존 %s %d건 삭제 후 재적재" % (table, count))
        inserted_posts = target.insert_many(POST_SQL, post_rows)
        target.commit()
        utils.log("  Post          : %d건 이관" % inserted_posts)
        inserted_files = target.insert_many(ATTACHMENT_SQL, attachment_rows)
        target.commit()
        utils.log("  Attachment    : %d건 이관" % inserted_files)

    if unknown_writers:
        utils.dump_json(
            "%s/unknown_post_writers.json" % settings.output_dir,
            unknown_writers,
        )
        ctx.report.warn(
            "회원 테이블에 없는 작성자의 게시글 %d건 -> writer=NULL 로 이관. "
            "output/unknown_post_writers.json 참고." % len(unknown_writers)
        )
    if anonymous_posts:
        ctx.report.warn(
            "작성자 아이디가 비어 있는 게시글 %d건 -> writer=NULL. "
            "신규 Post 에는 비회원 작성자명 컬럼이 없어 b_name 은 이관되지 않습니다."
            % anonymous_posts
        )
    if skipped_not_admin:
        ctx.report.warn(
            "admin 이 작성하지 않은 게시글 %d건을 이관하지 않았습니다 "
            "(확정 방침: admin 작성 글만 유지). 해당 게시글의 첨부파일 행도 "
            "생성하지 않았습니다. 원본 BOARD_v1 은 소스 DB 에 그대로 남아 "
            "있습니다." % skipped_not_admin
        )

    return ctx.report.add(
        "게시글 (BOARD_v1 -> Post/Attachment)",
        게시글_이관=len(post_rows),
        첨부파일_이관=len(attachment_rows),
        admin외_작성자_제외=skipped_not_admin,
        게시판_미확인_제외=skipped_no_board,
        작성자_미확인=len(unknown_writers),
        작성자_없음=anonymous_posts,
        답글_게시글=reply_posts,
        공지글=notice_count,
        비밀글=secret_count,
    )
