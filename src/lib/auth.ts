import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendOnSignUp: true,

    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your BusinessOS email",
        html: `
          <!DOCTYPE html>
          <html>
            <body>
              <h1>Verify your email</h1>

              <p>Hello ${user.name},</p>

              <p>
                Welcome to BusinessOS.
                Please verify your email address to continue.
              </p>

              <p>
                <a href="${url}">
                  Verify my email
                </a>
              </p>

              <p>
                This verification link expires in 1 hour.
              </p>

              <p>
                If you didn't create a BusinessOS account,
                you can safely ignore this email.
              </p>

              <p>
                — BusinessOS
              </p>
            </body>
          </html>
        `,
      });
    },
    expiresIn: 60 * 60, // 1 hour
  },
});
