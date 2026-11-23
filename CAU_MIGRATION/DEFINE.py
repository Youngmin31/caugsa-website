# -*- coding: utf-8 -*-
"""
DEFINE.py
=========
마이그레이션에 필요한 모든 "정의(definition)"를 모아 둔 모듈.

  * 신규 DB 스키마 DDL          (ERD 기준)
  * 레거시 -> 신규 값 매핑 규칙
  * 메뉴 / 국·위원회 / 게시판 마스터 데이터

여기에 있는 값만 고치면 코드 수정 없이 마이그레이션 결과를 바꿀 수 있다.
"""

# =============================================================================
# 1. 레거시(기존) 테이블
# =============================================================================
LEGACY_TABLES = {
    "board": "BOARD_v1",
    "reply": "Reply",
    "member": "mTb_Member2",
    "calendar": "calendar_events",
    "youtube": "tbl_youtube",
}

# BOARD_v1 의 첨부파일 컬럼 (정렬 순서 = 리스트 순서)
LEGACY_FILE_COLUMNS = ["file_%d" % i for i in range(1, 11)]

# =============================================================================
# 2. 신규 테이블
# =============================================================================
# 생성 순서 (FK 의존성 순서). 삭제는 이 리스트의 역순.
NEW_TABLES = [
    "Menu",
    "Organization",
    "User",
    "Board",
    "Post",
    "Event",
    "Attachment",
]

# -----------------------------------------------------------------------------
# 스키마 DDL
# -----------------------------------------------------------------------------
# ERD 와의 의도적인 차이점 (README.md 에도 동일 내용 기재):
#
#  1) ERD 의 `id2 (메뉴)` 컬럼 -> `menu_id` 로 명명.
#     `id2` 는 ERD 툴이 복합 외래키를 전파하면서 자동 생성한 이름이라
#     실제 스키마에서는 의미가 드러나는 이름을 사용한다.
#  2) ERD 의 `Board.organization (VARCHAR)` -> `organization_id INT`.
#     Organization.id 가 INT 이므로 FK 로 성립하려면 INT 여야 한다.
#  3) 복합 FK (board_type, menu_id) -> Board(id, menu_id) 를 성립시키기 위해
#     Board / Post 에 UNIQUE(id, menu_id) 보조 유니크 키를 추가했다.
# -----------------------------------------------------------------------------
CHARSET_CLAUSE = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"

SCHEMA_DDL = {}

SCHEMA_DDL["Menu"] = """
CREATE TABLE `Menu` (
  `id`   INT          NOT NULL AUTO_INCREMENT COMMENT '메뉴',
  `name` VARCHAR(100) NOT NULL                COMMENT '이름',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_name` (`name`)
) {charset} COMMENT='메뉴'
""".strip()

SCHEMA_DDL["Organization"] = """
CREATE TABLE `Organization` (
  `id`   INT          NOT NULL AUTO_INCREMENT COMMENT '기관',
  `name` VARCHAR(100) NOT NULL                COMMENT '이름',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_organization_name` (`name`)
) {charset} COMMENT='국위원회'
""".strip()

SCHEMA_DDL["User"] = """
CREATE TABLE `User` (
  `id`          INT          NOT NULL AUTO_INCREMENT COMMENT '유저 아이디',
  `login_id`    VARCHAR(50)  NOT NULL                COMMENT '로그인 아이디',
  `password`    VARCHAR(255) NOT NULL                COMMENT '비밀번호',
  `name`        VARCHAR(50)  NOT NULL                COMMENT '이름',
  `email`       VARCHAR(100)     NULL                COMMENT '이메일',
  `sub_email`   VARCHAR(100)     NULL                COMMENT '예비이메일',
  `student_id`  VARCHAR(20)      NULL                COMMENT '학번',
  `mobile`      VARCHAR(30)      NULL                COMMENT '전화번호',
  `role`        VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT '역할',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입일',
  `college`     VARCHAR(50)      NULL                COMMENT '단과대학',
  `major`       VARCHAR(50)      NULL                COMMENT '학과',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_login_id` (`login_id`),
  KEY `ix_user_role` (`role`)
) {charset} COMMENT='회원'
""".strip()

