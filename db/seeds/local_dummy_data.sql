-- CAUGSA 로컬 개발용 더미데이터
-- 대상 스키마: caugsa_schema.sql (2026-07-30 덤프 기준)
-- 주의: 운영 DB에서 실행하지 마세요.
-- 실행 전 반드시 현재 DB가 로컬 테스트 DB인지 확인하세요.
--
-- 권장 실행 예시:
--   mariadb -u root -p -e "CREATE DATABASE caugsa_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
--   mariadb -u root -p caugsa_local < caugsa_schema.sql
--   mariadb -u root -p caugsa_local < local_dummy_data.sql

SET NAMES utf8mb4;
START TRANSACTION;

-- 반복 실행을 쉽게 하기 위해 기존 테스트 데이터만 제거합니다.
-- 실제 운영 데이터와 겹치지 않도록 이메일/ID/제목에 test 값을 사용합니다.
DELETE FROM `Reply`
WHERE `userid` LIKE 'test_%';

DELETE FROM `BOARD_v1`
WHERE `userid` LIKE 'test_%'
   OR `b_email` LIKE '%@example.test';

DELETE FROM `mTb_Member2`
WHERE `strId` LIKE 'test_%'
   OR `strEmail` LIKE '%@example.test';

DELETE FROM `calendar_events`
WHERE `content` LIKE '[TEST]%';

DELETE FROM `tbl_youtube`
WHERE `strTitle` LIKE '[TEST]%';


-- -----------------------------------------------------
-- 1. 회원 더미데이터
-- -----------------------------------------------------
-- strPwd 값은 현재 애플리케이션의 암호화/해시 방식을 확인한 뒤
-- 필요하면 그 형식에 맞게 교체하세요.
INSERT INTO `mTb_Member2` (
    `strName`,
    `strNic`,
    `strJumin1`,
    `strJumin2`,
    `strId`,
    `strPwd`,
    `strZip`,
    `strAddr1`,
    `strAddr2`,
    `strPhone`,
    `strMobil`,
    `strEmail`,
    `strJob`,
    `strMemo`,
    `intGubun`,
    `intAction`,
    `strActionMessage`,
    `strhi`,
    `strsmsok`,
    `strmailok`,
    `checkbunho`,
    `intCertify`,
    `strEmail2`
) VALUES
(
    '테스트관리자',
    '관리자',
    '000101',
    '0000000',
    'test_admin',
    'test1234',
    '00000',
    '서울특별시 테스트구',
    '테스트동 101호',
    NULL,
    '010-0000-0001',
    'test_admin@example.test',
    '소프트웨어학부 4학년',
    '로컬 개발용 관리자 계정',
    1,
    0,
    '',
    '로컬 테스트 관리자입니다.',
    'N',
    'N',
    '',
    1,
    'test_admin2@example.test'
),
(
    '테스트회원',
    '일반회원',
    '000202',
    '0000000',
    'test_user',
    'test1234',
    '00000',
    '서울특별시 테스트구',
    '테스트동 202호',
    NULL,
    '010-0000-0002',
    'test_user@example.test',
    '경영학부 2학년',
    '로컬 개발용 일반 회원',
    0,
    0,
    '',
    '로컬 테스트 회원입니다.',
    'N',
    'N',
    '',
    1,
    'test_user2@example.test'
),
(
    '승인대기회원',
    '승인대기',
    '000303',
    '0000000',
    'test_pending',
    'test1234',
    '00000',
    '서울특별시 테스트구',
    '테스트동 303호',
    NULL,
    '010-0000-0003',
    'test_pending@example.test',
    '사회과학대학 1학년',
    '회원 승인 기능 확인용',
    0,
    1,
    '관리자 승인 대기 중',
    '승인 대기 상태 테스트 계정입니다.',
    'Y',
    'Y',
    '123456',
    0,
    'test_pending2@example.test'
);


-- -----------------------------------------------------
-- 2. 일정 더미데이터
-- -----------------------------------------------------
INSERT INTO `calendar_events` (`event_date`, `content`) VALUES
('2026-08-01', '[TEST] 총학생회 정기회의'),
('2026-08-05', '[TEST] 문화행사 준비회의'),
('2026-08-10', '[TEST] 학생복지 설문 시작'),
('2026-08-15', '[TEST] 광복절'),
('2026-08-20', '[TEST] 동아리 행사 접수 마감');


-- -----------------------------------------------------
-- 3. 게시판 더미데이터
-- -----------------------------------------------------
-- ref/re_level/re_step는 기존 스키마에서 NOT NULL이므로 기본 게시글은 0으로 둡니다.
-- b_part는 기술이전 문서의 게시판 매핑 값을 사용했습니다.

INSERT INTO `BOARD_v1` (
    `board_code`,
    `b_part`,
    `b_title`,
    `b_name`,
    `b_email`,
    `b_text`,
    `b_pass`,
    `ref`,
    `re_level`,
    `re_step`,
    `b_ip`,
    `b_read`,
    `b_writeday`,
    `b_html`,
    `userid`,
    `option_notice`,
    `option_bimil`
) VALUES
(
    'TEST-BOARD6-001',
    'board6',
    '[TEST] 총학생회 공지사항',
    '테스트관리자',
    'test_admin@example.test',
    '<p>총학생회 소식 게시판의 로컬 테스트 글입니다.</p>',
    '',
    0, 0, 0,
    '127.0.0.1',
    12,
    '2026-07-30 12:00:00',
    'Y',
    'test_admin',
    1,
    0
);

SET @board6_id = LAST_INSERT_ID();

