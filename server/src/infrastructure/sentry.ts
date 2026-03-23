import * as Sentry from '@sentry/node';
import { logger } from './logger';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      // Strip PII from error events
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });
  logger.info('Sentry error monitoring initialized');
} else {
  logger.info('Sentry DSN not configured — error monitoring disabled');
}

export { Sentry };
