# -*- coding: utf-8 -*-
"""
api_v2
======
`api 명세서` 폴더의 명세를 신규 ERD 스키마(CAU_MIGRATION 결과) 기준으로 구현한
Flask Blueprint 모음.

기존 `app.py` 는 레거시 스키마(BOARD_v1 / mTb_Member2)를 대상으로 하므로
건드리지 않고 그대로 두었다. 이 패키지는 신규 DB 를 바라본다.

사용법
------
    # 단독 실행
    python -m api_v2            (또는 python api_v2/wsgi.py)

    # 기존 앱에 붙이기
    from api_v2 import register_api_v2
    register_api_v2(app)
"""

def register_api_v2(app):
    """Flask 앱에 v2 엔드포인트를 등록한다.

    라우트는 ``create_app`` 이 .env 를 읽은 뒤에 import한다. 패키지 import
    시점에 라우트를 불러오면 UPLOAD_DIR 같은 모듈 설정이 환경변수보다 먼저
    결정되어 로컬과 배포 서버의 파일 경로가 엇갈릴 수 있다.
    """
    from api_v2.routes import (
        admin_bp,
        auth_bp,
        events_bp,
        files_bp,
        misc_bp,
        posts_bp,
        reactivate_bp,
        user_bp,
    )

    blueprints = (
        auth_bp,
        user_bp,
        posts_bp,
        admin_bp,
        events_bp,
        files_bp,
        misc_bp,
        reactivate_bp,   # 한시적 기능. 제거 시 이 줄과 위 import 만 지운다
    )
    for blueprint in blueprints:
        app.register_blueprint(blueprint)
    return app


__all__ = ["register_api_v2"]
