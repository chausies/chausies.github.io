import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [
    svelte(), 
    viteSingleFile() // Forces Vite to inline all JS and CSS into the final HTML file
  ],
  build: {
    outDir: 'dist', // Explicitly output to dist to stop the Vite directory warning
    emptyOutDir: true // Clears the dist folder before building to keep things clean
  }
});