SCHEMA_DDL["Board"] = """
CREATE TABLE `Board` (
  `id`              INT          NOT NULL AUTO_INCREMENT COMMENT '게시판',
  `menu_id`         INT          NOT NULL                COMMENT '메뉴',
  `organization_id` INT              NULL                COMMENT '주관 기관',
  `slug`            VARCHAR(50)  NOT NULL                COMMENT 'URL 식별자',
  `name`            VARCHAR(100) NOT NULL                COMMENT '이름',
  `is_event`        TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '행사 여부',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_board_slug` (`slug`),
  UNIQUE KEY `uq_board_id_menu` (`id`, `menu_id`),
  KEY `ix_board_menu` (`menu_id`),
  KEY `ix_board_organization` (`organization_id`),
  CONSTRAINT `fk_board_menu`
    FOREIGN KEY (`menu_id`) REFERENCES `Menu` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_board_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `Organization` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) {charset} COMMENT='게시판'
""".strip()

SCHEMA_DDL["Post"] = """
CREATE TABLE `Post` (
  `id`         INT          NOT NULL AUTO_INCREMENT COMMENT '게시글',
  `title`      VARCHAR(255) NOT NULL                COMMENT '제목',
  `content`    LONGTEXT         NULL                COMMENT '내용',
  `writer`     INT              NULL                COMMENT '유저 아이디',
  `board_type` INT          NOT NULL                COMMENT '게시판 종류',
  `menu_id`    INT          NOT NULL                COMMENT '메뉴',
  `updated_at` DATETIME         NULL                COMMENT '수정일',
  `created_at` DATETIME     NOT NULL                COMMENT '작성일',
  `view_count` INT          NOT NULL DEFAULT 0      COMMENT '조회수',
  `is_notice`  TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '공지 여부',
  `is_secret`  TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '비밀글 여부',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_post_id_menu` (`id`, `menu_id`),
  KEY `ix_post_notice` (`board_type`, `is_notice`, `created_at`),
  KEY `ix_post_writer` (`writer`),
  KEY `ix_post_board` (`board_type`, `created_at`),
  CONSTRAINT `fk_post_writer`
    FOREIGN KEY (`writer`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_post_board`
    FOREIGN KEY (`board_type`, `menu_id`) REFERENCES `Board` (`id`, `menu_id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) {charset} COMMENT='게시글'
""".strip()

SCHEMA_DDL["Event"] = """
CREATE TABLE `Event` (
  `id`              INT          NOT NULL AUTO_INCREMENT COMMENT '행사',
  `organization_id` INT              NULL                COMMENT '주관기관',
  `post_id`         INT              NULL                COMMENT '게시글',
  `menu_id`         INT              NULL                COMMENT '메뉴',
  `is_visible`      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '캘린더 표시 여부',
  `apply_due`       DATE             NULL                COMMENT '신청 마감일',
  `start_date`      DATE             NULL                COMMENT '행사 시작일',
  `end_date`        DATE             NULL                COMMENT '행사 종료일',
  `name`            VARCHAR(255) NOT NULL                COMMENT '행사 이름',
  PRIMARY KEY (`id`),
  KEY `ix_event_organization` (`organization_id`),
  KEY `ix_event_post` (`post_id`, `menu_id`),
  KEY `ix_event_period` (`start_date`, `end_date`),
  CONSTRAINT `fk_event_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `Organization` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_event_post`
    FOREIGN KEY (`post_id`, `menu_id`) REFERENCES `Post` (`id`, `menu_id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) {charset} COMMENT='행사'
""".strip()

SCHEMA_DDL["Attachment"] = """
CREATE TABLE `Attachment` (
  `id`         INT          NOT NULL AUTO_INCREMENT COMMENT '고유번호',
  `file_type`  VARCHAR(50)      NULL                COMMENT '파일종류',
  `name`       VARCHAR(255) NOT NULL                COMMENT '원본 파일명',
  `file_size`  INT              NULL                COMMENT '용량',
  `sort_order` INT          NOT NULL DEFAULT 0      COMMENT '정렬 순서',
  `created_at` DATETIME     NOT NULL                COMMENT '생성일자',
  `post_id`    INT          NOT NULL                COMMENT '게시글',
  `menu_id`    INT          NOT NULL                COMMENT '메뉴',
  PRIMARY KEY (`id`),
  KEY `ix_attachment_post` (`post_id`, `sort_order`),
  CONSTRAINT `fk_attachment_post`
    FOREIGN KEY (`post_id`, `menu_id`) REFERENCES `Post` (`id`, `menu_id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) {charset} COMMENT='첨부파일'
""".strip()


