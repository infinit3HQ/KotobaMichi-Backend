export function render(vars: { name: string; link: string; }) {
  const name = vars.name || '';
  const link = vars.link;
  const text = `${name ? `${name},\n\n` : ''}You requested a password reset. Use this link to set a new password: ${link}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;color:#111">
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#ef4444;color:#fff;border-radius:6px;text-decoration:none">Reset Password</a></p>
    <p>If the button doesn't work, copy and paste this URL into your browser:<br/><code>${link}</code></p>
    <p>If you didn't request a password reset, you can safely ignore this email.</p>
    <p>Thanks,<br/>The Kotobamichi Team</p>
  </body>
</html>`;
  return { text, html } as const;
}
