// OTP / transactional email delivery.
//
// Production: SendGrid (SENDGRID_API_KEY). The 6-digit code is emailed to
// the user and NEVER returned in the API response.
// Sandbox/preview: set DEMO_MODE=true to have the code returned in the
// response (`delivery: "demo"`) so flows can be tested without a mail
// provider — exactly like the CRM mock contract.

import sgMail from '@sendgrid/mail';

let sendgridConfigured = false;
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sendgridConfigured = true;
}

export const isDemoMode = () =>
  process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';

export const mailConfigured = () => sendgridConfigured;

const FROM = () => process.env.EMAIL_FROM_ADDRESS || 'noreply@happypix.in';

function otpTemplate({ code, purpose }) {
  const subject = purpose === 'email-change'
    ? 'Your HappyPix email change code'
    : 'Your HappyPix password reset code';
  const body = `Your HappyPix verification code is: ${code}
It expires in 10 minutes. If you did not request this, you can ignore this email.`;
  const html = `
  <div style="font-family:sans-serif;text-align:center;padding:30px;background:#f3f4f6;">
    <div style="background:#fff;padding:40px;border-radius:12px;max-width:460px;margin:0 auto;">
      <h2 style="color:#111;margin:0 0 12px;">Your HappyPix code</h2>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#7c3aed;margin:18px 0;">${code}</div>
      <p style="color:#444;font-size:15px;">This code expires in <b>10 minutes</b>.</p>
      <p style="color:#888;font-size:12px;margin-top:26px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  </div>`;
  return { subject, text: body, html };
}

/**
 * Sends a 6-digit OTP. Returns 'email' when actually emailed, 'demo' when
 * the code is being surfaced in the API response instead.
 *
 * Production safety: demo delivery (code in the API response) is ONLY
 * allowed outside production or behind an explicit DEMO_MODE=true flag.
 * In production without SendGrid the send fails loudly — leaking a reset
 * code in the response would let anyone take over any account.
 */
export async function sendOtpEmail(toEmail, code, purpose = 'password-reset') {
  if (isDemoMode()) {
    if (!sendgridConfigured) return 'demo';
    // Demo mode requested but real mail is available — still send for
    // observability, and surface the code too.
    try {
      const msg = { to: toEmail, from: FROM(), ...otpTemplate({ code, purpose }) };
      await sgMail.send(msg);
    } catch (err) {
      console.error('❌ OTP email failed:', err.response?.body || err.message);
    }
    return 'demo';
  }

  if (!sendgridConfigured) {
    throw new Error('Email delivery is not configured (SENDGRID_API_KEY missing) — refusing to issue an OTP in production.');
  }

  try {
    const msg = { to: toEmail, from: FROM(), ...otpTemplate({ code, purpose }) };
    await sgMail.send(msg);
    return 'email';
  } catch (err) {
    console.error('❌ OTP email failed:', err.response?.body || err.message);
    throw new Error('The verification email could not be sent. Please try again.');
  }
}
