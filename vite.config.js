import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Относительный base — сайт одинаково работает и на
  // excess-lab.github.io/My-Portfolio/, и на кастомном домене.
  base: './',
  plugins: [tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
