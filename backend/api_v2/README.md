# api_v2

`api 명세서` 폴더의 명세를 **신규 ERD 스키마**(CAU_MIGRATION 이관 결과) 기준으로 구현한 Flask Blueprint 모음.

기존 [app.py](../app.py) 는 레거시 스키마(`BOARD_v1` / `mTb_Member2`)를 대상으로 하므로 **건드리지 않았다.**
이 패키지는 신규 DB(`<DB_NAME>_v2`)만 바라본다.

## 실행

```bash
cd caugsa-website/backend

# 단독 실행 (기본 5002 포트)
python -m api_v2.wsgi
```

기존 앱에 붙이려면:

```python
from api_v2 import register_api_v2, db
register_api_v2(app)
app.teardown_appcontext(db.close_conn)
```

### 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `V2_DB_HOST/PORT/USER/PASSWORD` | `DB_*` 값 | 신규 DB 접속 정보 |
| `V2_DB_NAME` | `<DB_NAME>_v2` | 신규 DB 이름 |
| `JWT_SECRET_KEY` | `dev-secret-change-me` | JWT 서명 키 (**운영에서 반드시 변경**) |
| `UPLOAD_DIR` | `/home/caugsa/caugsa/upload/avanboard_v3` | 첨부파일 디렉터리. 로컬·배포 환경 모두 해당 환경의 절대경로 사용 |
| `SECTION_IMAGE_DIR` | `frontend/src/assets/images/02_intro_images` | 섹션 이미지 디렉터리 |
| `API_V2_PORT` | `5002` | 단독 실행 포트 |

## 구현된 엔드포인트

명세서 `엔드포인트.csv` 의 26개를 모두 구현했다.

| 파일 | 엔드포인트 |
|---|---|
| [routes/auth.py](routes/auth.py) | `POST /api/auth/login` · `register` · `logout` · `id_search` · `pw_search` · `pw_search_by_email` · `email_verify` · `verify_code` / `GET /api/auth/protected` |
| [routes/user.py](routes/user.py) | `GET·PUT /api/user/profile` |
| [routes/posts.py](routes/posts.py) | `GET /api/posts` · `GET /api/posts/{id}` · `POST /api/posts` · `PUT /api/posts/{id}` · `DELETE /api/posts/{id}` |
| [routes/admin.py](routes/admin.py) | `GET /api/admin/members` · `POST /api/admin/certify` · `POST /api/admin/image` |
| [routes/events.py](routes/events.py) | `GET·POST·DELETE /api/events` |
| [routes/files.py](routes/files.py) | `POST /api/files/download` |
| [routes/misc.py](routes/misc.py) | `GET /api/hello` · `GET /api/get-section/<section>` · `GET /api/boards`(추가) |

## 명세 ↔ 신규 스키마 매핑

| 명세 필드 | 신규 컬럼 | 비고 |
|---|---|---|
| `board=student-council` | `Board.slug` | slug 는 이번에 추가한 컬럼 |
| `isNotice` | `Post.is_notice` | 레거시 `option_notice`(-1=참) |
| 비밀글 | `Post.is_secret` | 레거시 `option_bimil` |
| `hasAttachment` | `Attachment` 존재 여부 | |
| `reply[]` | `Comment` 테이블 | 레거시 `Reply` |
| `zipCode`/`address1`/`address2` | `User.zip_code`/`address1`/`address2` | 이번에 추가 |
| `mailok` | `User.mail_agree` | 레거시 `strmailok` |
| `isparticipate`/`event_date`/`form_date` | `Event.start_date`/`end_date`/`apply_due` | 게시글 작성 시 Event 동시 생성 |

## 레거시 app.py 와 달라진 점

1. **비밀번호 검증** — `User.password` 가 해시라 `check_password_hash` 로 검증한다.
   해시가 아닌 저장값은 무조건 인증 실패다 (`_verify_password`). 평문 폴백은
   저장값 자체가 로그인 비밀번호가 되어 버려 제거했다.
2. **게시판 지정** — `b_part`(board6) 문자열 대신 `Board.slug` 로 조회한다.
   게시판 목록이 코드에 하드코딩되지 않고 DB 에서 온다.
3. **댓글** — 레거시는 `Reply` 를 별도 쿼리로 읽었는데, `Comment` 로 이관해 FK 로 묶었다.
   게시글을 지우면 댓글도 CASCADE 로 함께 지워진다.
4. **첨부파일 다운로드 검증** — 명세는 `postId` 를 "미사용(TODO)"이라 했지만,
   파일명만 받으면 업로드 디렉터리의 임의 파일을 내려받을 수 있어
   `Attachment` 테이블에 등록된 파일인지 확인하고 경로 조작 문자를 차단한다.
5. **일정 조회** — 신규 `Event` 는 기간(start/end)을 갖지만, 프론트 호환을 위해
   기본적으로 날짜별로 펼쳐 `(event_date, content)` 형태로 돌려준다.
   기간 그대로 받으려면 `?expand=false`.

## 남은 작업

- **메일 인증 코드가 프로세스 메모리에 있다** (`routes/auth.py` 의 `_email_codes`).
  레거시 `app.py` 와 동일한 방식이라 그대로 뒀지만, 워커를 2개 이상 띄우면
  인증 요청과 확인 요청이 다른 워커로 가서 실패한다. 운영에서는 Redis 나 테이블로 옮겨야 한다.
- **로그아웃이 토큰을 무효화하지 않는다.** JWT 는 무상태라 클라이언트가 폐기하는 방식이다.
  서버 측 무효화가 필요하면 `jti` 블록리스트 테이블이 필요하다.
- **섹션 이미지는 DB 가 아니라 파일로 관리한다** (레거시와 동일). 명세에도 저장 위치 지정이 없다.
