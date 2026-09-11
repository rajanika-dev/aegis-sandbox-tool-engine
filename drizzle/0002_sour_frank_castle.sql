CREATE TABLE "agent_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"created_by" text DEFAULT 'demo-user' NOT NULL,
	"status" text NOT NULL,
	"answer" text,
	"planner" text,
	"steps" jsonb,
	"error_message" text,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
