# -*- coding: utf-8 -*-
"""
steps/users.py
==============
mTb_Member2 -> User

컬럼 매핑
---------
  intSeq        -> id            (PK 유지: 게시글 작성자 연결에 사용)
  strId         -> login_id
  (이관 안 함)  -> password      : 아래 "비밀번호 미이관" 참고
  strName       -> name
  strEmail      -> email         (strEmail2 와 조합해 정규화)
  strEmail2     -> sub_email
  strMobil      -> mobile
  intGubun      -> role
  dtmInsertDate -> created_at
  (없음)        -> student_id / college / major  : 레거시에 대응 데이터 없음

  승인여부(intCertify) / 주소(strZip·strAddr) / 메일수신(strmailok) 은
  신규 ERD 에서 빠져 이관하지 않는다.

비밀번호 미이관
---------------
확정 방침에 따라 레거시 비밀번호는 이관하지 않는다. strPwd 는 SELECT 목록
에서도 제외해 평문이 프로세스 메모리·로그·예외 트레이스에 올라오지 않게
한다. password 컬럼에는 DEFINE.NOLOGIN_PASSWORD 를 넣는다. 이 값은
`scrypt:` 접두가 붙어 있어 백엔드가 check_password_hash 경로로 검증하고,
형식이 깨져 있어 어떤 입력으로도 매칭되지 않는다.

이것만으로 전 계정 로그인이 차단된다. 신규 스키마에는 승인 플래그
(is_approved)가 없고 api_v2 로그인도 비밀번호만 검증하므로, 별도의
비활성 처리는 하지 않는다. 회원가입은 학교 메일 인증을 강제하므로
수동 승인 단계 자체가 설계에서 빠져 있다.

재활성화는 "학교 메일 인증 -> 비밀번호 재설정" 경로를 전제로 한다.

중복 로그인 아이디
------------------
레거시 strId 에는 중복이 있고(97종/114행), 실제 데이터를 확인한 결과 전부
같은 사람의 회원가입 폼 중복 제출이었다. 따라서 하나의 계정으로 병합한다.
자세한 근거와 병합 규칙은 DEFINE.MERGE_DUPLICATE_LOGIN_IDS 주석 참고.
"""

import DEFINE
import utils

INSERT_SQL = (
    "INSERT INTO `User` "
    "(`id`, `login_id`, `password`, `name`, `email`, `sub_email`, `student_id`, "
    " `mobile`, `role`, `created_at`, `college`, `major`) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
)

# strPwd 는 일부러 읽지 않는다. 비밀번호를 이관하지 않으므로 평문을
# 프로세스로 가져올 이유가 없다.
SELECT_SQL = (
    "SELECT `intSeq`, `strId`, `strName`, `strEmail`, `strEmail2`, "
    "       `strMobil`, `strPhone`, `intGubun`, `dtmInsertDate` "
    "FROM `%s` ORDER BY `intSeq`"
)


