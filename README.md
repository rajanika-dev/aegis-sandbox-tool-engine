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
- PostgreSQL 16
- Redis 7
- Drizzle ORM planned for database schema/migrations

## Server-first development

The recommended workflow is to edit code and manage Git from your laptop, while
running PostgreSQL, Redis, the NestJS app, and model access from a remote Ubuntu
server. Docker is optional and is not required for this setup.

See [docs/SERVER_SETUP.md](docs/SERVER_SETUP.md) for the server installation,
environment configuration, migrations, PM2 process management, health checks,
and safe access to `/demo`.

## Current Status

The backend is intended to run on a server and connect to PostgreSQL and Redis
there. The laptop is used for editing and Git; see the server setup guide for
runtime operations.

The `/health` endpoint confirms:

```json
{
  "api": "ok",
  "postgres": "ok",
  "redis": "ok"
}
