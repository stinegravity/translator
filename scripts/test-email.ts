import 'dotenv/config';
import { sendEmail } from '../server/src/infrastructure/email';

const TO = 'biney.augustine01@gmail.com';

sendEmail({
  to: TO,
  subject: 'KyereAse — Email Test',
  text: 'If you received this, SendGrid SMTP is configured correctly.',
  html: '<p>If you received this, SendGrid SMTP is configured correctly.</p>',
})
  .then(() => {
    console.log('Test email sent to', TO);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
