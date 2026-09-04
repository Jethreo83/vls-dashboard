// validators.ts — shared input parsing helpers. Every route that takes a
// numeric ID from req.params must use this instead of a bare Number(...)
// check: found live that huge numeric strings (beyond bigint range) pass
// Number.isInteger() as Infinity fails silently, but a merely-huge finite
// number still reaches Postgres and throws a raw "out of range for type
// bigint" error there, which the async wrapper caught but leaked as a 500
// with the DB's own error text instead of a clean 400.
export function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}
