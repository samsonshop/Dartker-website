/**
 * Checks the SMTP settings in .env and optionally sends a test message.
 *
 *   npm run email:test                    # connect + authenticate only
 *   npm run email:test -- you@example.com # also send a test email
 *
 * Prints the provider's real error (bad password, connection refused, ...).
 */
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;

const missing = Object.entries({ SMTP_HOST, EMAIL_FROM })
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);
if (missing.length) {
  console.error(`✗ Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const port = Number(SMTP_PORT) || 587;
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: SMTP_SECURE === 'true' || port === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
});

const to = process.argv[2];

async function main() {
  console.log(`Connecting to ${SMTP_HOST}:${port} as ${SMTP_USER || '(no auth)'} ...`);
  await transport.verify();
  console.log('✓ SMTP connection and login OK');

  if (to) {
    const info = await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject: 'Dartler SMTP test',
      text: 'If you can read this, password reset emails will be delivered.',
    });
    console.log(`✓ Test email accepted by the server (${info.messageId}) — check ${to}`);
  }
}

main().catch((error: Error) => {
  console.error('✗ SMTP error:', error.message);
  process.exit(1);
});
