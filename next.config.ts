import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory confuses workspace-root detection.
  turbopack: { root: process.cwd() },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Source maps upload only when an auth token is configured.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
