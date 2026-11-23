# CAU_MIGRATION

기존 `caugsa-website` DB(레거시 게시판 구조)를 새 ERD 스키마로 이관하는 스크립트.

소스 DB는 **읽기만** 하고, 결과는 **별도의 새 DB**에 만든다. 기존 서비스 DB는 변경되지 않는다.

## 실행

```bash
# caugsa-website 안에서
cd caugsa-website
python scripts/migrate.py --dry-run     # 먼저 확인 (쓰기 없음)
python scripts/migrate.py               # 실제 실행

# 또는 CAU_MIGRATION 에서 직접
python CAU_MIGRATION/main.py --dry-run
python CAU_MIGRATION/main.py
```

`scripts/migrate.py` 는 `CAU_MIGRATION/main.py` 를 그대로 호출하는 런처이며 옵션도 동일하다.

### 주요 옵션

| 옵션 | 설명 |
|---|---|
| `--dry-run` | 소스를 읽고 변환까지만 수행, 타깃에 쓰지 않음 |
| `--drop` | 타깃의 신규 테이블을 DROP 후 재생성 (재실행 시 사용) |
| `--no-hash-passwords` | 비밀번호를 해시하지 않고 평문 그대로 이관 (기본은 **해시 변환**) |
| `--only users,posts` | 특정 단계만 실행 |
| `--limit 100` | 테이블당 읽을 행 수 제한 (테스트용) |
| `--no-merge-events` | 연속 캘린더 일정을 하나의 행사로 합치지 않음 |
| `--export-ddl` | DB 접속 없이 신규 스키마 DDL 만 `output/new_schema.sql` 로 출력 |
| `--source-*`, `--target-*` | 접속 정보 직접 지정 |
| `-y`, `--yes` | 확인 프롬프트 생략 |

### 접속 정보

우선순위: 기본값 → `caugsa-website/backend/.env` → `CAU_MIGRATION/.env` → 환경변수 → CLI 인자

- **소스 DB**: `DB_*` 또는 `SRC_DB_*` (기존 사이트 DB)
- **타깃 DB**: `TGT_DB_*`. 지정하지 않으면 `<소스DB명>_v2` (예: `caugsa_local_v2`)를 자동 생성

`.env.example` 을 `.env` 로 복사해서 쓰면 된다. 소스와 타깃이 같으면 실행을 거부한다.

## 이관 매핑

### mTb_Member2 → User

| 레거시 | 신규 | 비고 |
|---|---|---|
| `intSeq` | `id` | PK 유지 (게시글 작성자 연결에 사용) |
| `strId` | `login_id` | |
| `strPwd` | `password` | **기본으로 해시 변환** (werkzeug scrypt). `--no-hash-passwords` 로 평문 유지 |
| `strName` | `name` | |
| `strEmail` / `strEmail2` | `email` / `sub_email` | `@` 가 있는 쪽을 주 이메일로 승격 |
| `strMobil`(없으면 `strPhone`) | `mobile` | `010-0000-0000` 형태로 정규화 |
| `intGubun` | `role` | 9→`ADMIN`, 5·6→`MANAGER`, 그 외→`USER` |
| `intCertify` | `is_approved` | 1이면 승인. `intAction=2`(탈퇴/차단)면 해제 |
| `dtmInsertDate` | `created_at` | |
| — | `student_id` | 레거시에 학번 컬럼이 없음. `login_id` 가 8자리 숫자면 추정 |
| — | `college`, `major` | 레거시에 없음 → `NULL` |

### BOARD_v1 → Post + Attachment

| 레거시 | 신규 | 비고 |
|---|---|---|
| `b_idx` | `Post.id` | PK 유지 (기존 링크 보존) |
| `b_title` / `b_text` | `title` / `content` | |
| `userid` | `writer` | `User.login_id` 로 조회, 없으면 `NULL` |
| `b_part` | `board_type` + `menu_id` | `board6` 등 코드 → `Board.id` |
| `b_writeday` | `created_at` | |
| `b_read` | `view_count` | |
| `file_1` … `file_10` | `Attachment` 행 | `sort_order` 1~10, 확장자로 `file_type` 추론 |
| — | `updated_at` | 레거시에 수정일 없음 → `NULL` |

### 중복 로그인 아이디 병합

레거시 `strId` 에는 중복이 **97종 / 114행**(공백 차이까지 포함하면 98종 / 115행) 있는데,
실제 백업 DB를 확인한 결과 **전부 같은 사람이 회원가입 폼을 여러 번 제출한 것**이었다.

- 98개 그룹 **모두** 이름·전화번호가 동일
- 85개 그룹은 비밀번호·이메일까지 완전히 동일
- 나머지는 재제출 때 전화번호가 빠지거나 이메일 오타를 고친 정도의 차이
- 87개 그룹이 1시간 이내, 42개는 **1분 이내**에 재제출

