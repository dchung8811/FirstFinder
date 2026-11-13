import "server-only";
import nodemailer from "nodemailer";
import { classifySendError, maskEmail, readEmailConfig } from "../utils/email";

// FirstFinder's own email, sent through a Gmail account over SMTP with an app
// password (Google Account -> Security -> 2-Step Verification -> App
// passwords). The same account sends Supabase Auth's emails through the
// dashboard's custom SMTP setting, and the two share Gmail's daily allowance
// of about 500 messages.
//
// "server-only" makes importing this from a client component a build error:
// it reads the app password, and nodemailer cannot run in a browser anyway.
// The parts worth testing live in src/utils/email.js, which doesn't import it.

const GMAIL_SMTP = { host: "smtp.gmail.com", port: 465, secure: true };

// One mailer per request or job. The transport is created on the first send,
// so a request that ends up sending nothing never opens a connection. Pooled
// because a job may send several in a row; three connections keeps a burst
// well under what Gmail tolerates from one account.
//
// After a "blocked" error every later send returns "blocked" without trying:
// Gmail is refusing the account, and pressing on would only fail the rest the
// same way while looking, to Google, like more abuse.
export function openMailer(env = process.env) {
  const config = readEmailConfig(env);
  let transport = null;
  let blocked = false;

  function getTransport() {
    if (!transport) {
      transport = nodemailer.createTransport({
        ...GMAIL_SMTP,
        pool: true,
        maxConnections: 3,
        auth: { user: config.user, pass: config.password }
      });
    }
    return transport;
  }

  // Resolves to { ok: true } only when Gmail accepted the message. Never
  // reports ok for an email that wasn't sent: the sender this was copied from
  // once did, and marked reminders as sent when nothing had gone out. Callers
  // record "sent" on ok, so ok has to mean "this left".
  async function send({ to, subject, html, text }) {
    if (!config.configured) {
      console.warn(`[email not sent: GMAIL_USER or GMAIL_APP_PASSWORD is unset] to=${maskEmail(to)} subject=${subject}`);
      return { ok: false, reason: "not_configured" };
    }
    if (blocked) {
      return { ok: false, reason: "blocked" };
    }

    try {
      const info = await getTransport().sendMail({ from: config.from, to, subject, html, text });
      // nodemailer resolves even when Gmail refused the recipient at RCPT
      // time, listing them under rejected. With one recipient that is a
      // failed send, not a delivered one.
      if (!info?.accepted?.length || info?.rejected?.length) {
        console.error(`[email failed: recipient rejected] to=${maskEmail(to)} subject=${subject}`);
        return { ok: false, reason: "failed" };
      }
      return { ok: true };
    } catch (error) {
      const reason = classifySendError(error);
      if (reason === "blocked") blocked = true;
      console.error(
        `[email ${reason}] to=${maskEmail(to)} subject=${subject} code=${error?.code ?? ""} responseCode=${error?.responseCode ?? ""} ${error?.response ?? error?.message ?? ""}`
      );
      return { ok: false, reason };
    }
  }

  function close() {
    transport?.close();
    transport = null;
  }

  return {
    send,
    close,
    get blocked() {
      return blocked;
    }
  };
}

// Opens a mailer for the length of fn and always closes it, so a pooled
// connection is never left holding a serverless function open.
export async function withMailer(fn, env = process.env) {
  const mailer = openMailer(env);
  try {
    return await fn(mailer);
  } finally {
    mailer.close();
  }
}
