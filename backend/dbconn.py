import os

from dotenv import load_dotenv

# app.py를 거치지 않고 dbconn만 단독으로 import되는 경우(스크립트, 테스트,
# 마이그레이션 등)에도 DB_* 환경변수가 채워지도록 여기서도 .env를 읽는다.
# 이미 로드된 값은 덮어쓰지 않고, .env가 없으면 아래 기본값이 사용된다.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

import mariadb  # noqa: E402


def connect_to_db():
    print("DB CONNECTION REQUESTED")
    return mariadb.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "caugsa_v2_test"),
    )




# ============================================
# Test code
# ============================================
# db_connection = connect_to_db()

# try:
#     cursor = db_connection.cursor()

#     queries = [
#         "SELECT * FROM tbl_youtube;",
#         "SELECT * FROM mTb_Member2;"
#     ]

#     for query in queries:
#         cursor.execute(query)
#         results = cursor.fetchall()
#         for r in results:
#             print(r)

#     cursor.close()
# except Exception as e:
#     print("Error:", str(e))
# finally:
#     db_connection.close() 
# ============================================