def ddl_for(table):
    """테이블 생성 DDL 반환."""
    return SCHEMA_DDL[table].format(charset=CHARSET_CLAUSE)


# =============================================================================
# 3. 메뉴 (Menu)
# =============================================================================
# 신규 사이트 상단 메뉴 4개.
MENU_INTRO = "총학생회 소개"
MENU_BOARD = "총학생회 게시판"
MENU_AUTONOMY = "학생 자치"
MENU_INFO = "정보 마당"

MENUS = [
    MENU_INTRO,
    MENU_BOARD,
    MENU_AUTONOMY,
    MENU_INFO,
]

# =============================================================================
# 4. 국 / 위원회 (Organization)
# =============================================================================
ORG_CENTRAL = "중앙집행위원회"
ORG_EDU = "교육자치국"
ORG_UNITY = "연대사업국"
ORG_LIFE = "일상사업국"
ORG_STRATEGY = "전략정책국"
ORG_PROMO = "홍보소통국"
ORG_ACCOUNTING = "회계사무국"
ORG_CULTURE = "문화위원회"
ORG_GRADUATION = "졸업준비위원회"
ORG_WELFARE = "학생복지위원회"
ORG_HUMAN_RIGHTS = "학생인권위원회"
ORG_CLUB_UNION = "동아리연합회"
ORG_GSA = "총학생회"

ORGANIZATIONS = [
    ORG_GSA,
    ORG_CENTRAL,
    ORG_EDU,
    ORG_UNITY,
    ORG_LIFE,
    ORG_STRATEGY,
    ORG_PROMO,
    ORG_ACCOUNTING,
    ORG_CULTURE,
    ORG_GRADUATION,
    ORG_WELFARE,
    ORG_HUMAN_RIGHTS,
    ORG_CLUB_UNION,
]

# =============================================================================
# 5. 게시판 (Board)
# =============================================================================
# 신규 사이트의 게시판 정의. 메뉴 4개 아래 11개 게시판.
#
# slug     : 프론트 URL 식별자
# name     : 화면에 노출되는 게시판 이름
# menu     : 소속 메뉴
# is_event : 행사 게시판 여부 (Event 와 연결될 수 있는 게시판)
BOARD_DEFS = [
    # --- 총학생회 소개 (정적 소개 페이지. 레거시 게시글 없음) ---
    dict(slug="greeting",     name="총학생회 회장단 인사말", menu=MENU_INTRO, organization=ORG_GSA, is_event=False),
    dict(slug="organization", name="조직 및 업무",       menu=MENU_INTRO, organization=ORG_GSA, is_event=False),
    dict(slug="location",     name="오시는 길",          menu=MENU_INTRO, organization=ORG_GSA, is_event=False),

    # --- 총학생회 게시판 ---
    dict(slug="projects", name="참여 행사",     menu=MENU_BOARD, organization=ORG_GSA, is_event=True),
    dict(slug="pledges",  name="공약 이행 보고", menu=MENU_BOARD, organization=ORG_GSA, is_event=False),

    # --- 학생 자치 ---
    dict(slug="minutes",    name="회의록",       menu=MENU_AUTONOMY, organization=ORG_CENTRAL,    is_event=False),
    # 회칙 및 세칙은 주체별 3개 게시판으로 나뉜다. 프론트는 /autonomy/rules 한 페이지
    # 안에서 탭으로 보여주지만 DB·API 상으로는 독립된 게시판이다.
    dict(slug="rules-council",    name="회칙 및 세칙 - 총학생회",   menu=MENU_AUTONOMY, organization=ORG_GSA,        is_event=False),
    dict(slug="rules-club-union", name="회칙 및 세칙 - 동아리연합회", menu=MENU_AUTONOMY, organization=ORG_CLUB_UNION, is_event=False),
    dict(slug="rules-college",    name="회칙 및 세칙 - 단과대학",   menu=MENU_AUTONOMY, organization=ORG_GSA,        is_event=False),
    dict(slug="accounting", name="회계 자료",    menu=MENU_AUTONOMY, organization=ORG_ACCOUNTING, is_event=False),

    # --- 정보 마당 ---
    dict(slug="affiliate", name="제휴", menu=MENU_INFO, organization=ORG_WELFARE, is_event=False),
    dict(slug="venue",     name="대관", menu=MENU_INFO, organization=ORG_GSA,     is_event=False),
    dict(slug="rental",    name="대여", menu=MENU_INFO, organization=ORG_WELFARE, is_event=False),
    dict(slug="faq",       name="FAQ", menu=MENU_INFO, organization=ORG_GSA,     is_event=False),
]

