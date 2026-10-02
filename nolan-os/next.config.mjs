/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdfkit", "exceljs"],
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};
export default nextConfig;
