import nodemailer, { type Transporter } from "nodemailer";

/**
 * Optional direct sending over SMTP. Credentials live in `.env.local` (git-ignored), never in the database
 * and never in the browser. Without them the app falls back to your own mail app / Gmail and a PDF download.
 *
 *   NOLAN_SMTP_HOST=smtp.gmail.com
 *   NOLAN_SMTP_PORT=465
 *   NOLAN_SMTP_USER=you@gmail.com
 *   NOLAN_SMTP_PASS=<a Gmail "app password">
 *   NOLAN_SMTP_FROM="Nolan <you@gmail.com>"   (optional)
 */
export type SmtpStatus = { configured: boolean; host?: string; user?: string; from?: string; missing: string[] };

export function smtpStatus(env: Record<string, string | undefined> = process.env): SmtpStatus {
  const need = ["NOLAN_SMTP_HOST", "NOLAN_SMTP_USER", "NOLAN_SMTP_PASS"];
  const missing = need.filter((k) => !env[k]);
  const user = env.NOLAN_SMTP_USER;
  return { configured: missing.length === 0, host: env.NOLAN_SMTP_HOST, user, from: env.NOLAN_SMTP_FROM || user, missing };
}

function transportFrom(env: Record<string, string | undefined>): Transporter {
  const port = parseInt(env.NOLAN_SMTP_PORT ?? "465", 10) || 465;
  return nodemailer.createTransport({ host: env.NOLAN_SMTP_HOST, port, secure: port === 465, auth: { user: env.NOLAN_SMTP_USER, pass: env.NOLAN_SMTP_PASS } });
}

export type Outgoing = { to: string[]; subject: string; text: string; replyTo?: string; bcc?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] };

/** Sends one email. `transport` is injectable so tests never touch the network. */
export async function sendMail(msg: Outgoing, opts: { env?: Record<string, string | undefined>; transport?: Transporter } = {}): Promise<{ messageId: string }> {
  const env = opts.env ?? process.env;
  const st = smtpStatus(env);
  if (!opts.transport && !st.configured) throw new Error(`Email sending is not set up yet (missing ${st.missing.join(", ")}).`);
  const t = opts.transport ?? transportFrom(env);
  const info = await t.sendMail({ from: st.from, to: msg.to, bcc: msg.bcc, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, attachments: msg.attachments });
  return { messageId: String(info.messageId ?? "") };
}
