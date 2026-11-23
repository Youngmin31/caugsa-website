# caugsa
중앙대학교 서울캠퍼스 총학생회 홈페이지 재설계 및 개발

운영 사이트: https://www.caugsa.com

## 구성

| 디렉터리 | 내용 |
|---|---|
| `frontend/` | React (Create React App) 프론트엔드 |
| `backend/api_v2/` | Flask API (신규 스키마, 운영 대상) |
| `backend/app.py` | 레거시 Flask API (폐기 대상, 참고용) |
| `CAU_MIGRATION/` | 레거시 DB → 신규 스키마 마이그레이션 도구 |
| `db/` | 레거시 스키마와 로컬 개발용 더미 데이터 |

## 로컬 실행

```bash
# 백엔드 (기본 5002 포트)
cp backend/.env.example backend/.env   # 값 채우기
pip install -r backend/requirements.txt
cd backend && python -m api_v2.wsgi

# 프론트엔드
cd frontend
npm ci
npm start
```

## 공개용 저장소 안내

이 저장소는 포트폴리오 공개를 위해 운영 코드에서 개인정보와 운영 정보를 걸러낸 사본이다.
원본 작업 이력은 포함하지 않는다.

- 사람 얼굴·실명이 들어간 이미지(회장단 인사말, 조직 및 업무)는 제외했다
- 메인 화면 사진(`frontend/src/assets/images/main/hero/`)은 자리표시용 이미지로 바꿨다
- 개인정보 처리방침의 담당자 이름·연락처, 코드 주석의 실제 아이디 예시는 가상의 값으로 바꿨다
- 운영 서버 배포 절차서와 운영 DB 점검용 SQL은 제외했다
