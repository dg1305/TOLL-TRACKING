-- FASTag vehicle lookups: uploaded sheets, vehicles, and stored toll responses.

CREATE TABLE IF NOT EXISTS `fastag_batches` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(255) NOT NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'excel',
  `uploaded_by` INT UNSIGNED NULL,
  `vehicle_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `ok_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `error_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `read_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ready',
  `error_message` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL,
  `started_at` DATETIME NULL,
  `finished_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fastag_batches_created` (`created_at`),
  KEY `idx_fastag_batches_status` (`status`),
  CONSTRAINT `fk_fastag_batch_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fastag_vehicles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `batch_id` INT UNSIGNED NOT NULL,
  `vehicle_reg_no` VARCHAR(20) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `http_status` INT NULL,
  `error_message` VARCHAR(500) NULL,
  `read_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `fetched_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fastag_batch_vehicle` (`batch_id`, `vehicle_reg_no`),
  KEY `idx_fastag_vehicles_reg` (`vehicle_reg_no`),
  CONSTRAINT `fk_fastag_vehicle_batch` FOREIGN KEY (`batch_id`) REFERENCES `fastag_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fastag_reads` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `batch_id` INT UNSIGNED NOT NULL,
  `vehicle_id` INT UNSIGNED NOT NULL,
  `vehicle_reg_no` VARCHAR(20) NOT NULL,
  `reader_read_time` VARCHAR(40) NULL,
  `seq_no` VARCHAR(128) NULL,
  `lane_direction` VARCHAR(16) NULL,
  `toll_plaza_geocode` VARCHAR(80) NULL,
  `toll_plaza_name` VARCHAR(191) NULL,
  `vehicle_type` VARCHAR(32) NULL,
  `raw_json` JSON NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fastag_batch_seq` (`batch_id`, `seq_no`),
  KEY `idx_fastag_reads_vehicle` (`vehicle_reg_no`),
  KEY `idx_fastag_reads_batch` (`batch_id`),
  CONSTRAINT `fk_fastag_read_batch` FOREIGN KEY (`batch_id`) REFERENCES `fastag_batches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fastag_read_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `fastag_vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
