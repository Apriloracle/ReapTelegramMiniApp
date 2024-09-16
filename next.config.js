/** @type {import('next').NextConfig} */
const path = require('path');

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
      include: path.resolve(__dirname, 'node_modules/@electric-sql/pglite'),
      type: "javascript/auto",
    });

    if (!options.isServer) {
      config.resolve.fallback = { fs: false, module: false, path: false };
    }

    return config;
  },
  transpilePackages: ['@electric-sql/pglite'],
};

module.exports = nextConfig;
