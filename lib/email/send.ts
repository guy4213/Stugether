import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Outgoing email over SMTP (Change Request 13.10.2026). Server-only: the
// credentials are SMTP_* env vars without NEXT_PUBLIC_. When SMTP is not
// configured (local dev, preview deploys), sending is a logged no-op.

let transporter: Transporter | null = null;

// MAIL_FROM, or the SMTP login itself (most providers only send as it).
function fromAddress(): string | undefined {
  const user = process.env.SMTP_USER;
  return process.env.MAIL_FROM || (user?.includes("@") ? `StuGether <${user}>` : undefined);
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && fromAddress());
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 = implicit TLS; 587 / 25 upgrade with STARTTLS.
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
    // Fail well inside the serverless time limit (nodemailer waits minutes).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
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
    // SMTP_HOST without a sender is a broken setup, not "email off": say so.
    const log = process.env.SMTP_HOST ? console.warn : console.info;
    log(`[email] SMTP not configured (SMTP_HOST / MAIL_FROM); skipped "${email.subject}"`);
    return false;
  }
  await getTransporter().sendMail({ from: fromAddress(), ...email });
  return true;
}
