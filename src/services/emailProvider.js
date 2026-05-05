'use strict';

/**
 * EmailProvider — modularni email provider
 *
 * U produkciji: zamijeni _sendReal sa SendGrid / Resend / Nodemailer
 * Non-goals: nije template engine, nije queue
 */

async function send({ to, subject, body }) {
  if (process.env.NODE_ENV === 'production' && process.env.EMAIL_PROVIDER) {
    return _sendReal({ to, subject, body });
  }
  // Dev/test mode — samo loguj
  console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
  console.log(`[EMAIL DEV] Body: ${body}`);
  return { ok: true, mode: 'dev' };
}

async function _sendReal({ to, subject, body }) {
  // Placeholder za produkcijski provider
  // Primjer za Resend:
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from: 'noreply@datapulse.io', to, subject, html: body });
  throw new Error('EMAIL_PROVIDER not configured. Set EMAIL_PROVIDER env var.');
}

module.exports = { send };
