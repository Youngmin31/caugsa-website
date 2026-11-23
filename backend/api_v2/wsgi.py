# -*- coding: utf-8 -*-
"""
api_v2/wsgi.py
==============
신규 스키마 기준 API 서버 (단독 실행용).

    cd caugsa-website/backend
    python -m api_v2.wsgi              # 기본 5002 포트

환경변수
--------
  V2_DB_*        신규 DB 접속 정보 (없으면 DB_* 기반 <DB_NAME>_v2)
  JWT_SECRET_KEY JWT 서명 키
  UPLOAD_DIR     첨부파일 디렉터리
  API_V2_PORT    포트 (기본 5002)
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from flask import Flask, jsonify          # noqa: E402
from flask_cors import CORS               # noqa: E402
from flask_jwt_extended import JWTManager  # noqa: E402
from flask_mail import Mail                # noqa: E402

from api_v2 import db, register_api_v2     # noqa: E402


def _load_dotenv():
    """python-dotenv 가 있으면 backend/.env 를 읽는다."""
    path = os.path.join(BASE_DIR, ".env")
    if not os.path.isfile(path):
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(path)
        return
    except ImportError:
        pass
    with open(path, "r", encoding="utf-8-sig") as fp:
        for line in fp:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def _env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in ("1", "true", "y", "yes", "on")


def _init_mail(app):
    """
    메일 발송 설정. 레거시 app.py 와 같은 조합(Gmail SMTP / 465 / SSL)을 쓴다.

    값은 .env 에서 읽는다. MAIL_USERNAME 이 없으면 Mail 을 등록하지 않고,
    auth.py 의 _send_mail 이 로그만 남기는 폴백으로 동작한다.
    (메일 설정 없이도 로컬에서 가입 흐름을 확인할 수 있게 하기 위함)
    """
    username = os.environ.get("MAIL_USERNAME")
    if not username:
        app.logger.warning(
            "MAIL_USERNAME 이 없어 메일 발송을 건너뜁니다. "
            "인증 코드는 서버 로그에 [MAIL:skipped] 로 남습니다.")
        return

    app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", 465))
    app.config["MAIL_USERNAME"] = username
    app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")
    # Gmail 은 465 면 SSL, 587 이면 TLS 다. 둘을 함께 켜면 발송이 실패한다.
    app.config["MAIL_USE_SSL"] = _env_bool("MAIL_USE_SSL", True)
    app.config["MAIL_USE_TLS"] = _env_bool("MAIL_USE_TLS", False)
    # 레거시 app.py 는 sender 를 MAIL_USERNAME 으로 넘겼다. 같은 주소를 쓴다.
    app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
        "MAIL_DEFAULT_SENDER", username)

    Mail(app)
    app.logger.info("메일 발송 준비 완료: %s (%s:%s)", username,
                    app.config["MAIL_SERVER"], app.config["MAIL_PORT"])


def create_app():
    _load_dotenv()

    app = Flask(__name__)
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")
    app.config["JSON_AS_ASCII"] = False
    app.json.ensure_ascii = False

    CORS(app, supports_credentials=True)
    JWTManager(app)
    _init_mail(app)

    register_api_v2(app)
    app.teardown_appcontext(db.close_conn)

    @app.errorhandler(500)
    def on_error(exc):  # pragma: no cover
        app.logger.exception("unhandled error")
        return jsonify({"result": "FAIL", "message": "서버 오류"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("API_V2_PORT", 5002))
    app.run(host="0.0.0.0", port=port, debug=True)
