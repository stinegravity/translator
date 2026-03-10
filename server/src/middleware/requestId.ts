import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const HEADER = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = (req.header(HEADER) as string) || randomUUID();
  req.id = id;
  res.setHeader(HEADER, id);
  next();
}
