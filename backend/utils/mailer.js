// Sends email over HTTPS (port 443) using Brevo's API.
// Free hosts such as Render block normal email ports, so SMTP cannot be used there.

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

async function sendEmail({ to, toName, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error('Email is not set up (BREVO_API_KEY or MAIL_FROM_EMAIL is missing)');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'EcoThread', email: fromEmail },
      to: [{ email: to, name: toName || to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo error ${response.status}: ${detail.slice(0, 200)}`);
  }
}

function codeEmail(name, code, intro, ignoreNote) {
  const safeName = escapeHtml(name || 'there');

  return {
    text:
      `Hi ${name || 'there'},\n\n${intro}\n\n${code}\n\n` +
      `It expires in 10 minutes. ${ignoreNote}`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px">` +
      `<h2 style="color:#166534">EcoThread</h2>` +
      `<p>Hi ${safeName},</p>` +
      `<p>${escapeHtml(intro)}</p>` +
      `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#166534">${code}</p>` +
      `<p style="color:#666">It expires in 10 minutes. ${escapeHtml(ignoreNote)}</p>` +
      `</div>`,
  };
}

async function sendVerificationEmail(to, name, code) {
  const body = codeEmail(
    name,
    code,
    'Your EcoThread verification code is:',
    'If you did not sign up, you can ignore this email.'
  );

  await sendEmail({ to, toName: name, subject: 'Your EcoThread verification code', ...body });
}

async function sendPasswordResetEmail(to, name, code) {
  const body = codeEmail(
    name,
    code,
    'Use this code to reset your EcoThread password:',
    'If you did not ask to reset your password, you can ignore this email.'
  );

  await sendEmail({ to, toName: name, subject: 'Reset your EcoThread password', ...body });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };