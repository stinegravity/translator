import nodemailer from 'nodemailer';
import { logger } from './logger';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'KyereAse <noreply@kyerease.com>';

const hasSmtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, text, html } = options;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        text,
        html: html ?? text.replace(/\n/g, '<br>'),
      });
      logger.debug({ to, subject }, 'Email sent');
    } catch (err) {
      logger.error({ err, to, subject }, 'Email send failed');
      throw err;
    }
  } else {
    logger.info(
      { to, subject, preview: text.slice(0, 120) },
      '[DEV] Email not sent (no SMTP). Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.'
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n--- Email (dev, not sent) ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${text}`);
      console.log('---\n');
    }
  }
}
