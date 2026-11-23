# -*- coding: utf-8 -*-
"""
utils.py
========
값 정규화 헬퍼 + 로깅 + 마이그레이션 리포트.
"""

import datetime
import decimal
import io
import json
import os
import re
import sys

import DEFINE

# =============================================================================
# 로깅
# =============================================================================
_VERBOSE = False


def set_verbose(flag):
    global _VERBOSE
    _VERBOSE = bool(flag)


def force_utf8_stdout():
    """Windows 콘솔(cp949)에서 한글 로그가 깨지지 않도록."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            try:
                wrapped = io.TextIOWrapper(
                    stream.buffer, encoding="utf-8", errors="replace", line_buffering=True
                )
                setattr(sys, stream_name, wrapped)
            except Exception:
                pass


def log(message):
    print(message, flush=True)


def debug(message):
    if _VERBOSE:
        print("    · %s" % message, flush=True)


def step_header(index, total, title):
    log("")
    log("[%d/%d] %s" % (index, total, title))
    log("-" * 66)


def banner(title):
    log("")
    log("=" * 66)
    log(title)
    log("=" * 66)


# =============================================================================
# 값 정규화
# =============================================================================
def clean(value):
    """공백/문자열 'NULL' 등을 None 으로 정규화."""
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", errors="replace")
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if stripped in DEFINE.NULLISH_STRINGS:
        return None
    return stripped


def text(value):
    """본문처럼 앞뒤 공백만 정리하고 내용은 보존."""
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", errors="replace")
    if not isinstance(value, str):
        return value
    return value if value.strip() else None


def truncate(value, length):
    """VARCHAR 길이에 맞춰 자른다."""
    if value is None:
        return None
    value = str(value)
    return value if len(value) <= length else value[:length]


def to_int(value, default=None):
    value = clean(value)
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    match = re.search(r"-?\d+", str(value))
    return int(match.group()) if match else default


def to_bool_int(value, default=0):
    value = to_int(value, None)
    return default if value is None else (1 if value else 0)


def to_datetime(value, default=None):
    value = clean(value)
    if value is None:
        return default
    if isinstance(value, datetime.datetime):
        return value
    if isinstance(value, datetime.date):
        return datetime.datetime(value.year, value.month, value.day)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.datetime.strptime(str(value), fmt)
        except ValueError:
            continue
    return default


def to_date(value, default=None):
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    parsed = to_datetime(value)
    return parsed.date() if parsed else default


def normalize_mobile(value):
    """전화번호를 010-0000-0000 형태로."""
    value = clean(value)
    if value is None:
        return None
    digits = re.sub(r"\D", "", value)
    if not digits:
        return None
    if len(digits) == 11:
        return "%s-%s-%s" % (digits[:3], digits[3:7], digits[7:])
    if len(digits) == 10:
        return "%s-%s-%s" % (digits[:3], digits[3:6], digits[6:])
    return truncate(value, 30)


def resolve_emails(primary, backup):
    """
    strEmail -> email, strEmail2 -> sub_email 로 그대로 옮긴다.

    두 컬럼은 서로 다른 뜻을 가진 별개의 값이다.
      strEmail  : 포탈 아이디 (예: 'hong123'). 도메인이 없는 경우가 많다.
      strEmail2 : 예비 이메일 (예: 'hong123@naver.com')

    예전에는 "온전한 주소를 email 로 승격"시켰는데, 그 결과 예비 이메일이
    포탈 아이디 자리를 차지하고 sub_email 은 비워졌다(1,259건).
    두 값의 의미가 달라 승격은 잘못된 변환이므로 하지 않는다.

    반환: (email, sub_email)
    """
    return truncate(clean(primary), 100), truncate(clean(backup), 100)


def guess_student_id(login_id):
    """
    login_id 가 순수 숫자(학번 형식)면 학번으로 본다.

    학번은 식별자이므로 문자열로 다룬다. 숫자로 바꾸면 앞자리 0 이
    사라진다(01111111 -> 1111111).
    """
    login_id = clean(login_id)
    if not login_id or not login_id.isdigit():
        return None
    if len(login_id) not in DEFINE.STUDENT_ID_DIGIT_LENGTHS:
        return None
    return login_id


def file_extension(filename):
    filename = clean(filename)
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[-1].strip().lower()


def file_type_of(filename):
    ext = file_extension(filename)
    if not ext:
        return DEFINE.DEFAULT_FILE_TYPE
    return DEFINE.EXTENSION_TO_TYPE.get(ext, DEFINE.DEFAULT_FILE_TYPE)


def hash_password(raw):
    """비밀번호를 해시한다. werkzeug 가 없으면 stdlib pbkdf2 로 대체.

    이관에서는 더 이상 쓰지 않는다(비밀번호 미이관). 배포 후 관리자 계정
    비밀번호를 만들 때 쓰라고 남겨둔다.
    """
    raw = raw if raw is not None else ""
    try:
        from werkzeug.security import generate_password_hash
        return generate_password_hash(raw)
    except ImportError:
        import base64
        import hashlib
        import os as _os
        salt = _os.urandom(16)
        digest = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), salt, 260000)
        return "pbkdf2:sha256:260000$%s$%s" % (
            base64.b16encode(salt).decode("ascii"),
            digest.hex(),
        )


# =============================================================================
# 리포트
# =============================================================================
class Report(object):
    """단계별 처리 건수 / 경고를 모아 마지막에 요약 출력."""

    def __init__(self):
        self.sections = []
        self.warnings = []
        self.started_at = datetime.datetime.now()

    def add(self, name, **counters):
        self.sections.append((name, counters))
        return counters

    def warn(self, message):
        self.warnings.append(message)
        log("  ! %s" % message)

    def to_dict(self):
        return {
            "started_at": self.started_at.isoformat(timespec="seconds"),
            "finished_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "sections": [{"name": n, "counters": c} for n, c in self.sections],
            "warnings": self.warnings,
        }

    def save(self, output_dir):
        ensure_dir(output_dir)
        path = os.path.join(output_dir, "migration_report.json")
        with open(path, "w", encoding="utf-8") as fp:
            json.dump(self.to_dict(), fp, ensure_ascii=False, indent=2,
                      default=_json_default)
        return path

    def render(self):
        banner("마이그레이션 요약")
        for name, counters in self.sections:
            log("  %s" % name)
            for key, value in counters.items():
                log("      %-28s %s" % (key, value))
        if self.warnings:
            log("")
            log("  경고 (%d건)" % len(self.warnings))
            for message in self.warnings:
                log("      - %s" % message)
        elapsed = (datetime.datetime.now() - self.started_at).total_seconds()
        log("")
        log("  소요 시간: %.1fs" % elapsed)


def ensure_dir(path):
    if not os.path.isdir(path):
        os.makedirs(path)
    return path


def dump_json(path, payload):
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2, default=_json_default)
    return path


def _json_default(value):
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, decimal.Decimal):
        # MySQL SUM() 등이 Decimal 로 돌아온다
        return int(value) if value == value.to_integral_value() else float(value)
    return str(value)
