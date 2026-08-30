import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";
import { sendTemplateEmail } from "@/lib/email";
import { emailListService } from "@/modules/emailList/services/emailList.service";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user?.email) {
            await emailListService.ensureEmail(user.email);
          }
        },
      },
    },
  },

  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,

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

  // TODO: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env and Vercel
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