def run(ctx):
    source, target, settings = ctx.source, ctx.target, ctx.settings

    sql = SELECT_SQL % DEFINE.LEGACY_TABLES["member"]
    if settings.limit:
        sql += " LIMIT %d" % settings.limit

    # ------------------------------------------------------------------
    # 1) 읽기 + login_id 기준 그룹핑
    # ------------------------------------------------------------------
    groups = {}       # login_id(소문자) -> [레거시 행, ...]
    order = []        # 최초 등장 순서 유지
    skipped_no_id = 0

    for row in source.iter_rows(sql):
        user_id = utils.to_int(row.get("intSeq"))
        login_id = utils.clean(row.get("strId"))
        if user_id is None or not login_id:
            skipped_no_id += 1
            continue
        key = login_id.lower()
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(row)

    total_read = sum(len(v) for v in groups.values()) + skipped_no_id

    # ------------------------------------------------------------------
    # 2) 그룹 -> User 행
    # ------------------------------------------------------------------
    rows = []
    merged_groups = []
    suffixed = []
    broken_emails = []
    guessed_student_ids = 0

    ctx.user_by_login = {}
    ctx.user_by_seq = {}
    # posts 단계에서 admin 작성 게시글만 골라내는 데 쓴다.
    ctx.admin_logins = set()

    for key in order:
        members = groups[key]

        if len(members) > 1 and DEFINE.MERGE_DUPLICATE_LOGIN_IDS:
            merged_groups.append({
                "login_id": utils.clean(members[0].get("strId")),
                "kept_intSeq": utils.to_int(members[0].get("intSeq")),
                "merged_intSeq": [utils.to_int(m.get("intSeq")) for m in members[1:]],
                "name": utils.clean(members[0].get("strName")),
                "signup_times": [str(utils.to_datetime(m.get("dtmInsertDate"))) for m in members],
            })
            built = [_build(ctx, _merge_group(members), settings)]
        elif len(members) > 1:
            # 병합하지 않는 모드: 접미사를 붙여 별도 계정으로 남긴다
            built = []
            for index, member in enumerate(members):
                record = _to_record(member)
                if index:
                    suffix = DEFINE.DUPLICATE_LOGIN_ID_SUFFIX.format(n=index + 1)
                    record["login_id"] = utils.truncate(record["login_id"], 50 - len(suffix)) + suffix
                    suffixed.append({"login_id": record["original_login"],
                                     "new_login_id": record["login_id"],
                                     "intSeq": record["id"]})
                built.append(_build(ctx, record, settings))
        else:
            built = [_build(ctx, _to_record(members[0]), settings)]

        for record, row_tuple in built:
            rows.append(row_tuple)
            if record["role"] in DEFINE.POST_KEEPER_ROLES:
                ctx.admin_logins.add(record["original_login"].lower())
            if record["student_id"] is not None:
                guessed_student_ids += 1
            if record["email"] and "@" not in record["email"]:
                broken_emails.append({"intSeq": record["id"],
                                      "login_id": record["original_login"],
                                      "email": record["email"]})
            ctx.user_by_seq[record["id"]] = record["id"]
            # 게시글은 strId 로 작성자를 참조한다. 병합된 계정도 원본 아이디로 연결.
            ctx.user_by_login.setdefault(record["original_login"].lower(), record["id"])

    # ------------------------------------------------------------------
    # 3) 적재
    # ------------------------------------------------------------------
    if settings.dry_run:
        utils.log("  [dry-run] User %d건 INSERT 생략" % len(rows))
    else:
        for table, count in target.purge(["User"]).items():
            utils.log("  기존 %s %d건 삭제 후 재적재" % (table, count))
        inserted = target.insert_many(INSERT_SQL, rows)
        target.commit()
        utils.log("  User          : %d건 이관" % inserted)

    # ------------------------------------------------------------------
    # 4) 리포트
    # ------------------------------------------------------------------
    if merged_groups:
        utils.dump_json("%s/merged_accounts.json" % settings.output_dir, merged_groups)
        merged_rows = sum(len(g["merged_intSeq"]) for g in merged_groups)
        ctx.report.warn(
            "중복 로그인 아이디 %d종(%d행)을 하나의 계정으로 병합했습니다. "
            "모두 같은 사람의 가입 폼 중복 제출로 확인됨. "
            "output/merged_accounts.json 참고." % (len(merged_groups), merged_rows)
        )
    if suffixed:
        utils.dump_json("%s/duplicate_login_ids.json" % settings.output_dir, suffixed)
        ctx.report.warn("중복 로그인 아이디 %d건 -> 접미사를 붙이고 승인 해제." % len(suffixed))
    if broken_emails:
        utils.dump_json("%s/broken_emails.json" % settings.output_dir, broken_emails)
        ctx.report.warn(
            "'@' 가 없는 이메일 %d건 (레거시가 아이디 부분만 저장한 경우). "
            "값을 잃지 않도록 그대로 이관했습니다. "
            "output/broken_emails.json 참고." % len(broken_emails)
        )
    ctx.report.warn(
        "비밀번호를 이관하지 않았습니다. 전 계정(%d건)이 로그인 불가 상태입니다. "
        "배포 직후 관리자 계정 최소 1개의 비밀번호를 수동으로 설정해야 관리 "
        "기능을 쓸 수 있습니다. 미이관 계정 조회: "
        "WHERE password LIKE '%%$migrated$%%'" % len(rows)
    )

    roles = {}
    for row in rows:
        roles[row[8]] = roles.get(row[8], 0) + 1

    return ctx.report.add(
        "회원 (mTb_Member2 -> User)",
        읽은_행=total_read,
        이관=len(rows),
        아이디없어_제외=skipped_no_id,
        중복_병합_그룹=len(merged_groups),
        중복_병합으로_줄어든_행=sum(len(g["merged_intSeq"]) for g in merged_groups),
        이메일_형식오류=len(broken_emails),
        학번_추정=guessed_student_ids,
        비밀번호_미이관=len(rows),
        **{"역할_%s" % k: v for k, v in sorted(roles.items())}
    )


