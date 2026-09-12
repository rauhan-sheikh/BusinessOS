/**
 * Transactional email.
 *
 * Content lives in src/lib/email/templates, not in a third-party dashboard, so
 * a fresh deployment sends correct mail with no manual setup and the wording is
 * reviewed alongside the code that triggers it. A workspace may override the
 * BUSINESS-scoped templates; overrides render through the same escaping path as
 * the built-ins, so customising one cannot introduce an injection.
 */
import { Resend } from "resend";
import { prisma } from "@/db";
import { env } from "@/lib/env";
import { renderTemplate, htmlToText, type TemplateVariables } from "./render";
import {
  EMAIL_TEMPLATES,
  type EmailTemplateDefinition,
  type EmailTemplateKey,
} from "./templates";

export const resend = new Resend(env.RESEND_API_KEY);

export interface SendTemplateEmailInput {
  to: string;
  template: EmailTemplateKey;
  variables: TemplateVariables;
  /** Workspace whose override should apply, for BUSINESS-scoped templates. */
  businessId?: string | null;
}

interface ResolvedTemplate {
  subject: string;
  html: string;
}

/**
 * Returns the wording to send: a workspace override when one exists for a
 * customisable template, otherwise the built-in definition.
 *
 * A lookup failure falls back to the built-in rather than failing the send -
 * losing a customisation is recoverable, losing a password reset is not.
 */
async function resolveTemplate(
  definition: EmailTemplateDefinition,
  businessId?: string | null
): Promise<ResolvedTemplate> {
  const builtIn = { subject: definition.subject, html: definition.html };

  if (definition.scope !== "BUSINESS" || !businessId) {
    return builtIn;
  }

  try {
    const override = await prisma.emailTemplateOverride.findUnique({
      where: {
        businessId_templateKey: { businessId, templateKey: definition.key },
      },
      select: { subject: true, html: true },
    });

    return override ?? builtIn;
  } catch (error) {
    console.error(
      `Failed to load the ${definition.key} template override for business ${businessId}; using the built-in template.`,
      error
    );
    return builtIn;
  }
}

export async function sendTemplateEmail({
  to,
  template,
  variables,
  businessId,
}: SendTemplateEmailInput) {
  const definition = EMAIL_TEMPLATES[template];
  const resolved = await resolveTemplate(definition, businessId);

  // Subject is plain text, so escaping it would leak entities into the inbox.
  const subject = renderTemplate(resolved.subject, variables, { escape: false });
  const html = renderTemplate(resolved.html, variables);

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    // A text part meaningfully improves deliverability and serves clients that
    // refuse HTML.
    text: htmlToText(html),
  });

  if (error) {
    // Surfaced so a failed send is never mistaken for a delivered one.
    throw new Error(`Failed to send "${template}" email: ${error.message}`);
  }

  return data;
}

/** Renders a template without sending, for the admin preview. */
export function previewTemplate(
  resolved: ResolvedTemplate,
  variables: TemplateVariables
): ResolvedTemplate {
  return {
    subject: renderTemplate(resolved.subject, variables, { escape: false }),
    html: renderTemplate(resolved.html, variables),
  };
}

export type { EmailTemplateKey };
