
interface LoginNotificationParams {
  username: string;
  location: string;
  device: string;
  browser: string;
  loginDate: string;
  ipAddress: string;
  loginMethod: string;
}

const htmlTemplateForAwaringUser = ({
  username,
  location,
  device,
  browser,
  loginDate,
  ipAddress,
  loginMethod,
}: LoginNotificationParams): string => {
  return `
    <!doctype html>
    <html lang="en" style="margin:0;padding:0;">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Activity Alert</title>
      <style>
        :root {
          color-scheme: dark;
        }
        body {
          margin: 0;
          padding: 0;
          background: #0f172a;
          color: #e2e8f0;
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        }
        .wrapper {
          width: 100%;
          background: #0b1221;
          padding: 24px 0;
        }
        .container {
          max-width: 640px;
          margin: 0 auto;
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        }
        .header {
          padding: 28px 32px;
          text-align: center;
          border-bottom: 1px solid #1f2937;
          background: linear-gradient(120deg, #0f172a 0%, #111827 50%, #0f172a 100%);
        }
        .alert-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .title {
          margin: 0 0 8px;
          font-size: 24px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: 0.2px;
        }
        .subtitle {
          margin: 0;
          font-size: 14px;
          color: #94a3b8;
        }
        .content {
          padding: 28px 32px;
        }
        .greeting {
          margin: 0 0 20px;
          font-size: 16px;
          color: #cbd5e1;
          line-height: 1.6;
        }
        .details-section {
          margin: 24px 0;
          padding: 16px;
          background: #0b1221;
          border: 1px solid #1f2937;
          border-radius: 10px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 14px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #1f2937;
          font-size: 14px;
          color: #cbd5e1;
        }
        .detail-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #94a3b8;
        }
        .detail-value {
          color: #e2e8f0;
          text-align: right;
          word-break: break-word;
          max-width: 60%;
        }
        .warning-box {
          margin-top: 20px;
          padding: 14px;
          background: rgba(241, 89, 97, 0.1);
          border-left: 4px solid #f15961;
          border-radius: 6px;
        }
        .warning-text {
          font-size: 13px;
          color: #f87171;
          margin: 0;
          line-height: 1.6;
        }
        .action-box {
          margin-top: 20px;
          padding: 14px;
          background: rgba(99, 102, 241, 0.1);
          border-left: 4px solid #6366f1;
          border-radius: 6px;
        }
        .action-text {
          font-size: 13px;
          color: #a5b4fc;
          margin: 0;
          line-height: 1.6;
        }
        .cta {
          display: inline-block;
          margin-top: 16px;
          padding: 12px 24px;
          background: linear-gradient(120deg, #6366f1, #8b5cf6);
          color: #0b1221;
          font-weight: 700;
          text-decoration: none;
          border-radius: 10px;
          letter-spacing: 0.2px;
          box-shadow: 0 10px 30px rgba(99,102,241,0.35);
        }
        .footer {
          padding: 18px 32px 26px;
          color: #64748b;
          font-size: 12px;
          border-top: 1px solid #1f2937;
          background: #0f172a;
          line-height: 1.6;
        }
        .footer-link {
          color: #a5b4fc;
          text-decoration: none;
        }
        @media (max-width: 640px) {
          .container { margin: 0 16px; }
          .title { font-size: 22px; }
          .detail-row { flex-direction: column; align-items: flex-start; }
          .detail-value { text-align: left; max-width: 100%; margin-top: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <div class="alert-icon">🔐</div>
            <h1 class="title">Login Activity Alert</h1>
            <p class="subtitle">Your account was accessed</p>
          </div>

          <div class="content">
            <p class="greeting">
              Hi <strong>${username}</strong>,
            </p>
            <p class="greeting">
              We detected a new login to your Nova Bot Studio account. If this was you, no action is needed. If this wasn't you, please secure your account immediately.
            </p>

            <div class="details-section">
              <div class="section-title">Login Details</div>
              
              <div class="detail-row">
                <span class="detail-label">📍 Location</span>
                <span class="detail-value">${location}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">💻 Device</span>
                <span class="detail-value">${device}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">🌐 Browser</span>
                <span class="detail-value">${browser}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">📅 Date & Time</span>
                <span class="detail-value">${loginDate}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">🔗 IP Address</span>
                <span class="detail-value">${ipAddress}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">🔑 Login Method</span>
                <span class="detail-value">${loginMethod}</span>
              </div>
            </div>

            <div class="warning-box">
              <p class="warning-text">
                <strong>⚠️ Unrecognized this activity?</strong><br>
                If you don't recognize this login, change your password immediately and review your security settings.
              </p>
            </div>

            <div class="action-box">
              <p class="action-text">
                <strong>✓ Need help?</strong><br>
                If you have questions about this activity or need assistance securing your account, contact our support team.
              </p>
            </div>

            <a class="cta" href="https://novabotstudio.com/account-security">Review Account Activity</a>
          </div>

          <div class="footer">
            <div>This is an automated security alert from Nova Bot Studio.</div>
            <div style="margin-top: 8px;">
              Questions? Contact us at <a class="footer-link" href="mailto:support@novabotstudio.com">support@novabotstudio.com</a>
            </div>
            <div style="margin-top: 8px; color: #475569;">
              © 2025 Nova Bot Studio. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export default htmlTemplateForAwaringUser;
