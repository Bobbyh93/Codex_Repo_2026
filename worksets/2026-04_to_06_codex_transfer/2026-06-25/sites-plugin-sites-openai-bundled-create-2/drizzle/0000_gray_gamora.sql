CREATE TABLE `review_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`previous_status` text,
	`status` text NOT NULL,
	`assignee` text,
	`notes` text,
	`priority` text,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`title` text NOT NULL,
	`source_status` text NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`updated_by` text,
	`updated_at` text NOT NULL
);
