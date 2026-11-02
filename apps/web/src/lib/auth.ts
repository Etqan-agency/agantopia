import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@agentopia/db";

/**
 * better-auth server instance. Email + password only for the MVP.
 * Password-reset links are logged to the server console in development (no mail
 * transport is configured); production must wire a mailer here.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.APP_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[auth] password reset for ${user.email}: ${url}`);
      } else {
        console.warn(`[auth] password reset requested for user ${user.id}, but no mail transport is configured`);
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
