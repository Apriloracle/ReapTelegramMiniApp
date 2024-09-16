/** @type {import('next').NextConfig} */
const { fileURLToPath } = require('url');

let nextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: true
  },
  images: {},
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.+(js|jsx|mjs|ts|tsx)$/,
      use: options.defaultLoaders.babel,
      include: fileURLToPath(new URL('@electric-sql/pglite', import.meta.url)),
      type: "javascript/auto",
    });

    if (!options.isServer) {
      config.resolve.fallback = { fs: false, module: false, path: false };
    }

    return config;
  },
  transpilePackages: [],
};

module.exports = nextConfig;
