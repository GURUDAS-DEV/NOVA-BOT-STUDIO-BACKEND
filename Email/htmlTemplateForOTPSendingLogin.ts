interface LoginOTPParams {
  username: string;
  otp: string;
  browser: string;
  ipAddress: string;
  location: string;
}

export const getLoginOTPEmailHtml = ({
  username,
  otp,
  browser,
  ipAddress,
  location,
}: LoginOTPParams): string => {
  return `
    <!doctype html>
    <html lang="en" style="margin:0;padding:0;">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login OTP Request</title>
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
          padding: 28px 32px 12px;
          text-align: center;
          border-bottom: 1px solid #1f2937;
          background: linear-gradient(120deg, #0f172a 0%, #111827 50%, #0f172a 100%);
        }
        .logo-icon {
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
          line-height: 1.5;
        }
        .content {
          padding: 28px 32px 32px;
        }
        .greeting {
          margin: 0 0 20px;
          font-size: 16px;
          color: #cbd5e1;
          line-height: 1.6;
        }
        .alert-box {
          margin: 20px 0;
          padding: 16px;
          background: rgba(99, 102, 241, 0.1);
          border-left: 4px solid #6366f1;
          border-radius: 6px;
        }
        .alert-title {
          font-size: 14px;
          font-weight: 700;
          color: #a5b4fc;
          margin: 0 0 10px;
        }
        .request-details {
          font-size: 13px;
          color: #cbd5e1;
          line-height: 1.8;
          margin: 0;
        }
        .detail-item {
          display: flex;
          margin-bottom: 6px;
        }
        .detail-label {
          font-weight: 600;
          color: #94a3b8;
          min-width: 100px;
        }
        .detail-value {
          color: #e2e8f0;
        }
        .code-block {
          margin: 24px 0;
          padding: 20px;
          background: #0b1221;
          border: 2px solid #6366f1;
          border-radius: 12px;
          text-align: center;
        }
        .code-label {
          font-size: 12px;
          color: #94a3b8;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .code-value {
          font-size: 32px;
          font-weight: 700;
          color: #a5b4fc;
          letter-spacing: 8px;
          text-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
        }
        .expiry-note {
          margin-top: 8px;
          font-size: 12px;
          color: #64748b;
        }
        .warning-box {
          margin: 20px 0;
          padding: 14px;
          background: rgba(241, 89, 97, 0.1);
          border-left: 4px solid #f15961;
          border-radius: 6px;
        }
        .warning-title {
          font-size: 14px;
          font-weight: 700;
          color: #fca5a5;
          margin: 0 0 8px;
        }
        .warning-text {
          font-size: 13px;
          color: #fecaca;
          margin: 0;
          line-height: 1.6;
        }
        .security-box {
          margin: 20px 0;
          padding: 14px;
          background: rgba(34, 197, 94, 0.1);
          border-left: 4px solid #22c55e;
          border-radius: 6px;
        }
        .security-title {
          font-size: 14px;
          font-weight: 700;
          color: #86efac;
          margin: 0 0 8px;
        }
        .security-text {
          font-size: 13px;
          color: #bbf7d0;
          margin: 0;
          line-height: 1.6;
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
          .code-value { font-size: 28px; letter-spacing: 6px; }
          .detail-item { flex-direction: column; }
          .detail-label { min-width: auto; margin-bottom: 2px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <div class="logo-icon">🔐</div>
            <h1 class="title">New OTP Request</h1>
            <p class="subtitle">Someone has requested a login OTP for your account</p>
          </div>

          <div class="content">
            <p class="greeting">
              Hi <strong>${username}</strong>,
            </p>
            <p class="greeting">
              A one-time password (OTP) has been requested for your Nova Bot Studio account. Use the code below to complete your login.
            </p>

            <div class="alert-box">
              <div class="alert-title">📋 Request Details</div>
              <div class="request-details">
                <div class="detail-item">
                  <span class="detail-label">🌐 Browser:</span>
                  <span class="detail-value">${browser}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">🔗 IP Address:</span>
                  <span class="detail-value">${ipAddress}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">📍 Location:</span>
                  <span class="detail-value">${location}</span>
                </div>
              </div>
            </div>

            <div class="code-block">
              <div class="code-label">Your Login OTP</div>
              <div class="code-value">${otp}</div>
              <div class="expiry-note">⏱️ Expires in 10 minutes</div>
            </div>

            <div class="warning-box">
              <div class="warning-title">⚠️ If This Wasn't You</div>
              <p class="warning-text">
                If you didn't request this OTP, <strong>please ignore this email</strong>. Your account remains secure. Do not share this code with anyone.
              </p>
            </div>

            <div class="security-box">
              <div class="security-title">🛡️ Security Reminder</div>
              <p class="security-text">
                <strong>Never share your OTP</strong> with anyone, including Nova Bot Studio staff. We will never ask for your OTP via email, phone, or any other method. Treat this code like your password.
              </p>
            </div>
          </div>

          <div class="footer">
            <div>This is an automated security message from Nova Bot Studio.</div>
            <div style="margin-top: 8px;">
              Need help? Contact us at <a class="footer-link" href="mailto:support@novabotstudio.com">support@novabotstudio.com</a>
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
