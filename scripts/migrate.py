# -*- coding: utf-8 -*-
"""
scripts/migrate.py
==================
caugsa-website 안에서 DB 마이그레이션을 실행하기 위한 얇은 런처.

    cd caugsa-website
    python scripts/migrate.py --dry-run
    python scripts/migrate.py

실제 로직은 모두 저장소 안의 CAU_MIGRATION/main.py 에 있고, 모든 인자는
그대로 전달된다. 옵션 목록은 `python scripts/migrate.py --help` 참고.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
MIGRATION_DIR = os.path.join(REPO_ROOT, "CAU_MIGRATION")

if not os.path.isdir(MIGRATION_DIR):
    sys.stderr.write(
        "CAU_MIGRATION 폴더를 찾을 수 없습니다: %s\n"
        "저장소 루트 바로 아래에 CAU_MIGRATION 이 있어야 합니다.\n"
        % MIGRATION_DIR
    )
    sys.exit(2)

sys.path.insert(0, MIGRATION_DIR)

import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main.main())
