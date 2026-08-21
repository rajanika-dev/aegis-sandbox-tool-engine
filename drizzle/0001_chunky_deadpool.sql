CREATE TABLE "tool_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"tool_slug" text NOT NULL,
	"resolve_source" text NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"latency_ms" integer NOT NULL,
	"output_size_bytes" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"raw_output" jsonb,
	"transformed_output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE no action ON UPDATE no action;