# -----------------------------------------------------------------------------
# 레거시 게시판 코드(BOARD_v1.b_part) -> 신규 게시판 이름
# -----------------------------------------------------------------------------
# 레거시는 게시판을 국·위원회 단위로 쪼개 두었으나 신규 구조는 주제 단위라
# 여러 레거시 게시판이 하나의 신규 게시판으로 합쳐진다.
# 각 코드의 정체는 실제 백업 DB 의 게시글 제목으로 확인했다. (주석의 건수 기준)
LEGACY_BOARD_MAP = {
    # --- 진행사업 : 각 국·위원회의 사업/소식 공지 (총 445건) ---
    "board6":  "참여 행사",   # 221건 중앙집행위원회 소식
    "board7":  "참여 행사",   # 107건 학생복지위원회 (규찰대 모집, 천원의 아침빵)
    "board10": "참여 행사",   #  26건 성평등위원회
    "board8":  "참여 행사",   #  19건 문화위원회 (토크콘서트, LoL 대회)
    "board2":  "참여 행사",   #  16건 스터디/공모전 프로그램
    "board26": "참여 행사",   #  13건 중앙동아리 소개
    "board42": "참여 행사",   #  11건 전략정책국
    "board25": "참여 행사",   #   9건 학사 안내 (폐강, 강의평가)
    "board44": "참여 행사",   #   6건 일상사업국
    "board32": "참여 행사",   #   4건 학생인권위원회
    "board9":  "참여 행사",   #   4건 졸업준비위원회 (학위복 대여, 채용)
    "board41": "참여 행사",   #   4건 교육자치국
    "board43": "참여 행사",   #   3건 연대사업국
    "board40": "참여 행사",   #   1건 홍보소통국
    "board29": "참여 행사",   #   1건 다전공 자료집

    # --- 회의록 (총 476건) ---
    "board19": "회의록",     # 384건 중앙운영위원회 회의록
    "board11": "회의록",     #  92건 전체학생대표자회의 결과보고/속기록


    # --- 회칙 및 세칙 (총 92건) ---
    "board18": "회칙 및 세칙 - 총학생회",  # 47건 총학생회 회칙/선거시행세칙/예산자치제
    "board17": "회칙 및 세칙 - 단과대학",  # 45건 단과대학 학생회칙 (동아리연합회 4건 포함)

    # --- 회계 자료 (총 116건) ---
    "board20": "회계 자료",  # 116건 월별 회계 보고

    # --- 대관 (총 88건) : 시안의 '대관' 게시판이 공간조정회의 안내/결과 글이다 ---
    "board22": "대관",       #  88건 공간조정회의 진행/결과

    # --- 제휴 (총 30건) ---
    "board27": "제휴",       #  30건 제휴 안내

    # --- 대여 (총 338건) ---
    "board23": "대여",       # 270건 중앙도서관 사물함 신청/철거 공지
    "board24": "대여",       #  57건 사물함 철거 요청 글
    "board3":  "대여",       #  11건 대여 및 상주 사업 안내

    # --- FAQ (총 5건) ---
    "board21": "FAQ",        #   4건 사물함/공간조정 문의 글
    "board30": "FAQ",        #   1건 대학원생 사물함 신청 문의
}

# LEGACY_BOARD_MAP 에 없는 b_part 가 나오면 이 게시판으로 보낸다.
# (메뉴는 4개로 고정이므로 "미분류" 메뉴를 새로 만들지 않는다.)
FALLBACK_BOARD = "참여 행사"

# -----------------------------------------------------------------------------
# 회칙 및 세칙 3분할 규칙 (steps/rules_split.py)
# -----------------------------------------------------------------------------
# b_part 만으로는 나눌 수 없는 경우가 하나 있다. 레거시 board17(45건) 안에
# 동아리연합회 회칙 4건이 단과대학 회칙과 섞여 있어 제목으로 가려낸다.
# board18(47건)에는 '동아리연합회'/'대학 학생회칙' 제목이 하나도 없어 안전하다.
#
#   (레거시코드, 제목키워드 또는 None, 신규 게시판명)
# 위에서부터 먼저 맞는 규칙을 적용한다.
RULES_SPLIT_RULES = [
    ("board18", None,        "회칙 및 세칙 - 총학생회"),
    ("board17", "동아리연합회", "회칙 및 세칙 - 동아리연합회"),
    ("board17", None,        "회칙 및 세칙 - 단과대학"),
]

