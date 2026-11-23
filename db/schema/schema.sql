-- CAUGSA schema based on the 2026-08 API specification and ERD.
-- MariaDB 10.5+
--
-- This file recreates the application tables. Back up production data and
-- prepare a migration before running it against an existing database.

SET NAMES utf8mb4;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `Attachment`;
DROP TABLE IF EXISTS `Event`;
DROP TABLE IF EXISTS `Post`;
DROP TABLE IF EXISTS `Board`;
DROP TABLE IF EXISTS `User`;
DROP TABLE IF EXISTS `Organization`;
DROP TABLE IF EXISTS `Menu`;

-- Remove legacy tables when this schema is used to recreate a database.
DROP TABLE IF EXISTS `Reply`;
DROP TABLE IF EXISTS `BOARD_v1`;
DROP TABLE IF EXISTS `calendar_events`;
DROP TABLE IF EXISTS `mTb_Member2`;
DROP TABLE IF EXISTS `tbl_youtube`;

CREATE TABLE `Menu` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Organization` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_organization_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `User` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `login_id` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `sub_email` VARCHAR(150) DEFAULT NULL,
  `student_id` INT UNSIGNED DEFAULT NULL,
  `mobile` VARCHAR(30) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'user',
  `is_approved` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `college` VARCHAR(100) DEFAULT NULL,
  `major` VARCHAR(100) DEFAULT NULL,
  -- Required by the profile API although omitted from the ERD image.
  `zip_code` VARCHAR(10) DEFAULT NULL,
  `address1` VARCHAR(200) DEFAULT NULL,
  `address2` VARCHAR(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_login_id` (`login_id`),
  UNIQUE KEY `uq_user_student_id` (`student_id`),
  KEY `idx_user_approval_created` (`is_approved`, `created_at`),
  CONSTRAINT `chk_user_role` CHECK (`role` IN ('user', 'admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Board` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `menu_id` INT UNSIGNED NOT NULL,
  `organization_id` INT UNSIGNED DEFAULT NULL,
  -- API-facing board slug, for example student-council.
  `name` VARCHAR(100) NOT NULL,
  `is_event` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_board_name` (`name`),
  KEY `idx_board_menu` (`menu_id`),
  KEY `idx_board_organization` (`organization_id`),
  CONSTRAINT `fk_board_menu`
    FOREIGN KEY (`menu_id`) REFERENCES `Menu` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_board_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `Organization` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Post` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `writer` INT UNSIGNED NOT NULL,
  `board_type` INT UNSIGNED NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `view_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `menu_id` INT UNSIGNED NOT NULL,
  -- Required by the list response although omitted from the ERD image.
  `is_notice` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  KEY `idx_post_board_created` (`board_type`, `created_at`, `id`),
  KEY `idx_post_writer` (`writer`),
  KEY `idx_post_menu` (`menu_id`),
  CONSTRAINT `fk_post_writer`
    FOREIGN KEY (`writer`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_post_board`
    FOREIGN KEY (`board_type`) REFERENCES `Board` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_post_menu`
    FOREIGN KEY (`menu_id`) REFERENCES `Menu` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Attachment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `file_type` VARCHAR(100) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  -- Generated server-side name used to avoid collisions and path traversal.
  `stored_name` VARCHAR(255) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `post_id` INT UNSIGNED NOT NULL,
  `menu_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attachment_stored_name` (`stored_name`),
  KEY `idx_attachment_post_order` (`post_id`, `sort_order`),
  KEY `idx_attachment_menu` (`menu_id`),
  CONSTRAINT `fk_attachment_post`
    FOREIGN KEY (`post_id`) REFERENCES `Post` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_attachment_menu`
    FOREIGN KEY (`menu_id`) REFERENCES `Menu` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED DEFAULT NULL,
  `post_id` INT UNSIGNED DEFAULT NULL,
  `is_visible` BOOLEAN NOT NULL DEFAULT TRUE,
  `apply_date` DATE DEFAULT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `menu_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_event_visible_date` (`is_visible`, `start_date`),
  KEY `idx_event_organization` (`organization_id`),
  KEY `idx_event_post` (`post_id`),
  KEY `idx_event_menu` (`menu_id`),
  CONSTRAINT `fk_event_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `Organization` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_event_post`
    FOREIGN KEY (`post_id`) REFERENCES `Post` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_event_menu`
    FOREIGN KEY (`menu_id`) REFERENCES `Menu` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reference rows needed to resolve the board slugs used by the API.
INSERT INTO `Menu` (`name`) VALUES
  ('news'),
  ('student-autonomy'),
  ('convenience-info');

INSERT INTO `Organization` (`name`) VALUES
  ('중앙집행위원회'),
  ('문화위원회'),
  ('학생복지위원회'),
  ('학생인권위원회'),
  ('졸업준비위원회'),
  ('동아리연합회'),
  ('제휴사업'),
  ('학생자치활동'),
  ('의회'),
  ('회계사무국'),
  ('홍보소통국'),
  ('교육자치국'),
  ('전략정책국'),
  ('연대사업국'),
  ('일상사업국'),
  ('생활복지사업');

INSERT INTO `Board` (`menu_id`, `organization_id`, `name`, `is_event`)
SELECT m.id, o.id, seed.name, seed.is_event
FROM (
  SELECT 'news' menu_name, '중앙집행위원회' organization_name, 'student-council' name, FALSE is_event
  UNION ALL SELECT 'news', '문화위원회', 'culture-committee', FALSE
  UNION ALL SELECT 'news', '학생복지위원회', 'welfare-committee', FALSE
  UNION ALL SELECT 'news', '학생인권위원회', 'human-rights-committee', FALSE
  UNION ALL SELECT 'news', '졸업준비위원회', 'graduation-committee', FALSE
  UNION ALL SELECT 'student-autonomy', '동아리연합회', 'club-union', FALSE
  UNION ALL SELECT 'convenience-info', '제휴사업', 'affiliate', FALSE
  UNION ALL SELECT 'student-autonomy', '학생자치활동', 'activity', TRUE
  UNION ALL SELECT 'student-autonomy', '의회', 'council-rules', FALSE
  UNION ALL SELECT 'student-autonomy', '의회', 'central-committee', FALSE
  UNION ALL SELECT 'news', '회계사무국', 'accounting', FALSE
  UNION ALL SELECT 'student-autonomy', '의회', 'department-rules', FALSE
  UNION ALL SELECT 'convenience-info', '생활복지사업', 'space-adjustment', FALSE
  UNION ALL SELECT 'news', '홍보소통국', 'promo-council', FALSE
  UNION ALL SELECT 'news', '교육자치국', 'edu-council', FALSE
  UNION ALL SELECT 'news', '전략정책국', 'strategy-council', FALSE
  UNION ALL SELECT 'news', '연대사업국', 'unity-council', FALSE
  UNION ALL SELECT 'news', '일상사업국', 'life-council', FALSE
  UNION ALL SELECT 'convenience-info', '생활복지사업', 'resident-business', FALSE
) AS seed
JOIN `Menu` AS m ON m.name = seed.menu_name
JOIN `Organization` AS o ON o.name = seed.organization_name;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
