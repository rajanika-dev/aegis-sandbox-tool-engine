# AEGIS Sandbox Tool Engine

This is a learning project for understanding AEGIS's Tool / ActionModule execution flow.

This is not production code.

## Purpose

The goal of this project is to build a smaller version of the AEGIS tool execution pipeline.

The simplified sandbox pipeline is:

Resolve → Rate Check → Execute → Transform → Record

## Current Stack

- NestJS
- Fastify adapter
- TypeScript strict mode
- PostgreSQL 16 through Docker
- Redis 7 through Docker
- Drizzle ORM planned for database schema/migrations

## Current Status

The local backend is running and connects to both Postgres and Redis.

The `/health` endpoint confirms:

```json
{
  "api": "ok",
  "postgres": "ok",
  "redis": "ok"
}
