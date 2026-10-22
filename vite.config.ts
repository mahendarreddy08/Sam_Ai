import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, PluginOption } from 'vite';
import { getViteServerHmrConfig, createDisableHmrPlugin } from './src/utils/viteHmrConfig.ts';

export default defineConfig(() => {
  const hmrPlugin = createDisableHmrPlugin();
  const serverHmrConfig = getViteServerHmrConfig();
  const plugins: PluginOption[] = [react(), tailwindcss()];

  if (hmrPlugin) {
    plugins.push(hmrPlugin);
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      ...serverHmrConfig,
      proxy: {
        '/chat': 'http://127.0.0.1:8088',
        '/feedback': 'http://127.0.0.1:8088',
        '/health': 'http://127.0.0.1:8088',
      },
    },
  };
});