따라서 접미사를 붙여 별도 계정으로 남기지 않고 **하나로 병합**한다 (6,938행 → 6,823계정).

| 필드 | 병합 규칙 |
|---|---|
| `id`, `created_at` | 가장 이른(최초 가입) 계정 |
| 그 외 필드 | 값이 있는 행 중 **가장 최근** 값 (재제출로 값이 비어도 정보를 잃지 않음) |
| `role` | 그룹 내 최고 권한 |
| `is_approved` | 하나라도 승인이면 승인 |

병합 내역은 `output/merged_accounts.json` 에 남는다.
`DEFINE.MERGE_DUPLICATE_LOGIN_IDS = False` 로 바꾸면 예전처럼 `__dup2` 접미사 방식으로 되돌아간다.

### calendar_events → Event

레거시는 (날짜 1개, 내용) 구조라 여러 날짜 행사가 날짜별로 쪼개져 있다.
신규 `Event` 는 `start_date`/`end_date` 를 가지므로 **내용이 같고 날짜가 연속된 행을 하나의 행사로 병합**한다.
(실측: 102행 → 63건, `--no-merge-events` 로 끌 수 있음)

`post_id`, `apply_due`, `organization_id` 는 레거시에 대응 데이터가 없어 각각 `NULL` / `NULL` / 총학생회로 둔다.

### Reply → Comment

ERD에는 댓글 테이블이 없지만 **API 명세("게시글 상세조회" 응답의 `reply[]`)가 요구**하므로
`Comment` 테이블을 만들어 이관한다.

| 레거시 | 신규 |
|---|---|
| `r_no` | `Comment.id` |
| `b_idx` | `Comment.post_id` (레거시는 VARCHAR라 정수 변환) |
| `userid` | `Comment.writer` (없으면 NULL) |
| `username` | `Comment.writer_name` (탈퇴 회원이어도 표시명 보존) |
| `r_text` | `Comment.content` |
| `r_date` | `Comment.created_at` |

레거시 2,029건 중 **1,646건 이관**. 나머지 383건은 이미 삭제된 게시글에 달린 고아 댓글이라
FK로 연결할 수 없어 `output/orphan_comments.json` 에 보존했다.
`r_icon`(레거시 UI 아이콘 번호)은 대응 항목이 없어 버린다.

### 이관하지 않는 테이블

- `tbl_youtube` (유튜브 링크) — ERD에도 API 명세에도 대응 항목이 없음.
  삭제하면 복구가 불가능하므로 `output/unmigrated/tbl_youtube.json` 에 원본을 덤프해 둔다.

## API 명세를 위해 보충한 스키마

`api 명세서` 폴더의 명세가 요구하는데 ERD에 없던 항목을 추가했다.
(자세한 사용처는 [backend/api_v2/README.md](../caugsa-website/backend/api_v2/README.md))

| 추가 항목 | 이유 (명세) | 레거시 원본 | 실적재 |
|---|---|---|---|
| `Comment` 테이블 | 게시글 상세조회의 `reply[]` | `Reply` | 1,646건 |
| `Post.is_notice` | 게시글 목록의 `isNotice` | `option_notice`(-1=참) | 15건 |
| `Post.is_secret` | "비밀글 기능" | `option_bimil`(-1=참) | 4건 |
| `Board.slug` | `?board=student-council` 로 게시판 지정 | — | 11건 |
| `User.zip_code`/`address1`/`address2` | 내 정보 조회/수정의 `zipCode`/`address1`/`address2` | `strZip`/`strAddr1`/`strAddr2` | 6,823건 |
| `User.mail_agree` | 승인 대기 회원 목록의 `mailok` | `strmailok`('Y') | 55건 |

## ERD와의 차이

`DEFINE.py` 의 DDL은 ERD를 따르되 세 군데를 조정했다.

1. **`id2` → `menu_id`** — ERD의 `id2 (메뉴)` 는 ERD 툴이 복합 외래키를 전파하며 자동 생성한 이름이라
   실제 스키마에서는 의미가 드러나는 `menu_id` 로 명명했다. (`Post`, `Event`, `Attachment`)
2. **`Board.organization (VARCHAR)` → `organization_id INT`** — `Organization.id` 가 `INT` 이므로
   FK로 성립하려면 `INT` 여야 한다.
3. **보조 유니크 키 추가** — ERD의 복합 FK `(board_type, menu_id) → Board(id, menu_id)` 를 성립시키기 위해
   `Board`·`Post` 에 `UNIQUE(id, menu_id)` 를 추가했다.

## 메뉴 / 게시판 구조

신규 사이트는 메뉴 4개 아래 게시판 11개다. (`DEFINE.MENUS`, `DEFINE.BOARD_DEFS`)

