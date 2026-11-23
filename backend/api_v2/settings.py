# -*- coding: utf-8 -*-
"""api_v2의 공통 런타임 설정."""

import os
import re
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_UPLOAD_DIR = "/home/caugsa/caugsa/upload/avanboard_v3"


def resolve_upload_dir():
    """환경별 업로드 디렉터리를 항상 절대경로로 반환한다."""
    configured = os.environ.get("UPLOAD_DIR", DEFAULT_UPLOAD_DIR).strip()
    if not configured:
        configured = DEFAULT_UPLOAD_DIR

    # POSIX에서 Windows 경로는 상대경로로 오인되어
    # ``backend/C:\\Users\\...`` 같은 잘못된 디렉터리를 만든다.
    if os.name != "nt" and re.match(r"^[A-Za-z]:[\\/]", configured):
        raise RuntimeError(
            "UPLOAD_DIR에 Windows 경로가 설정되어 있습니다. "
            "현재 서버의 절대경로로 변경하세요: %s" % configured
        )

    path = Path(configured).expanduser()
    if not path.is_absolute():
        path = BACKEND_DIR / path
    return str(path.resolve())


UPLOAD_DIR = resolve_upload_dir()
