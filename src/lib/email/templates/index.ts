/**
 * The catalogue of transactional emails BusinessOS sends.
 *
 * Each entry is a subject and an HTML body containing `{{VARIABLE}}`
 * placeholders. Keeping them here rather than in a third-party dashboard means
 * a fresh deployment sends correct mail with no manual setup, the content is
 * reviewed in pull requests alongside the code that triggers it, and the
 * rendering path applies escaping that a hosted editor could not.
 *
 * Definitions are also the source of truth for the admin editor: `variables`
 * drives the list of available placeholders, and `sample` powers the preview.
 */
import {
  emailLayout,
  heading,
  paragraph,
  button,
  fallbackLink,
  note,
} from "./layout";

export const EMAIL_TEMPLATE_KEYS = [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
  "TEAM_INVITATION",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplateVariable {
  name: string;
  description: string;
}

/**
 * Who owns a template's wording.
 *
 * PLATFORM mail is sent with no workspace context - sign-up verification
 * happens before anyone belongs to a business, and a password reset spans every
 * workspace a person is in. Letting one tenant rewrite those would change mail
 * sent on behalf of all of them, so they stay code-only.
 *
 * BUSINESS mail is addressed on a specific workspace's behalf and is safe for
 * that workspace's owner to customise.
 */
export type EmailTemplateScope = "PLATFORM" | "BUSINESS";

export interface EmailTemplateDefinition {
  key: EmailTemplateKey;
  /** Shown in the admin editor. */
  name: string;
  description: string;
  scope: EmailTemplateScope;
  subject: string;
  html: string;
  variables: EmailTemplateVariable[];
  /** Placeholder values used to render a preview. */
  sample: Record<string, string>;
}

const verificationBody = [
  heading("Confirm your email address"),
  paragraph("Hi {{USER_NAME}}, welcome to BusinessOS. Confirm this address to activate your account."),
  button("Verify email address", "{{VERIFICATION_URL}}"),
  fallbackLink("{{VERIFICATION_URL}}"),
  note("This link expires in one hour. If you did not create a BusinessOS account, you can ignore this email."),
].join("\n");

const passwordResetBody = [
  heading("Reset your password"),
  paragraph("Hi {{USER_NAME}}, we received a request to reset the password for your BusinessOS account."),
  button("Choose a new password", "{{RESET_URL}}"),
  fallbackLink("{{RESET_URL}}"),
  note("If you did not request this, you can safely ignore this email - your password will not change."),
].join("\n");

const invitationBody = [
  heading("Join {{BUSINESS_NAME}} on BusinessOS"),
  paragraph("<strong>{{INVITER_NAME}}</strong> has invited you to join the <strong>{{BUSINESS_NAME}}</strong> workspace as <strong>{{ROLE}}</strong>."),
  button("Accept invitation", "{{INVITE_URL}}"),
  fallbackLink("{{INVITE_URL}}"),
  note("This invitation expires in 7 days. If you were not expecting it, you can ignore this email."),
].join("\n");

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateDefinition> = {
  EMAIL_VERIFICATION: {
    key: "EMAIL_VERIFICATION",
    name: "Email verification",
    description: "Sent when someone signs up, to confirm they own the address.",
    scope: "PLATFORM",
    subject: "Verify your BusinessOS email address",
    html: emailLayout({
      preheader: "Confirm your email address to activate your BusinessOS account.",
      body: verificationBody,
    }),
    variables: [
      { name: "USER_NAME", description: "Recipient's full name" },
      { name: "VERIFICATION_URL", description: "One-time verification link" },
    ],
    sample: {
      USER_NAME: "Rauhan Sheikh",
      VERIFICATION_URL: "https://businessos.example.com/verify-email?token=sample",
    },
  },

  PASSWORD_RESET: {
    key: "PASSWORD_RESET",
    name: "Password reset",
    description: "Sent when someone requests a password reset from the sign-in screen.",
    scope: "PLATFORM",
    subject: "Reset your BusinessOS password",
    html: emailLayout({
      preheader: "Choose a new password for your BusinessOS account.",
      body: passwordResetBody,
    }),
    variables: [
      { name: "USER_NAME", description: "Recipient's full name" },
      { name: "RESET_URL", description: "One-time password reset link" },
    ],
    sample: {
      USER_NAME: "Rauhan Sheikh",
      RESET_URL: "https://businessos.example.com/reset-password?token=sample",
    },
  },

  TEAM_INVITATION: {
    key: "TEAM_INVITATION",
    name: "Team invitation",
    description: "Sent when an owner or admin invites someone to a workspace.",
    scope: "BUSINESS",
    subject: "You have been invited to join {{BUSINESS_NAME}} on BusinessOS",
    html: emailLayout({
      preheader: "{{INVITER_NAME}} has invited you to a BusinessOS workspace.",
      body: invitationBody,
    }),
    variables: [
      { name: "INVITER_NAME", description: "Name of the person sending the invitation" },
      { name: "BUSINESS_NAME", description: "Workspace being joined" },
      { name: "ROLE", description: "Role the recipient is being granted" },
      { name: "INVITE_URL", description: "One-time invitation link" },
    ],
    sample: {
      INVITER_NAME: "Rauhan Sheikh",
      BUSINESS_NAME: "Acme Traders",
      ROLE: "ACCOUNTANT",
      INVITE_URL: "https://businessos.example.com/invite/sample-token",
    },
  },
};

export function getTemplateDefinition(key: EmailTemplateKey): EmailTemplateDefinition {
  return EMAIL_TEMPLATES[key];
}

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

/** Templates a workspace owner may customise. */
export const CUSTOMISABLE_TEMPLATES: EmailTemplateDefinition[] = Object.values(
  EMAIL_TEMPLATES
).filter((template) => template.scope === "BUSINESS");
