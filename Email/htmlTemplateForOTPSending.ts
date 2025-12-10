export function getRegistrationEmailHtml(code: string ): string {
  return `
  <!doctype html>
  <html lang="en" style="margin:0;padding:0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registration Code</title>
    <style>
      body { margin: 0; padding: 0; background: #0f172a; color: #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif; }
      .wrapper { width: 100%; background: #0b1221; padding: 24px 0; }
      .container { max-width: 640px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,0.35); }
      .header { padding: 28px 32px 12px; text-align: left; border-bottom: 1px solid #1f2937; background: linear-gradient(120deg, #0f172a 0%, #111827 50%, #0f172a 100%); }
      .logo { height: 42px; width: auto; display: block; }
      .title { margin: 18px 0 4px; font-size: 22px; font-weight: 700; color: #f8fafc; letter-spacing: 0.2px; }
      .subtitle { margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.5; }
      .content { padding: 28px 32px 32px; }
      .code-block { margin: 22px 0; padding: 16px; background: #0b1221; border: 1px solid #1f2937; border-radius: 10px; text-align: center; }
      .code-label { font-size: 12px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
      .code-value { font-size: 28px; font-weight: 700; color: #a5b4fc; letter-spacing: 6px; }
      .cta { display: inline-block; margin-top: 10px; padding: 12px 22px; background: linear-gradient(120deg, #6366f1, #8b5cf6); color: #0b1221; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.2px; box-shadow: 0 10px 30px rgba(99,102,241,0.35); }
      .note { margin: 18px 0 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
      .footer { padding: 18px 32px 26px; color: #64748b; font-size: 12px; border-top: 1px solid #1f2937; background: #0f172a; }
      a { color: #a5b4fc; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <img class="logo" src="https://via.placeholder.com/160x42?text=Your+Logo" alt="Your Logo">
          <h1 class="title">Your verification code is here</h1>
          <p class="subtitle">Use the code below to finish signing up. It expires in 10 minutes.</p>
        </div>
        <div class="content">
          <div class="code-block">
            <div class="code-label">Your code</div>
            <div class="code-value">${code}</div>
          </div>
          <p class="note">If you did not request this code, you can safely ignore this email. For your security, do not share this code with anyone.</p>
        </div>
        <div class="footer">
          <div>Sent by Nova Bot Studio</div>
          <div>If you have questions, contact us at <a href="mailto:novaBotStudio@gmail.com">novaBotStudio@gmail.com</a>.</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}
