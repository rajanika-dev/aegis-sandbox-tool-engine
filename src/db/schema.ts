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