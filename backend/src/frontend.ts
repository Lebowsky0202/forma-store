import express, { Router } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Optional same-origin hosting for the compiled SPA. Docker and Vite keep their own web server.
export function frontendRouter(directory: string): Router {
  const root = path.resolve(directory);
  const index = path.join(root, 'index.html');
  if (!existsSync(index)) throw new Error('FRONTEND_DIR must contain a built index.html');
  const router = Router();
  router.use(express.static(root, { dotfiles: 'deny', index: false, maxAge: '1h' }));
  router.get('*', (req, res, next) => {
    // Never turn a missing API/upload/asset or a non-browser request into a successful HTML response.
    if (/^\/(?:api|uploads|assets)(?:\/|$)/i.test(req.path)
      || req.path.split('/').some((part) => part.includes('.'))
      || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  return router;
}
