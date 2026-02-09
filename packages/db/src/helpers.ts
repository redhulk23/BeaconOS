import { eq, and, SQL, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

export function tenantScope<T extends { tenantId: PgColumn }>(
  table: T,
  tenantId: string,
): SQL {
  return eq(table.tenantId, tenantId);
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginationToOffset(params: PaginationParams): {
  limit: number;
  offset: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
