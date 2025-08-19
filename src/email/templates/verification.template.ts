export function render(vars: { name: string; link: string; }) {
  const name = vars.name || '';
  const link = vars.link;
  const text = `${name ? `${name},\n\n` : ''}Welcome to Kotobamichi! Please verify your email by visiting this link: ${link}\n\nIf you didn't sign up for Kotobamichi, you can ignore this email.`;
  const html = `<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;color:#111">
    <p>Hi ${name || 'there'},</p>
    <p>Welcome to Kotobamichi! To complete your registration and get full access, please confirm your email address by clicking the button below:</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Confirm Email</a></p>
    <p>If the button doesn't work, copy and paste this URL into your browser:<br/><code>${link}</code></p>
    <p>If you did not sign up for an account on Kotobamichi, you can safely ignore this email.</p>
    <p>Thanks,<br/>The Kotobamichi Team</p>
  </body>
</html>`;
  return { text, html } as const;
}
