import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";
import { sendTemplateEmail } from "@/lib/email";
import { env, hasGoogleOAuth, isProduction } from "@/lib/env";
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

  baseURL: env.BETTER_AUTH_URL,

  // Reject cross-origin auth requests that do not come from the app itself.
  trustedOrigins: [env.BETTER_AUTH_URL],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    /**
     * Without this Better Auth has nowhere to send a reset link, so
     * requestPasswordReset silently did nothing while /forgot-password still
     * told the user to check their inbox.
     */
    sendResetPassword: async ({ user, url }) => {
      await sendTemplateEmail({
        to: user.email,
        template: "PASSWORD_RESET",
        variables: { USER_NAME: user.name, RESET_URL: url },
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, url }) => {
      await sendTemplateEmail({
        to: user.email,
        template: "EMAIL_VERIFICATION",
        variables: { USER_NAME: user.name, VERIFICATION_URL: url },
      });
    },

    expiresIn: 60 * 60,
  },

  account: {
    accountLinking: {
      /**
       * Signing in with Google using an address that already has a password
       * account links the two instead of failing or creating a duplicate.
       * Limited to Google, whose email is provider-verified.
       */
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh at most daily
  },

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
  },

  // Blunt but real: throttles credential stuffing and verification-mail abuse.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },

  // Registered only when configured; an unset client id previously became the
  // string "undefined" and failed at the provider.
  socialProviders: hasGoogleOAuth
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},
});
