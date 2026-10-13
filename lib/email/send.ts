import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Outgoing email over SMTP (Change Request 13.10.2026). Server-only: the
// credentials are SMTP_* env vars without NEXT_PUBLIC_. When SMTP is not
// configured (local dev, preview deploys), sending is a logged no-op.

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 = implicit TLS; 587 / 25 upgrade with STARTTLS.
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });
  return transporter;
}

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(email: Email): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.info(`[email] SMTP not configured; skipped "${email.subject}"`);
    return false;
  }
  await getTransporter().sendMail({ from: process.env.MAIL_FROM, ...email });
  return true;
}
