import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error - plain ESM helper shared with the production server
import { handleApi } from './server/http.mjs';

/**
 * Serves the same /api handler the production server uses, so the Groq key
 * never reaches the browser — in development either.
 */
interface AiConfig {
  openrouterKey?: string;
  groqKey?: string;
  model?: string;
}

function apiPlugin(config: AiConfig): PluginOption {
  return {
    name: 'material-studio-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        handleApi(req, res, () => config).then((owned: boolean) => {
          if (!owned) next();
        }, next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Empty prefix: load every var in .env, not just VITE_*.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      apiPlugin({
        openrouterKey: env.OPENROUTER_API_KEY,
        groqKey: env.GROQ_API_KEY,
        model: env.AI_MODEL,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1200,
    },
  };
});
