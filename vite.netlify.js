// Vite configuration for Netlify
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup environment
process.env.VITE_NETLIFY_DEPLOY = 'true';

// Full configuration for Netlify
export default defineConfig({
  plugins: [
    react({
      // Use the new JSX transform
      jsxRuntime: 'automatic',
      // Don't inject React import
      jsxImportSource: 'react',
      // Skip fastRefresh for build
      fastRefresh: false,
    }),
  ],
  
  // Use esbuild with specific settings for React
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    // Turn off JSX factory and fragment since we're using automatic runtime
    jsxFactory: undefined,
    jsxFragment: undefined,
  },
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
      "@components": path.resolve(__dirname, "client", "src", "components"),
      "@hooks": path.resolve(__dirname, "client", "src", "hooks"),
      "@lib": path.resolve(__dirname, "client", "src", "lib"),
      "@pages": path.resolve(__dirname, "client", "src", "pages"),
    },
  },
  
  // Configure base path
  base: '/',
  
  // Configure build
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Ensure proper handling of assets
    assetsDir: 'assets',
    // Add source maps for debugging
    sourcemap: true,
    // Optimize for compatibility
    target: 'es2015',
    // Configure rollup options
    rollupOptions: {
      output: {
        // Simpler chunking to avoid conflicts
        manualChunks: {
          vendor: [
            'react', 
            'react-dom',
            'wouter',
            '@tanstack/react-query'
          ],
        },
      },
      // Prevent bundling in production
      external: [],
    },
  },
  
  // Define environment variables
  define: {
    'process.env.VITE_NETLIFY_DEPLOY': JSON.stringify('true'),
    // Ensure global React is available
    'global': 'globalThis',
  },
  
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'wouter'],
    force: true,
  },
});