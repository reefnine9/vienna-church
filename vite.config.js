import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        bulletin: fileURLToPath(new URL('./index.html', import.meta.url)),
        compatibility: fileURLToPath(new URL('./compat/index.html', import.meta.url)),
      },
    },
  },
});
