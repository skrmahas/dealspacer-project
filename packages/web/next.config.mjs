/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@bei/shared"],
  experimental: {
    // Native pg bindings break when webpack bundles them; keep Node resolving pg at runtime.
    serverComponentsExternalPackages: ["pg"],
  },
};


export default nextConfig;
