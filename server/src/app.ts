import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './infrastructure/auth';
import apiRoutes from './routes/api';
import { helmetMiddleware, apiRateLimiter, authRateLimiter } from './middleware/security';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

app.set('trust proxy', 1);

app.use(helmetMiddleware);
const allowedOrigins = isProd
  ? (process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || [])
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.all('/api/auth/{*path}', authRateLimiter, toNodeHandler(auth));
app.use(requestIdMiddleware);

// CSRF protection: require custom header on state-changing requests.
// Browsers won't send custom headers cross-origin without a CORS preflight,
// so this blocks CSRF attacks even if cookies are present.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/auth/')) return next(); // BetterAuth handles its own CSRF
  if (!req.headers['x-requested-with']) {
    res.status(403).json({ error: 'Missing required security header' });
    return;
  }
  next();
});

app.use('/api', apiRateLimiter, requestLogger, apiRoutes);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

if (isProd) {
  const distPath = path.join(__dirname, '..', '..', 'dist');
  app.use(express.static(distPath));

  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
