/**
 * Resend integration boundary.
 *
 * Presentation lives in Resend templates, not in this codebase: the rest of the
 * application supplies variables and never composes HTML. Beyond keeping email
 * design out of application code (Plan.md section 26), this removes an injection
 * surface - the previous invitation mail interpolated inviterName and
 * businessName into a raw HTML string unescaped, so a crafted workspace name
 * could inject markup into a genuine BusinessOS email.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

export const resend = new Resend(env.RESEND_API_KEY);

type TemplateVariables = Record<string, string | number>;

type SendTemplateEmailInput = {
  to: string;
  templateAlias: string;
  variables: TemplateVariables;
};

export async function sendTemplateEmail({
  to,
  templateAlias,
  variables,
}: SendTemplateEmailInput) {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    template: {
      id: templateAlias,
      variables,
    },
  });

  if (error) {
    // Surfaced to the caller so a failed send is not mistaken for a sent one.
    throw new Error(`Failed to send "${templateAlias}" email: ${error.message}`);
  }

  return data;
}

type SendInvitationEmailInput = {
  to: string;
  inviterName: string;
  businessName: string;
  role: string;
  inviteUrl: string;
};

export async function sendInvitationEmail({
  to,
  inviterName,
  businessName,
  role,
  inviteUrl,
}: SendInvitationEmailInput) {
  return sendTemplateEmail({
    to,
    templateAlias: env.RESEND_INVITATION_TEMPLATE_ALIAS,
    variables: {
      INVITER_NAME: inviterName,
      BUSINESS_NAME: businessName,
      ROLE: role,
      INVITE_URL: inviteUrl,
    },
  });
}
