import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { env, isEmailConfigured } from '@/lib/env';

/**
 * Transactional email over plain SMTP.
 *
 * SMTP rather than a vendor SDK keeps the provider swappable from `.env` alone —
 * Gmail/Google Workspace, Zoho, Amazon SES, Resend, Brevo and SendGrid all
 * expose an SMTP endpoint.
 */

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (transporter) return transporter;
  const config = env();
  const port = Number(config.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port,
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: config.SMTP_SECURE === 'true' || port === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(input: MailInput): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured — set SMTP_HOST and EMAIL_FROM');
  }
  await transport().sendMail({ from: env().EMAIL_FROM, ...input });
}
