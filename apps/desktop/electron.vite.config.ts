import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    // electron is a devDependency, so externalizeDepsPlugin (which externalizes
    // `dependencies`) skips it. Externalize it explicitly so the runtime built-in is
    // used instead of bundling the npm launcher stub (which tries to download a binary).
    // exiftool-vendored, sharp and better-sqlite3 must also stay external: each loads a native
    // binary (vendored ExifTool / prebuilt libvips / the .node addon rebuilt against Electron's
    // ABI) relative to its own module path at runtime, which breaks if its source is inlined.
    plugins: [externalizeDepsPlugin({ include: ['exiftool-vendored', 'sharp', 'better-sqlite3'] })],
    build: {
      rollupOptions: {
        external: ['electron', 'exiftool-vendored', 'sharp', 'better-sqlite3'],
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // Sandboxed preloads must be CommonJS. With "type": "module" a .js file is ESM,
        // so emit .cjs to force CJS and let Electron load it under sandbox.
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
})
