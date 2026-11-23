# -*- coding: utf-8 -*-
"""
config.py
=========
소스(레거시) DB / 타깃(신규) DB 접속 정보를 결정한다.

우선순위 (뒤로 갈수록 우선):
  1. 기본값
  2. backend/.env
  3. CAU_MIGRATION/.env
  4. 프로세스 환경변수
  5. CLI 인자 (main.py)
"""

import os

# CAU_MIGRATION 디렉터리 (저장소 루트 바로 아래)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 저장소 루트
REPO_ROOT = os.path.dirname(BASE_DIR)
WEBSITE_DIR = REPO_ROOT
WEBSITE_ENV = os.path.join(WEBSITE_DIR, "backend", ".env")
MIGRATION_ENV = os.path.join(BASE_DIR, ".env")

# 산출물 디렉터리
OUTPUT_DIR = os.path.join(BASE_DIR, "output")


def _parse_env_file(path):
    """의존성 없이 .env 를 파싱한다 (python-dotenv 가 없어도 동작)."""
    values = {}
    if not os.path.isfile(path):
        return values
    with open(path, "r", encoding="utf-8-sig") as fp:
        for raw in fp:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.lower().startswith("export "):
                line = line[7:]
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            values[key] = value
    return values


def load_env():
    """
    .env 파일들과 프로세스 환경변수를 병합한 dict 를 돌려준다.
    (os.environ 은 건드리지 않는다.)
    """
    merged = {}
    merged.update(_parse_env_file(WEBSITE_ENV))
    merged.update(_parse_env_file(MIGRATION_ENV))
    merged.update(os.environ)
    return merged


class DbConfig(object):
    """단일 DB 접속 정보."""

    def __init__(self, host, port, user, password, database):
        self.host = host
        self.port = int(port)
        self.user = user
        self.password = password
        self.database = database

    def kwargs(self, with_database=True):
        kw = {
            "host": self.host,
            "port": self.port,
            "user": self.user,
            "password": self.password,
        }
        if with_database:
            kw["database"] = self.database
        return kw

    def __repr__(self):
        return "%s@%s:%s/%s" % (self.user, self.host, self.port, self.database)


class Settings(object):
    """마이그레이션 실행 설정 전체."""

    def __init__(self, source, target, options=None):
        self.source = source
        self.target = target
        opts = options or {}
        # 실행 옵션
        self.dry_run = opts.get("dry_run", False)
        self.drop_existing = opts.get("drop_existing", False)
        self.create_database = opts.get("create_database", True)
        self.merge_events = opts.get("merge_events", True)
        self.limit = opts.get("limit")            # 테스트용 행 수 제한
        self.only_steps = opts.get("only_steps")  # 특정 단계만 실행
        self.output_dir = opts.get("output_dir", OUTPUT_DIR)
        self.verbose = opts.get("verbose", False)


def _pick(env, keys, default=None):
    for key in keys:
        if env.get(key) not in (None, ""):
            return env[key]
    return default


def build_settings(cli=None):
    """
    .env + 환경변수 + CLI 인자를 합쳐 Settings 를 만든다.
    `cli` 는 argparse.Namespace (main.py 에서 전달).
    """
    env = load_env()
    cli = cli or {}
    if not isinstance(cli, dict):
        cli = {k: v for k, v in vars(cli).items() if v is not None}

    # ------------------------------------------------------------------
    # 소스 DB : 기존 caugsa 사이트가 쓰던 DB (읽기 전용으로만 접근)
    # ------------------------------------------------------------------
    source = DbConfig(
        host=cli.get("source_host") or _pick(env, ["SRC_DB_HOST", "DB_HOST"], "localhost"),
        port=cli.get("source_port") or _pick(env, ["SRC_DB_PORT", "DB_PORT"], 3306),
        user=cli.get("source_user") or _pick(env, ["SRC_DB_USER", "DB_USER"], "root"),
        password=(cli.get("source_password")
                  if cli.get("source_password") is not None
                  else _pick(env, ["SRC_DB_PASSWORD", "DB_PASSWORD"], "")),
        database=cli.get("source_db") or _pick(env, ["SRC_DB_NAME", "DB_NAME"], "caugsa_local"),
    )

    # ------------------------------------------------------------------
    # 타깃 DB : 신규 ERD 스키마가 만들어질 DB
    #           별도 지정이 없으면 <소스DB명>_v2
    # ------------------------------------------------------------------
    default_target_name = "%s_v2" % source.database
    target = DbConfig(
        host=cli.get("target_host") or _pick(env, ["TGT_DB_HOST"], source.host),
        port=cli.get("target_port") or _pick(env, ["TGT_DB_PORT"], source.port),
        user=cli.get("target_user") or _pick(env, ["TGT_DB_USER"], source.user),
        password=(cli.get("target_password")
                  if cli.get("target_password") is not None
                  else _pick(env, ["TGT_DB_PASSWORD"], source.password)),
        database=cli.get("target_db") or _pick(env, ["TGT_DB_NAME"], default_target_name),
    )

    options = {
        "dry_run": cli.get("dry_run", False),
        "drop_existing": cli.get("drop_existing", False),
        "create_database": not cli.get("no_create_database", False),
        "merge_events": not cli.get("no_merge_events", False),
        "limit": cli.get("limit"),
        "only_steps": cli.get("only"),
        "output_dir": cli.get("output_dir") or OUTPUT_DIR,
        "verbose": cli.get("verbose", False),
    }

    settings = Settings(source, target, options)

    if (settings.source.database == settings.target.database
            and settings.source.host == settings.target.host
            and settings.source.port == settings.target.port):
        raise ValueError(
            "소스 DB 와 타깃 DB 가 동일합니다 (%s). "
            "--target-db 로 다른 DB 이름을 지정하세요." % settings.source.database
        )
    return settings
