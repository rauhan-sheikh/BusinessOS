/**
 * Joins class names, dropping falsy entries.
 *
 * Deliberately not a clsx/tailwind-merge dependency: the components here take a
 * `className` that is appended last, and Tailwind's later-wins ordering within
 * a single class attribute is enough for the overrides they actually need.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
