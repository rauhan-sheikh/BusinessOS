import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

type SendTemplateEmailInput = {
  to: string;
  templateAlias: string;
  variables: Record<string, string | number>;
};

export async function sendTemplateEmail({
  to,
  templateAlias,
  variables,
}: SendTemplateEmailInput) {
  return resend.emails.send({
    from: process.env.EMAIL_FROM as string,
    to,
    template: {
      id: templateAlias,
      variables,
    },
  });
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
  const from = process.env.EMAIL_FROM || "BusinessOS <no-reply@businessos.com>";

  return resend.emails.send({
    from,
    to,
    subject: `You've been invited to join ${businessName} on BusinessOS`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; background-color: #0B0F17; color: #F1F5F9; border-radius: 16px; border: 1px solid #1E293B;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 20px; font-weight: 800; background: linear-gradient(to right, #F8FAFC, #CBD5E1, #A5B4FC); -webkit-background-clip: text; color: #A5B4FC;">
            BusinessOS
          </span>
        </div>
        <h2 style="font-size: 22px; font-weight: 700; color: #F8FAFC; margin-bottom: 12px;">
          Join ${businessName} Workspace
        </h2>
        <p style="font-size: 14px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px;">
          <strong>${inviterName}</strong> has invited you to join the <strong>${businessName}</strong> workspace with the role of <strong>${role}</strong>.
        </p>
        <div style="margin-bottom: 32px;">
          <a href="${inviteUrl}" style="display: inline-block; background-color: #4F46E5; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none;">
            Accept Invitation &rarr;
          </a>
        </div>
        <p style="font-size: 12px; color: #64748B; line-height: 1.5; margin-bottom: 8px;">
          If the button above does not work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 11px; color: #818CF8; word-break: break-all;">
          ${inviteUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #1E293B; margin: 28px 0;" />
        <p style="font-size: 11px; color: #475569;">
          This invitation link will expire in 7 days. If you were not expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
