import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Shared contracts for the repository layer.
 *
 * Repositories expose an interface (the port) that the application depends on.
 * The Supabase implementation (the adapter) is the only thing that knows about
 * supabase-js. Swap in an in-memory implementation for tests without touching
 * callers.
 */

/** A failure originating in the data layer, decoupled from supabase-js. */
export class RepositoryError extends Error {
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message, { cause: options?.cause });
    this.name = "RepositoryError";
    this.code = options?.code;
  }
}

/** Common list/pagination parameters. */
export interface ListParams {
  limit?: number;
  offset?: number;
  /** Column to sort by (defaults are per-repository). */
  orderBy?: string;
  ascending?: boolean;
}

/** A page of rows plus the total count of matching records. */
export interface Paginated<T> {
  rows: T[];
  total: number;
}

/** Map a supabase-js PostgrestError into a RepositoryError. */
export function toRepositoryError(
  context: string,
  error: PostgrestError,
): RepositoryError {
  return new RepositoryError(`${context}: ${error.message}`, {
    cause: error,
    code: error.code,
  });
}
