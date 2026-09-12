/**
 * Shared shell for transactional email.
 *
 * Table-based with inline styles on purpose: mail clients strip <style> blocks,
 * ignore flexbox and grid, and Outlook renders through Word. The palette
 * mirrors the application's dark surface so the mail reads as part of the
 * product. Body content is already-rendered HTML from a template.
 */

interface LayoutInput {
  /** Preview line shown in the inbox list before the mail is opened. */
  preheader: string;
  body: string;
}

export function emailLayout({ preheader, body }: LayoutInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>BusinessOS</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0b0f17;border:1px solid #1e293b;border-radius:16px;">
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#a5b4fc;letter-spacing:-0.01em;">BusinessOS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8;font-size:14px;line-height:1.6;">
${body}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <hr style="border:none;border-top:1px solid #1e293b;margin:0 0 16px 0;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#475569;">
              You are receiving this because an action was taken on your BusinessOS account. If it was not you, no action is required.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Heading used at the top of a message body. */
export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-size:21px;font-weight:700;color:#f8fafc;line-height:1.3;">${text}</h1>`;
}

/** Standard paragraph. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#94a3b8;">${html}</p>`;
}

/** Primary call-to-action. Rendered as a table so Outlook honours the padding. */
export function button(label: string, urlPlaceholder: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
  <tr>
    <td style="border-radius:10px;background-color:#4f46e5;">
      <a href="${urlPlaceholder}" style="display:inline-block;padding:12px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>`;
}

/** Fallback for clients that do not render the button. */
export function fallbackLink(urlPlaceholder: string): string {
  return `<p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#64748b;">
  If the button does not work, copy and paste this link into your browser:
</p>
<p style="margin:0 0 16px 0;font-size:11px;line-height:1.5;color:#818cf8;word-break:break-all;">${urlPlaceholder}</p>`;
}

/** Muted note, e.g. an expiry warning. */
export function note(text: string): string {
  return `<p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${text}</p>`;
}