# =============================================================================
# 레거시 행 -> 중간 표현
# =============================================================================
def _to_record(row):
    """레거시 행 하나를 신규 컬럼 기준의 dict 로 변환."""
    login_id = utils.clean(row.get("strId"))
    email, sub_email = utils.resolve_emails(row.get("strEmail"), row.get("strEmail2"))
    gubun = utils.to_int(row.get("intGubun"))

    return {
        "id": utils.to_int(row.get("intSeq")),
        "original_login": login_id,
        "login_id": login_id,
        # 비밀번호 미이관: 전 계정 동일한 로그인 불가 표식
        "password": DEFINE.NOLOGIN_PASSWORD,
        "name": utils.truncate(utils.clean(row.get("strName")) or login_id, 50),
        "email": email,
        "sub_email": sub_email,
        "mobile": (utils.normalize_mobile(row.get("strMobil"))
                   or utils.normalize_mobile(row.get("strPhone"))),
        "role": DEFINE.GUBUN_TO_ROLE.get(gubun, DEFINE.DEFAULT_ROLE),
        "created_at": utils.to_datetime(row.get("dtmInsertDate")),
    }


def _merge_group(members):
    """
    같은 login_id 를 가진 여러 행을 하나로 병합한다.
      id / created_at : 가장 이른 계정
      그 외 필드      : 값이 있는 행 중 가장 최근 값 (재제출로 빈 값이 되어도 유지)
      role            : 최고 권한
    """
    records = [_to_record(m) for m in members]
    records.sort(key=lambda r: r["id"])
    first, latest_first = records[0], list(reversed(records))

    merged = dict(first)
    # password 는 전 계정 동일한 표식이라 병합 대상이 아니다.
    for field in ("name", "email", "sub_email", "mobile"):
        for record in latest_first:
            if record[field]:
                merged[field] = record[field]
                break

    merged["role"] = max(
        (r["role"] for r in records),
        key=lambda role: DEFINE.ROLE_PRIORITY.get(role, 0),
    )
    created = [r["created_at"] for r in records if r["created_at"]]
    merged["created_at"] = min(created) if created else None
    return merged


def _build(ctx, record, settings):
    """중간 표현 -> INSERT 튜플. (record, tuple) 반환."""
    record["student_id"] = utils.guess_student_id(record["original_login"])
    created_at = record["created_at"] or ctx.now

    return record, (
        record["id"],
        utils.truncate(record["login_id"], 50),
        record["password"],
        record["name"],
        record["email"],
        record["sub_email"],
        record["student_id"],
        record["mobile"],
        record["role"],
        created_at,
        None,   # college : 레거시에 없음
        None,   # major   : 레거시에 없음
    )
