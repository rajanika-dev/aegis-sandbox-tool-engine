import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import postgres from 'postgres';
import { Tool } from '../db/schema';

type SqlToolInput = {
  sql?: unknown;
};

type SqlToolConfig = {
  allowedTables?: unknown;
  maxRows?: unknown;
  statementTimeoutMs?: unknown;
};

type SafeSqlResult = {
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  latencyMs: number;
};

@Injectable()
export class SqlToolExecutorService implements OnModuleDestroy {
  private readonly client = postgres(process.env.DATABASE_URL ?? '', {
    max: 3,
  });

  async execute(
    tool: Tool,
    input: Record<string, unknown> = {},
  ): Promise<{
    status: number;
    ok: boolean;
    data: SafeSqlResult;
  }> {
    const sqlInput = (input as SqlToolInput).sql;

    if (typeof sqlInput !== 'string' || sqlInput.trim().length === 0) {
      throw new BadRequestException({
        code: 'INVALID_SQL_INPUT',
        message: 'sql is required for sql_query tool.',
      });
    }

    const config = this.asConfig(tool.config);
    const allowedTables = this.getAllowedTables(config);
    const maxRows = this.getMaxRows(config);
    const statementTimeoutMs = this.getStatementTimeoutMs(config);

    const safeSql = this.validateAndNormalizeSql(
      sqlInput,
      allowedTables,
      maxRows,
    );

    const startedAt = Date.now();

    const rows = await this.client.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL statement_timeout = ${statementTimeoutMs}`);
      return tx.unsafe(safeSql);
    });

    const latencyMs = Date.now() - startedAt;
    const normalizedRows = rows.map((row) => ({ ...row }));

    return {
      status: 200,
      ok: true,
      data: {
        sql: safeSql,
        rows: normalizedRows,
        rowCount: normalizedRows.length,
        latencyMs,
      },
    };
  }

  async onModuleDestroy() {
    await this.client.end();
  }

  private validateAndNormalizeSql(
    rawSql: string,
    allowedTables: string[],
    maxRows: number,
  ): string {
    let sql = rawSql.trim();

    if (sql.endsWith(';')) {
      sql = sql.slice(0, -1).trim();
    }

    if (sql.includes(';')) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_MULTIPLE_STATEMENTS',
        message: 'Only one SQL statement is allowed.',
      });
    }

    if (sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_COMMENTS',
        message: 'SQL comments are not allowed in this MVP.',
      });
    }

    if (!/^select\b/i.test(sql)) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_NOT_SELECT',
        message: 'Only SELECT queries are allowed.',
      });
    }

    const forbiddenPattern =
      /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|merge|call|execute)\b/i;

    if (forbiddenPattern.test(sql)) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_FORBIDDEN_KEYWORD',
        message: 'SQL contains a forbidden keyword.',
      });
    }

    const referencedTables = this.extractReferencedTables(sql);

    if (referencedTables.length === 0) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_NO_TABLE',
        message: 'Query must reference an allowed table.',
      });
    }

    const allowed = new Set(allowedTables.map((table) => table.toLowerCase()));

    const blockedTables = referencedTables.filter(
      (table) => !allowed.has(table.toLowerCase()),
    );

    if (blockedTables.length > 0) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_TABLE_NOT_ALLOWED',
        message: `Query references blocked table(s): ${blockedTables.join(
          ', ',
        )}`,
      });
    }

    return this.enforceLimit(sql, maxRows);
  }

  private extractReferencedTables(sql: string): string[] {
    const matches = sql.matchAll(
      /\b(?:from|join)\s+("?[\w.]+"?)/gi,
    );

    const tables = new Set<string>();

    for (const match of matches) {
      const rawTable = match[1]
        .replaceAll('"', '')
        .trim()
        .toLowerCase();

      const tableWithoutSchema = rawTable.includes('.')
        ? rawTable.split('.').at(-1)
        : rawTable;

      if (tableWithoutSchema) {
        tables.add(tableWithoutSchema);
      }
    }

    return [...tables];
  }

  private enforceLimit(sql: string, maxRows: number): string {
    const limitMatch = sql.match(/\blimit\s+(\d+)\b/i);

    if (!limitMatch) {
      return `${sql} LIMIT ${maxRows}`;
    }

    const requestedLimit = Number(limitMatch[1]);

    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      throw new BadRequestException({
        code: 'UNSAFE_SQL_INVALID_LIMIT',
        message: 'LIMIT must be a positive number.',
      });
    }

    if (requestedLimit <= maxRows) {
      return sql;
    }

    return sql.replace(/\blimit\s+\d+\b/i, `LIMIT ${maxRows}`);
  }

  private asConfig(value: unknown): SqlToolConfig {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as SqlToolConfig;
    }

    return {};
  }

  private getAllowedTables(config: SqlToolConfig): string[] {
    if (
      Array.isArray(config.allowedTables) &&
      config.allowedTables.every((table) => typeof table === 'string')
    ) {
      return config.allowedTables;
    }

    return ['tools', 'tool_executions'];
  }

  private getMaxRows(config: SqlToolConfig): number {
    const value = Number(config.maxRows);

    if (Number.isFinite(value) && value > 0) {
      return Math.min(value, 100);
    }

    return 50;
  }

  private getStatementTimeoutMs(config: SqlToolConfig): number {
    const value = Number(config.statementTimeoutMs);

    if (Number.isFinite(value) && value > 0) {
      return Math.min(value, 10000);
    }

    return 5000;
  }
}
