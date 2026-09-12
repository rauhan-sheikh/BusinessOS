import { prisma } from "@/db";
import { AppError } from "@/shared/errors/app-error";
import { PERMISSION, requirePermission, type Actor } from "@/modules/auth/permissions";
import {
  EMAIL_TEMPLATES,
  CUSTOMISABLE_TEMPLATES,
  isEmailTemplateKey,
  type EmailTemplateDefinition,
  type EmailTemplateKey,
} from "@/lib/email/templates";
import { renderTemplate } from "@/lib/email/render";
import {
  saveEmailTemplateSchema,
  type SaveEmailTemplateInput,
} from "../schemas/email-template.schema";

export interface EmailTemplateView {
  key: EmailTemplateKey;
  name: string;
  description: string;
  variables: EmailTemplateDefinition["variables"];
  /** Wording currently in effect. */
  subject: string;
  html: string;
  /** The built-in wording, so the editor can show and restore it. */
  defaultSubject: string;
  defaultHtml: string;
  isCustomised: boolean;
  updatedAt: Date | null;
  updatedByName: string | null;
}

/**
 * Only templates declared BUSINESS-scoped are addressable here. Platform mail
 * (verification, password reset) is sent with no workspace context and on
 * behalf of every tenant, so it is deliberately not editable by one of them.
 */
function requireCustomisable(key: string): EmailTemplateDefinition {
  if (!isEmailTemplateKey(key)) {
    throw new AppError(`Unknown email template "${key}".`, 404);
  }

  const definition = EMAIL_TEMPLATES[key];
  if (definition.scope !== "BUSINESS") {
    throw new AppError(
      `The "${definition.name}" email is sent by the platform and cannot be customised per workspace.`,
      403
    );
  }

  return definition;
}

export class EmailTemplateService {
  /** Every customisable template, with any workspace override applied. */
  async listTemplates(businessId: string, actor: Actor): Promise<EmailTemplateView[]> {
    requirePermission(actor, PERMISSION.EMAIL_TEMPLATE_MANAGE);

    const overrides = await prisma.emailTemplateOverride.findMany({
      where: { businessId },
      include: { updatedBy: { select: { name: true } } },
    });

    const byKey = new Map(overrides.map((o) => [o.templateKey, o]));

    return CUSTOMISABLE_TEMPLATES.map((definition) => {
      const override = byKey.get(definition.key);

      return {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        variables: definition.variables,
        subject: override?.subject ?? definition.subject,
        html: override?.html ?? definition.html,
        defaultSubject: definition.subject,
        defaultHtml: definition.html,
        isCustomised: Boolean(override),
        updatedAt: override?.updatedAt ?? null,
        updatedByName: override?.updatedBy?.name ?? null,
      };
    });
  }

  /**
   * Stores a workspace's wording for one template.
   *
   * The saved text is not sanitised here: it is stored verbatim and escaped at
   * render time, exactly like the built-in templates, so a customisation cannot
   * introduce an injection no matter what is pasted in.
   */
  async saveOverride(
    businessId: string,
    actor: Actor,
    key: string,
    input: SaveEmailTemplateInput
  ) {
    requirePermission(actor, PERMISSION.EMAIL_TEMPLATE_MANAGE);

    const definition = requireCustomisable(key);
    const validated = saveEmailTemplateSchema.parse(input);

    this.assertOnlyKnownVariables(definition, validated.subject, validated.html);

    return prisma.emailTemplateOverride.upsert({
      where: { businessId_templateKey: { businessId, templateKey: definition.key } },
      create: {
        businessId,
        templateKey: definition.key,
        subject: validated.subject,
        html: validated.html,
        updatedById: actor.userId,
      },
      update: {
        subject: validated.subject,
        html: validated.html,
        updatedById: actor.userId,
      },
    });
  }

  /** Drops the override, so the built-in template applies again. */
  async resetToDefault(businessId: string, actor: Actor, key: string) {
    requirePermission(actor, PERMISSION.EMAIL_TEMPLATE_MANAGE);

    const definition = requireCustomisable(key);

    await prisma.emailTemplateOverride.deleteMany({
      where: { businessId, templateKey: definition.key },
    });

    return { key: definition.key, reset: true };
  }

  /** Renders wording with sample values, without sending anything. */
  async preview(actor: Actor, key: string, input?: Partial<SaveEmailTemplateInput>) {
    requirePermission(actor, PERMISSION.EMAIL_TEMPLATE_MANAGE);

    const definition = requireCustomisable(key);
    const subject = input?.subject ?? definition.subject;
    const html = input?.html ?? definition.html;

    return {
      subject: renderTemplate(subject, definition.sample, { escape: false }),
      html: renderTemplate(html, definition.sample),
    };
  }

  /**
   * Rejects placeholders the template does not define.
   *
   * A stray `{{FOO}}` renders as an empty string, so catching it at save time
   * is the difference between a visible mistake and a silently blank line in
   * mail that has already gone out.
   */
  private assertOnlyKnownVariables(
    definition: EmailTemplateDefinition,
    subject: string,
    html: string
  ) {
    const known = new Set(definition.variables.map((v) => v.name));
    const used = new Set<string>();

    for (const source of [subject, html]) {
      for (const match of source.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) {
        used.add(match[1]);
      }
    }

    const unknown = [...used].filter((name) => !known.has(name));
    if (unknown.length > 0) {
      throw new AppError(
        `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown
          .map((name) => `{{${name}}}`)
          .join(", ")}. Available: ${[...known].map((n) => `{{${n}}}`).join(", ")}.`,
        400
      );
    }
  }
}

export const emailTemplateService = new EmailTemplateService();
