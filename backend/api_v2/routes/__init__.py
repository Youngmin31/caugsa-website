# -*- coding: utf-8 -*-
"""api_v2 라우트 blueprint 모음."""

from api_v2.routes.auth import auth_bp
from api_v2.routes.user import user_bp
from api_v2.routes.posts import posts_bp
from api_v2.routes.admin import admin_bp
from api_v2.routes.events import events_bp
from api_v2.routes.files import files_bp
from api_v2.routes.misc import misc_bp
# 기존 회원 재활성화 — 한시적 기능. 끝나면 이 import 와 아래 목록의
# reactivate_bp, 그리고 routes/reactivate.py 만 지우면 완전히 사라진다.
from api_v2.routes.reactivate import reactivate_bp

__all__ = [
    "auth_bp", "user_bp", "posts_bp",
    "admin_bp", "events_bp", "files_bp", "misc_bp",
    "reactivate_bp",
]