INSERT INTO `BOARD_v1` (
    `board_code`, `b_part`, `b_title`, `b_name`, `b_email`, `b_text`,
    `b_pass`, `ref`, `re_level`, `re_step`, `b_ip`, `b_read`,
    `b_writeday`, `b_html`, `userid`, `option_notice`, `option_bimil`
) VALUES
('TEST-BOARD8-001', 'board8', '[TEST] 문화위원회 행사 안내', '테스트관리자',
 'test_admin@example.test', '<p>문화위원회 소식 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 7, '2026-07-30 12:10:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD7-001', 'board7', '[TEST] 학생복지 지원 안내', '테스트관리자',
 'test_admin@example.test', '<p>학생복지위원회 소식 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 5, '2026-07-30 12:20:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD32-001', 'board32', '[TEST] 학생인권위원회 공지', '테스트관리자',
 'test_admin@example.test', '<p>학생인권위원회 소식 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 3, '2026-07-30 12:30:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD9-001', 'board9', '[TEST] 졸업준비위원회 일정', '테스트관리자',
 'test_admin@example.test', '<p>졸업준비위원회 소식 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 9, '2026-07-30 12:40:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD26-001', 'board26', '[TEST] 동아리연합회 모집 안내', '테스트관리자',
 'test_admin@example.test', '<p>동아리연합회 소식 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 15, '2026-07-30 12:50:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD27-001', 'board27', '[TEST] 제휴 업체 안내', '테스트관리자',
 'test_admin@example.test', '<p>제휴 소식 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 20, '2026-07-30 13:00:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD11-001', 'board11', '[TEST] 자치활동 보고', '테스트회원',
 'test_user@example.test', '<p>자치활동보고 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 4, '2026-07-30 13:10:00', 'Y',
 'test_user', 0, 0),

('TEST-BOARD18-001', 'board18', '[TEST] 총학생회 회칙 안내', '테스트관리자',
 'test_admin@example.test', '<p>총학생회 회칙 및 세칙 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 6, '2026-07-30 13:20:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD19-001', 'board19', '[TEST] 중앙운영위원회 회의록', '테스트관리자',
 'test_admin@example.test', '<p>중앙운영위원회 회의록 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 8, '2026-07-30 13:30:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD20-001', 'board20', '[TEST] 총학생회 회계 공개', '테스트관리자',
 'test_admin@example.test', '<p>총학생회 회계 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 11, '2026-07-30 13:40:00', 'Y',
 'test_admin', 1, 0),

('TEST-BOARD17-001', 'board17', '[TEST] 단과대학 회칙 안내', '테스트관리자',
 'test_admin@example.test', '<p>단과대학 학생 회칙 및 세칙 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 2, '2026-07-30 13:50:00', 'Y',
 'test_admin', 0, 0),

('TEST-BOARD22-001', 'board22', '[TEST] 공간조정회의 결과', '테스트관리자',
 'test_admin@example.test', '<p>공간조정회의 테스트 데이터입니다.</p>',
 '', 0, 0, 0, '127.0.0.1', 10, '2026-07-30 14:00:00', 'Y',
 'test_admin', 0, 0),

('TEST-SECRET-001', 'board6', '[TEST] 비밀글 기능 확인', '테스트회원',
 'test_user@example.test', '<p>비밀글 표시 여부를 확인하기 위한 테스트 글입니다.</p>',
 'test1234', 0, 0, 0, '127.0.0.1', 0, '2026-07-30 14:10:00', 'Y',
 'test_user', 0, 1);


-- -----------------------------------------------------
-- 4. 댓글 더미데이터
-- -----------------------------------------------------
INSERT INTO `Reply` (
    `b_idx`,
    `userid`,
    `username`,
    `r_icon`,
    `r_text`,
    `r_date`
) VALUES
(CAST(@board6_id AS CHAR), 'test_user', '테스트회원', '0',
 '첫 번째 로컬 테스트 댓글입니다.', '2026-07-30 15:00:00'),
(CAST(@board6_id AS CHAR), 'test_admin', '테스트관리자', '0',
 '관리자 답변 테스트입니다.', '2026-07-30 15:05:00');


-- -----------------------------------------------------
-- 5. 유튜브 더미데이터
-- -----------------------------------------------------
INSERT INTO `tbl_youtube` (
    `strTitle`,
    `strUrl`,
    `strImg`,
    `strDate`
) VALUES
('[TEST] 총학생회 소개 영상',
 'https://www.youtube.com/watch?v=test_video_1',
 '/images/test-youtube-1.jpg',
 '2026-07-30'),
('[TEST] 행사 안내 영상',
 'https://www.youtube.com/watch?v=test_video_2',
 '/images/test-youtube-2.jpg',
 '2026-07-31');

COMMIT;


-- -----------------------------------------------------
-- 삽입 결과 확인용 쿼리
-- -----------------------------------------------------
SELECT 'mTb_Member2' AS table_name, COUNT(*) AS test_rows
FROM `mTb_Member2`
WHERE `strId` LIKE 'test_%'
UNION ALL
SELECT 'calendar_events', COUNT(*)
FROM `calendar_events`
WHERE `content` LIKE '[TEST]%'
UNION ALL
SELECT 'BOARD_v1', COUNT(*)
FROM `BOARD_v1`
WHERE `userid` LIKE 'test_%'
UNION ALL
SELECT 'Reply', COUNT(*)
FROM `Reply`
WHERE `userid` LIKE 'test_%'
UNION ALL
SELECT 'tbl_youtube', COUNT(*)
FROM `tbl_youtube`
WHERE `strTitle` LIKE '[TEST]%';