# 3분할로 만들어지는 게시판 slug (프론트 탭 순서와 같다)
RULES_BOARD_SLUGS = ["rules-council", "rules-club-union", "rules-college"]

# calendar_events 로 만들어진 Event 의 기본 소속 게시판
CALENDAR_BOARD_NAME = "참여 행사"

# =============================================================================
# 6. 값 변환 규칙
# =============================================================================
ROLE_ADMIN = "ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_USER = "USER"

# mTb_Member2.intGubun -> User.role
GUBUN_TO_ROLE = {
    9: ROLE_ADMIN,     # 관리자 (backend/app.py: intGubun == 9 -> admin)
    6: ROLE_MANAGER,   # 운영진
    5: ROLE_MANAGER,   # 운영진
    1: ROLE_USER,      # 일반 회원
    0: ROLE_USER,
}
DEFAULT_ROLE = ROLE_USER

# 이관 계정의 password 자리에 넣는 "로그인 불가" 표식.
#
# 백엔드(app.py password_matches / api_v2 _verify_password)는 저장값이
# scrypt:/pbkdf2: 로 시작할 때만 check_password_hash 를 태우고, 그 외에는
# 무조건 False 를 돌려준다. 따라서 접두를 붙여 해시 검증 경로로 보내되
# 형식을 깨뜨려 어떤 입력과도 매칭되지 않게 한다.
#
# 접두 없는 값(예: "!")을 쓰면 안 된다. 평문 비교 폴백이 있던 시절에는
# 저장값 문자열 자체가 그대로 비밀번호가 되어 전 계정이 뚫렸다.
# 폴백은 제거했지만 이 값은 그와 무관하게 안전하도록 고른 것이다.
#
# 미이관 계정 식별: WHERE password LIKE '%$migrated$%'
NOLOGIN_PASSWORD = "scrypt:32768:8:1$migrated$nologin"

# 레거시 app.py 의 create_board 가 작성자로 하드코딩한 값.
#     name = "관리자"; userid = "admin"
# @admin_required 아래에 있어 실제로 관리자만 쓸 수 있었지만, 어느 관리자가
# 썼는지는 기록되지 않는다. 게시글 이관 필터의 1차 기준.
LEGACY_ADMIN_LOGIN = "admin"

# 게시글을 유지할 작성자의 role.
# ADMIN 뿐 아니라 MANAGER(국·위원회 담당자)도 포함한다. 이들이 쓴 글은 개인
# 게시물이 아니라 사물함 신청 안내·규찰대 모집 같은 위원회 공식 공지이고,
# 실제로 api_v2 는 MANAGER 를 ADMIN 과 동일 권한으로 취급한다(helpers.py).
POST_KEEPER_ROLES = (ROLE_ADMIN, ROLE_MANAGER)

# 위 role 로 매핑되는 intGubun 값 (9=ADMIN, 6·5=MANAGER).
# 게시글 이관 대상 판별과 검증 단계의 기대 건수가 같은 기준을 쓰도록
# 여기서 한 번만 정의한다.
ADMIN_GUBUN_VALUES = sorted(
    g for g, r in GUBUN_TO_ROLE.items() if r in POST_KEEPER_ROLES
)

# 이관 대상 게시글(admin 작성분)을 고르는 WHERE 절.
# BOARD_v1 은 utf8mb4, mTb_Member2 는 utf8 이라 그냥 비교하면
# "Illegal mix of collations" 가 난다. 양쪽을 utf8mb4 로 맞춘다.
ADMIN_POST_WHERE = """
    LOWER(TRIM(b.`userid`)) = '%s'
 OR CONVERT(LOWER(TRIM(b.`userid`)) USING utf8mb4) COLLATE utf8mb4_general_ci IN (
        SELECT CONVERT(LOWER(TRIM(m.`strId`)) USING utf8mb4) COLLATE utf8mb4_general_ci
        FROM `%s` m WHERE m.`intGubun` IN (%s)
    )
""".strip()


def admin_post_where():
    """검증 단계에서 쓸 '이관 대상 게시글' WHERE 절을 만든다."""
    return ADMIN_POST_WHERE % (
        LEGACY_ADMIN_LOGIN,
        LEGACY_TABLES["member"],
        ", ".join(str(g) for g in ADMIN_GUBUN_VALUES),
    )

