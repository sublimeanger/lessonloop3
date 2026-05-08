import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Live app was vulnerable to stale service-worker caches serving deleted
      // hashed chunks after deploys, which can produce a blank white screen.
      // selfDestroying ships a cleanup worker that unregisters itself and clears
      // old caches on clients once the new frontend is published.
      selfDestroying: true,
      manifest: false,
    }),
    // Sentry source-map upload (build-time only). Activates when
    // SENTRY_AUTH_TOKEN is set in the build env (Netlify) — local
    // dev builds without the token are unaffected. Org/project read
    // from SENTRY_ORG / SENTRY_PROJECT env, with safe defaults.
    mode !== "development" &&
      process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG ?? "lessonloop",
        project: process.env.SENTRY_PROJECT ?? "javascript-react",
        sourcemaps: {
          // Delete .map files from dist after upload so they never
          // reach the CDN. Sentry has them; end users don't need them
          // and shouldn't see original source.
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
        // Don't fail the build if upload errors — frontend still ships,
        // we just lose stack-trace mapping for that release.
        errorHandler: (err) => {
          // eslint-disable-next-line no-console
          console.warn("[sentry-vite-plugin] source map upload error:", err.message);
        },
      }),
  ].filter(Boolean),
  build: {
    // Generate source maps so Sentry can map minified stack frames back
    // to original source. The sentryVitePlugin uploads them to Sentry
    // and (by default) deletes the .map files post-upload so they
    // never reach the CDN.
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['jspdf'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-utils': ['date-fns', 'zod'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
