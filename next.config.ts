import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: any = {
  serverExternalPackages: ['pdf-parse'],
};

export default withNextIntl(nextConfig);
