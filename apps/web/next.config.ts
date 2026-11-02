import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agentopia/core", "@agentopia/db", "@agentopia/shared"],
  serverExternalPackages: [
    "@anthropic-ai/claude-agent-sdk",
    "@openai/codex-sdk",
    "bullmq",
    "ioredis",
    "pg",
    "pino",
    "@prisma/adapter-pg",
  ],
  // Tailwind CSS v4 via its Turbopack loader (there is no PostCSS config in this app).
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
