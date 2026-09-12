/**
 * Template rendering.
 *
 * Built-in templates and admin-edited overrides go through this same path, so
 * escaping cannot be bypassed by editing a template. Variables are substituted
 * into `{{NAME}}` placeholders and HTML-escaped on the way in - the previous
 * invitation mail interpolated a workspace name into raw HTML, which let a
 * crafted name inject markup into a genuine BusinessOS email.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Only http(s) links are emitted.
 *
 * Application-generated URLs are always safe; this guards the admin-editable
 * path, where a pasted `javascript:` or `data:` URL would otherwise survive
 * into a mail client.
 */
export function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return escapeHtml(url.toString());
    }
  } catch {
    // fall through
  }
  return "#";
}

/** Placeholders whose value is used as a link target rather than as text. */
const URL_VARIABLE = /_URL$/;

const PLACEHOLDER = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

export type TemplateVariables = Record<string, string>;

/**
 * Substitutes `{{NAME}}` placeholders.
 *
 * An unknown placeholder renders as an empty string rather than leaving the
 * raw `{{NAME}}` visible to the recipient.
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables,
  { escape = true }: { escape?: boolean } = {}
): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null) return "";
    if (!escape) return String(value);

    return URL_VARIABLE.test(name) ? safeUrl(String(value)) : escapeHtml(String(value));
  });
}

/** Strips tags to derive a plain-text part, which helps deliverability. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
