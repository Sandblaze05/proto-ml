/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Proxy clones request bodies; raise limit for large folder uploads.
    proxyClientMaxBodySize: '200mb',
  },
};

export default nextConfig;
