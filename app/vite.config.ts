import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');

const MIME: Record<string, string> = {
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
};

/**
 * The repo root holds audio/ and data/; serve them next to the app. (public/audio and public/data are
 * symlinks to them in git, but a Windows checkout without symlink support turns those into plain text
 * files, so they are served from the root directly.) Byte ranges are supported so <audio> can seek.
 */
function rootAssets(dirs: string[]): Plugin {
  return {
    name: 'root-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]!);
        const dir = dirs.find((d) => url.startsWith(`/${d}/`));
        if (!dir) return next();
        const file = path.resolve(ROOT, url.slice(1));
        if (!file.startsWith(path.join(ROOT, dir) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        const size = fs.statSync(file).size;
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
        if (m && (m[1] || m[2])) {
          const start = m[1] ? +m[1] : Math.max(0, size - +m[2]!);
          const end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          res.setHeader('Content-Length', String(end - start + 1));
          fs.createReadStream(file, { start, end }).pipe(res);
        } else {
          res.setHeader('Content-Length', String(size));
          fs.createReadStream(file).pipe(res);
        }
      });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [rootAssets(['audio', 'data'])],
  // PDOOM_NO_HMR=1: no live reload (export renders must not reload mid-run when a file changes)
  server: { port: 5173, strictPort: false, hmr: process.env.PDOOM_NO_HMR ? false : undefined, fs: { allow: [ROOT] } },
  resolve: { alias: { '@root': ROOT } },
  build: { target: 'esnext', assetsInlineLimit: 0 },
});
