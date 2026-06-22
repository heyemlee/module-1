// Minimal class joiner — drops falsy values, joins with spaces.
// ponytail: no clsx/tailwind-merge dep; last-wins conflicts handled by ordering in callers.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
