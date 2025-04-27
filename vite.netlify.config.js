// Using CommonJS style to be more compatible with Netlify
const path = require('path');
const { defineConfig } = require('vite');

// This is a minimal Vite configuration specifically for Netlify deployment
// We avoid using plugins to prevent dependency issues
module.exports = defineConfig({
  // No plugins to avoid dependency issues
  plugins: [],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  // Add specific settings for JSX handling without plugins
  esbuild: {
    jsxInject: `import React from 'react'`,
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
});