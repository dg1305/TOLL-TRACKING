-- =============================================================================
-- 3i Sales Funnel — MySQL Schema
-- Database: 3i_Sales_funnel
-- Charset: utf8mb4
-- Engine: InnoDB
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

CREATE DATABASE IF NOT EXISTS `3i_Sales_funnel`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `3i_Sales_funnel`;

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schema_migrations_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `site_name` VARCHAR(191) NOT NULL DEFAULT '3i Sales Funnel',
  `site_locale` VARCHAR(16) NOT NULL DEFAULT 'en-IN',
  `default_currency` CHAR(3) NOT NULL DEFAULT 'INR',
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  `alert_email` VARCHAR(191) NULL,
  `login_note` TEXT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_num` VARCHAR(64) NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(191) NULL,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(40) NULL,
  `jobtitle` VARCHAR(150) NULL,
  `region_key` VARCHAR(16) NULL,
  `activated` TINYINT(1) NOT NULL DEFAULT 1,
  `permissions` JSON NULL,
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `last_login` DATETIME NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_activated` (`activated`),
  KEY `idx_users_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_password_reset_hash` (`token_hash`),
  KEY `idx_password_reset_user` (`user_id`),
  CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `action_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `action_type` VARCHAR(64) NOT NULL,
  `item_type` VARCHAR(64) NULL,
  `item_id` VARCHAR(64) NULL,
  `note` TEXT NULL,
  `created_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_action_logs_user` (`user_id`),
  KEY `idx_action_logs_type` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `opportunities` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `customer` VARCHAR(191) NOT NULL,
  `location` VARCHAR(191) NULL,
  `region` VARCHAR(64) NULL,
  `region_key` VARCHAR(16) NOT NULL DEFAULT 'north',
  `customer_type` VARCHAR(64) NULL,
  `modality` VARCHAR(64) NULL,
  `product` VARCHAR(64) NULL,
  `value` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `site_status` VARCHAR(64) NULL,
  `funding_status` VARCHAR(64) NULL,
  `expected_closure` DATE NULL,
  `expected_closure_label` VARCHAR(191) NULL,
  `sales_status` VARCHAR(64) NULL,
  `stage` VARCHAR(8) NULL,
  `probability` INT NOT NULL DEFAULT 15,
  `process_stage` VARCHAR(32) NOT NULL DEFAULT 'new-enquiry',
  `owner` VARCHAR(191) NULL,
  `outcome` VARCHAR(16) NOT NULL DEFAULT 'open',
  `lost_reason` VARCHAR(191) NULL,
  `competitor` VARCHAR(191) NULL,
  `date_lost` DATE NULL,
  `data_issues` JSON NULL,
  `created_at` DATE NULL,
  `last_updated` DATE NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_opportunities_code` (`code`),
  KEY `idx_opportunities_region` (`region_key`),
  KEY `idx_opportunities_owner` (`owner`),
  KEY `idx_opportunities_outcome` (`outcome`),
  KEY `idx_opportunities_process` (`process_stage`),
  KEY `idx_opportunities_product` (`product`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `opportunity_remarks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `opportunity_id` INT UNSIGNED NOT NULL,
  `body` TEXT NOT NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_remarks_opp` (`opportunity_id`),
  CONSTRAINT `fk_remarks_opp` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `opportunity_activities` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `opportunity_id` INT UNSIGNED NOT NULL,
  `activity_date` DATE NULL,
  `title` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `created_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_activities_opp` (`opportunity_id`),
  CONSTRAINT `fk_activities_opp` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
