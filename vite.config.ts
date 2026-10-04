import { defineConfig } from 'vite';

// The service worker is written in TypeScript (src/sw.ts) and emitted as /sw.js
// at the site root so it can control the whole app.
export default defineConfig({
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      input: { main: 'index.html', sw: 'src/sw.ts' },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
