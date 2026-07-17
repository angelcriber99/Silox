import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  allowedDevOrigins: ['127.0.0.1'],
  // Keep Turbopack scoped to this checkout. Developer machines may contain
  // unrelated lockfiles above the repository, which must not change module
  // resolution or the build root.
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