# 승인여부(intCertify) / 탈퇴표시(intAction) 는 신규 ERD 에서 제외되어
# 이관하지 않는다. 가입 즉시 로그인 가능하다.

# 레거시 데이터에 문자열로 들어있는 "NULL" / 공백 등을 NULL 로 취급
NULLISH_STRINGS = {
    "", "null", "NULL", "none", "None", "-",
    "0000-00-00", "0000-00-00 00:00:00",
}

# 학번 추정: login_id 가 이 길이의 순수 숫자면 학번으로 간주
STUDENT_ID_DIGIT_LENGTHS = {8}

# -----------------------------------------------------------------------------
# 중복 login_id 처리
# -----------------------------------------------------------------------------
# 레거시 mTb_Member2 에는 strId 중복이 97종 / 114행 존재한다. 실제 백업 DB 를
# 확인한 결과 전부 "같은 사람이 회원가입 폼을 여러 번 제출한 것"이었다.
#   - 97개 그룹 모두 이름·전화번호가 동일
#   - 85개 그룹은 비밀번호·이메일까지 완전히 동일
#   - 나머지 12개도 재제출 시 전화번호가 빠지거나 오타를 고친 정도의 차이
#   - 87개 그룹이 1시간 이내, 42개는 1분 이내에 재제출
# 따라서 접미사를 붙여 별도 계정으로 남기지 않고 하나로 병합한다.
MERGE_DUPLICATE_LOGIN_IDS = True

# 병합 규칙:
#   id         = 가장 작은 intSeq (최초 가입 계정)
#   created_at = 가장 이른 가입일
#   그 외 필드 = 값이 있는 행 중 가장 최근(intSeq 가 큰) 값
#                -> 재제출로 값이 비어버린 경우에도 정보를 잃지 않는다
#   role       = 그룹 내 최고 권한
ROLE_PRIORITY = {ROLE_ADMIN: 3, ROLE_MANAGER: 2, ROLE_USER: 1}

# 병합하지 않을 때(MERGE_DUPLICATE_LOGIN_IDS = False) 뒤쪽 계정에 붙일 접미사
DUPLICATE_LOGIN_ID_SUFFIX = "__dup{n}"

# -----------------------------------------------------------------------------
# 게시글 플래그 (API 명세: 게시글 목록의 isNotice, 비밀글 기능)
# -----------------------------------------------------------------------------
# 레거시는 체크박스를 -1(=참) / 0·NULL(=거짓)로 저장했다. (ASP 시절 관습)
#   option_notice : -1 -> 공지글   (백업 기준 15건)
#   option_bimil  : -1 -> 비밀글   (백업 기준  4건)
LEGACY_TRUE_VALUES = {-1, 1}

# 첨부파일 확장자 -> file_type
EXTENSION_TO_TYPE = {
    "jpg": "image", "jpeg": "image", "png": "image", "gif": "image",
    "bmp": "image", "webp": "image", "svg": "image", "heic": "image",
    "pdf": "pdf",
    "hwp": "document", "hwpx": "document", "doc": "document", "docx": "document",
    "txt": "document", "rtf": "document", "odt": "document",
    "xls": "spreadsheet", "xlsx": "spreadsheet", "csv": "spreadsheet",
    "ppt": "presentation", "pptx": "presentation",
    "zip": "archive", "rar": "archive", "7z": "archive", "tar": "archive", "gz": "archive",
    "mp4": "video", "mov": "video", "avi": "video", "wmv": "video", "mkv": "video",
    "mp3": "audio", "wav": "audio", "m4a": "audio",
}
DEFAULT_FILE_TYPE = "etc"

# =============================================================================
# 7. 신규 ERD 에 대응 테이블이 없어 이관하지 않는 레거시 테이블
# =============================================================================
# 데이터를 버리지 않기 위해 JSON 으로 덤프해 둔다. (steps/leftovers.py)
UNMIGRATED_TABLES = [
    ("tbl_youtube", "유튜브 링크 - 신규 ERD 에도 API 명세에도 대응 항목이 없음"),
    ("Reply", "댓글 - 신규 ERD 에 대응 테이블이 없음 (Comment 테이블 제거로 미이관 전환)"),
]

# 배치 INSERT 크기
INSERT_CHUNK_SIZE = 500
