import express from 'express';
import serverless from 'serverless-http';
import { createApi } from '../../src/server/api';

/**
 * Netlify Function that serves every /api/* route (see netlify.toml redirects).
 * It wraps the same Express app used by the long-running Node server.
 */
const root = express();
root.use((req, _res, next) => {
  // Depending on how the request was rewritten, the path may arrive as
  // /.netlify/functions/api/<route> or already as /api/<route>. Normalise to /api/<route>.
  let url = req.url.replace(/^\/\.netlify\/functions\/api/, '');
  if (!url.startsWith('/api')) url = `/api${url.startsWith('/') ? '' : '/'}${url}`;
  req.url = url;
  next();
});
root.use(createApi());

export const handler = serverless(root);