| 메뉴 | 게시판 |
|---|---|
| 총학생회 소개 | 총학생회장단 인사말 · 조직 및 업무 · 오시는 길 |
| 총학생회 게시판 | 진행사업 · 공약이행보고 |
| 학생 자치 | 회의록 · 회칙 및 세칙 · 회계 자료 |
| 정보 마당 | 제휴 · 대여 · FAQ |

레거시는 게시판을 국·위원회 단위(`board6`, `board19` …)로 쪼개 두었고 신규 구조는 주제 단위라,
여러 레거시 게시판이 하나의 신규 게시판으로 합쳐진다. 매핑은 `DEFINE.LEGACY_BOARD_MAP` 에 있고
각 코드의 정체는 실제 백업 DB의 게시글 제목을 확인해 결정했다.

| 신규 게시판 | 게시글 | 합쳐지는 레거시 게시판 |
|---|---|---|
| 진행사업 | 445 | `board6` 중앙집행위 · `board7` 학생복지위 · `board10` 성평등위 · `board8` 문화위 · `board2` 스터디/공모전 · `board26` 동아리소개 · `board42` 전략정책국 · `board25` 학사안내 · `board44` 일상사업국 · `board32` 인권위 · `board9` 졸준위 · `board41` 교육자치국 · `board43` 연대사업국 · `board40` 홍보소통국 · `board29` 다전공자료집 |
| 회의록 | 564 | `board19` 중앙운영위원회 회의록 · `board11` 전체학생대표자회의 · `board22` 공간조정회의 |
| 대여 | 338 | `board23` 중앙도서관 사물함 공지 · `board24` 사물함 철거 요청 · `board3` 대여/상주사업 |
| 회계 자료 | 116 | `board20` 월별 회계 |
| 회칙 및 세칙 | 92 | `board18` 총학생회 회칙 · `board17` 단과대학 회칙 |
| 제휴 | 30 | `board27` 제휴 안내 |
| FAQ | 5 | `board21` 사물함/공간조정 문의 · `board30` 대학원생 사물함 문의 |
| 공약이행보고 | 0 | (레거시에 대응 게시판 없음) |
| 총학생회 소개의 3개 | 0 | (정적 소개 페이지) |

메뉴는 4개로 고정이므로 매핑에 없는 코드가 나와도 "미분류" 메뉴를 새로 만들지 않고
`DEFINE.FALLBACK_BOARD`(진행사업)로 보내고 경고를 남긴다.

## 산출물

실행 후 `CAU_MIGRATION/output/` 에 생성된다.

| 파일 | 내용 |
|---|---|
| `migration_report.json` | 단계별 건수 + 경고 전체 |
| `merged_accounts.json` | 병합된 중복 계정 내역 (어떤 intSeq 가 어디로 합쳐졌는지) |
| `broken_emails.json` | `@` 없는 이메일 목록 |
| `unknown_post_writers.json` | 회원 테이블에 없는 작성자의 게시글 |
| `orphan_comments.json` | 삭제된 게시글에 달려 이관하지 못한 댓글 |
| `unmigrated/*.json` | 이관하지 않은 레거시 테이블 원본 |
| `new_schema.sql` | (`--export-ddl` 시) 신규 스키마 DDL |

## 확인이 필요한 사항

- **백엔드 로그인 로직을 반드시 바꿔야 한다.** 레거시 `strPwd` 는 평문이었고 `backend/app.py` 도
  평문 비교(`user['strPwd'] != password`)를 한다. 이 스크립트는 기본으로 비밀번호를 해시해서
  이관하므로, 신규 백엔드는 `werkzeug.security.check_password_hash(user['password'], password)`
  로 검증해야 한다. **그대로 두면 아무도 로그인할 수 없다.**
  (해시는 계정당 약 0.1초라 7천 계정 기준 10분 이상 걸린다. 500건마다 진행 상황을 출력한다.)
- **국·위원회 구분이 게시글 단위로는 남지 않는다.** 레거시는 게시판이 국·위원회 단위였지만
  신규 구조는 주제 단위라 15개 게시판이 "진행사업" 하나로 합쳐진다. 신규 `Post` 에는
  `organization_id` 가 없어 어느 국이 쓴 글인지는 제목의 `[68대 총학생회]` 같은 접두어로만 남는다.
  게시글 단위로 주관 기관을 구분해야 한다면 `Post` 에 `organization_id` 컬럼 추가가 필요하다.
- **"공약이행보고" 게시판은 레거시에 대응 게시판이 없어 비어 있다.**
- **비회원 게시글** — 신규 `Post` 에는 비회원 작성자명 컬럼이 없어 `b_name` 이 이관되지 않는다
  (백업 기준 2건, `writer=NULL`).
- **첨부파일 실제 파일** — 레거시는 파일명만 DB에 두고 실제 파일은 웹서버 업로드 디렉터리에 있다.
  이 스크립트는 DB 행만 이관하므로 파일 자체는 별도로 옮겨야 한다.
