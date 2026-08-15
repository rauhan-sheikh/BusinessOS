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
