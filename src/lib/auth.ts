import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";
import { sendTemplateEmail } from "@/lib/email";

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
      await sendTemplateEmail({
        to: user.email,
        templateAlias: process.env.RESEND_VERIFICATION_TEMPLATE_ALIAS as string,
        variables: {
          USER_NAME: user.name,
          VERIFICATION_URL: url,
        },
      });
    },

    expiresIn: 60 * 60,
  },
});
