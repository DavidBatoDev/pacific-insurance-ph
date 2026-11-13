const SEARCH_COLUMNS = ["first_name", "last_name", "email", "mobile_number", "reference_no"] as const;

/**
 * Whitespace-separated search tokens with the characters that would break
 * the PostgREST `or` filter grammar stripped out.
 */
export function searchTokens(query: string): string[] {
  return query
    .replace(/[,()%*]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * PostgREST `or` filter matching one token against any searchable column.
 * Chain one per token: successive `.or()` calls AND together, so every token
 * must match somewhere ("QA OCT2 Applicant" spans first_name + last_name).
 */
export function searchTokenFilter(token: string): string {
  const like = `%${token}%`;
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.${like}`).join(",");
}
