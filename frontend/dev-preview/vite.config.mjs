import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: `${root}/public`,
  esbuild: { jsx: 'automatic' },
  css: { postcss: { plugins: [tailwind({base:root})] } },
  resolve: { alias: [
    { find: '@', replacement: `${root}/src` },
    { find: 'next/link', replacement: `${root}/dev-preview/link.tsx` },
    { find: 'next/navigation', replacement: `${root}/dev-preview/navigation.ts` },
    { find: 'next/dynamic', replacement: `${root}/dev-preview/dynamic.tsx` },
  ] },
  server: { fs: { allow: [root] } },
});
