import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),

  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),

  type: text('type').notNull().default('http'),
  description: text('description'),

  config: jsonb('config').notNull(),
  rateLimit: jsonb('rate_limit'),

  timeoutMs: integer('timeout_ms').notNull().default(5000),
  enabled: boolean('enabled').notNull().default(true),

  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  createdBy: text('created_by').notNull().default('system'),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
  updatedBy: text('updated_by').notNull().default('system'),
});

export const toolExecutions = pgTable('tool_executions', {
  id: uuid('id').primaryKey().defaultRandom(),

  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id),

  toolSlug: text('tool_slug').notNull(),
  resolveSource: text('resolve_source').notNull(),

  status: text('status').notNull(),
  httpStatus: integer('http_status'),
  latencyMs: integer('latency_ms').notNull(),
  outputSizeBytes: integer('output_size_bytes').notNull().default(0),

  errorMessage: text('error_message'),

  rawOutput: jsonb('raw_output'),
  transformedOutput: jsonb('transformed_output'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  createdBy: text('created_by').notNull().default('system'),
});

export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type ToolExecution = typeof toolExecutions.$inferSelect;
export type NewToolExecution = typeof toolExecutions.$inferInsert;

