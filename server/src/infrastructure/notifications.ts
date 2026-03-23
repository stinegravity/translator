import { sendEmail } from './email';
import { logger } from './logger';

const APP_NAME = 'KyereAse';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || '';

function fire(
  emailFn: () => Promise<void>,
  tag: string,
  meta?: Record<string, unknown>,
) {
  emailFn().catch((err) => {
    logger.error({ err, tag, ...meta }, `Notification failed: ${tag}`);
  });
}

function wrap(text: string): string {
  return `
    <div style="font-family: 'Montserrat', sans-serif; color: #ffffff; background: #0a0a0a; padding: 32px;">
      <div style="max-width: 520px;">
        ${text}
        <p style="color: #888888; font-size: 12px; margin-top: 32px; border-top: 1px solid #333333; padding-top: 16px;">
          ${APP_NAME} — Twi-English Translation Platform
        </p>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Auth events (called from Better Auth callbacks)
// ---------------------------------------------------------------------------

export function notifyEmailVerification(user: { email: string; name?: string | null }, verifyUrl: string) {
  const name = user.name || 'there';
  fire(
    () => sendEmail({
      to: user.email,
      subject: `${APP_NAME} — Verify Your Email`,
      text: `Hi ${name},\n\nVerify your email address: ${verifyUrl}\n\nIf you didn't create an account, ignore this email.`,
      html: wrap(`
        <h2 style="font-weight: 500; font-size: 18px;">Verify your email</h2>
        <p>Hi ${name},</p>
        <p>Confirm your email to get started with ${APP_NAME}.</p>
        <p><a href="${verifyUrl}" style="background: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 14px;">Verify email</a></p>
        <p style="color: #888888; font-size: 13px;">If you didn't create an account, you can safely ignore this.</p>
      `),
    }),
    'email_verification',
    { email: user.email },
  );
}

export function notifyPasswordReset(user: { email: string; name?: string | null }, resetUrl: string) {
  const name = user.name || 'there';
  fire(
    () => sendEmail({
      to: user.email,
      subject: `${APP_NAME} — Reset Your Password`,
      text: `Hi ${name},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
      html: wrap(`
        <h2 style="font-weight: 500; font-size: 18px;">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>Click below to reset your ${APP_NAME} password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="background: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 14px;">Reset password</a></p>
        <p style="color: #888888; font-size: 13px;">If you didn't request this, you can safely ignore this.</p>
      `),
    }),
    'password_reset',
    { email: user.email },
  );
}

// ---------------------------------------------------------------------------
// Reviewer access events
// ---------------------------------------------------------------------------

export function notifyReviewerApplicationSubmitted(
  applicant: { email: string; name?: string | null },
  applicationId: string,
) {
  const name = applicant.name || 'A user';

  fire(
    () => sendEmail({
      to: applicant.email,
      subject: `${APP_NAME} — Application Received`,
      text: `Hi ${applicant.name || 'there'},\n\nYour reviewer access application has been received. We'll review it and follow up shortly.`,
      html: wrap(`
        <h2 style="font-weight: 500; font-size: 18px;">Application received</h2>
        <p>Hi ${applicant.name || 'there'},</p>
        <p>Your reviewer access application has been received. We'll review it and follow up shortly.</p>
      `),
    }),
    'reviewer_app_submitted_user',
    { email: applicant.email, applicationId },
  );

  if (ADMIN_NOTIFY_EMAIL) {
    fire(
      () => sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `${APP_NAME} — New Reviewer Application`,
        text: `${name} (${applicant.email}) submitted a reviewer access application.\n\nApplication ID: ${applicationId}\n\nReview it in the portal.`,
        html: wrap(`
          <h2 style="font-weight: 500; font-size: 18px;">New reviewer application</h2>
          <p><strong>${name}</strong> (${applicant.email}) submitted a reviewer access application.</p>
          <p style="color: #888888; font-size: 13px;">Application ID: ${applicationId}</p>
        `),
      }),
      'reviewer_app_submitted_admin',
      { applicantEmail: applicant.email, applicationId },
    );
  }
}

export function notifyReviewerDecision(
  applicant: { email: string; name?: string | null },
  decision: 'APPROVED' | 'REJECTED',
  notes?: string | null,
) {
  const name = applicant.name || 'there';
  const approved = decision === 'APPROVED';

  fire(
    () => sendEmail({
      to: applicant.email,
      subject: approved
        ? `${APP_NAME} — Reviewer Access Granted`
        : `${APP_NAME} — Reviewer Access Update`,
      text: approved
        ? `Hi ${name},\n\nYour reviewer access request has been approved. You can now submit translation reviews directly within ${APP_NAME}.\n\nWelcome aboard.`
        : `Hi ${name},\n\nAfter review, your reviewer access request was not approved at this time.${notes ? `\n\nNotes: ${notes}` : ''}\n\nYou may re-apply in the future if your circumstances change.`,
      html: wrap(approved
        ? `
          <h2 style="font-weight: 500; font-size: 18px;">Reviewer access granted</h2>
          <p>Hi ${name},</p>
          <p>Your reviewer access request has been approved. You can now submit translation reviews directly within ${APP_NAME}.</p>
          <p style="color: #22c55e; font-size: 14px;">Welcome aboard.</p>
        `
        : `
          <h2 style="font-weight: 500; font-size: 18px;">Reviewer access update</h2>
          <p>Hi ${name},</p>
          <p>After review, your reviewer access request was not approved at this time.</p>
          ${notes ? `<p style="color: #888888; font-size: 13px;">Notes: ${notes}</p>` : ''}
          <p>You may re-apply in the future if your circumstances change.</p>
        `),
    }),
    'reviewer_decision',
    { email: applicant.email, decision },
  );
}

// ---------------------------------------------------------------------------
// Tier change events (call from wherever tier updates happen)
// ---------------------------------------------------------------------------

export function notifyTierChange(
  user: { email: string; name?: string | null },
  from: string,
  to: string,
) {
  const name = user.name || 'there';
  const upgraded = tierRank(to) > tierRank(from);
  const verb = upgraded ? 'upgraded' : 'changed';

  fire(
    () => sendEmail({
      to: user.email,
      subject: `${APP_NAME} — Plan ${upgraded ? 'Upgraded' : 'Updated'}`,
      text: `Hi ${name},\n\nYour plan has been ${verb} from ${from} to ${to}.\n\nYour new limits are now active.`,
      html: wrap(`
        <h2 style="font-weight: 500; font-size: 18px;">Plan ${verb}</h2>
        <p>Hi ${name},</p>
        <p>Your plan has been ${verb} from <strong>${from}</strong> to <strong>${to}</strong>.</p>
        <p>Your new limits are now active.</p>
      `),
    }),
    'tier_change',
    { email: user.email, from, to },
  );
}

function tierRank(tier: string): number {
  const ranks: Record<string, number> = { FREE: 0, PRO: 1, TEAM: 2, ENTERPRISE: 3 };
  return ranks[tier] ?? -1;
}
