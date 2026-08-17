import { defineConfig } from 'vite'

// Project page is served from /multiscale-analysis/. Apply that base to builds
// and to `vite preview` (so preview mirrors production), but not to `vite dev`,
// which stays at the root for convenience.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/multiscale-analysis/' : '/',
  build: {
    // audioProcessor.js is small enough to fall under the inline limit, which
    // turns its ?url import into a data: URL. Keep it a real file so
    // audioWorklet.addModule() gets the same kind of URL it gets in dev.
    assetsInlineLimit: (filePath: string) =>
      filePath.endsWith('audioProcessor.js') ? false : undefined,
  },
}))
