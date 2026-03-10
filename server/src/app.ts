import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './infrastructure/auth';
import apiRoutes from './routes/api';
import { helmetMiddleware, apiRateLimiter } from './middleware/security';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmetMiddleware);
app.use(
  cors({
    origin: isProd
      ? (process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || false)
      : true,
    credentials: true,
  })
);

app.all('/api/auth/{*path}', toNodeHandler(auth));

app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);

app.use('/api', apiRateLimiter, requestLogger, apiRoutes);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

if (isProd) {
  const distPath = path.join(__dirname, '..', '..', 'dist');
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
