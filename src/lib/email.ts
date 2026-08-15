import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  return resend.emails.send({
    from: process.env.EMAIL_FROM as string,
    to,
    subject,
    html,
  });
}
