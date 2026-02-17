export const buildScrapingFailEmail = (url: string, errorMessage: string): string => {
	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Scraping Failed</title>
	</head>
	<body style="margin:0; padding:0; background:#f6f7fb; font-family: Arial, Helvetica, sans-serif; color:#1a1a1a;">
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7fb; padding:24px;">
			<tr>
				<td align="center">
					<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background:#ffffff; border-radius:12px; box-shadow:0 6px 18px rgba(24,39,75,0.08); overflow:hidden;">
						<tr>
							<td style="padding:28px 32px; background:#3a0d0d; color:#ffffff;">
								<div style="font-size:18px; font-weight:700; letter-spacing:0.3px;">Nova Bot Studio</div>
								<div style="font-size:13px; opacity:0.8; margin-top:6px;">Scraping Failed</div>
							</td>
						</tr>
						<tr>
							<td style="padding:28px 32px;">
								<h1 style="margin:0 0 12px; font-size:22px;">We could not complete your scraping job</h1>
								<p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#3a3a3a;">
									The scraping attempt for your provided URL failed. You can retry from Nova Bot Studio once the issue is resolved.
								</p>
								<div style="background:#f7e9ea; border-radius:10px; padding:14px 16px; font-size:13px; color:#2f2f2f; margin-bottom:14px;">
									<div style="font-weight:600; margin-bottom:6px;">Scraped URL</div>
									<div style="word-break:break-all;">${url}</div>
								</div>
								<div style="background:#f1f4f9; border-radius:10px; padding:14px 16px; font-size:13px; color:#2f2f2f;">
									<div style="font-weight:600; margin-bottom:6px;">Error Details</div>
									<div style="word-break:break-word;">${errorMessage}</div>
								</div>
								<p style="margin:18px 0 0; font-size:12px; color:#6b7280;">
									If you need help, reply to this email or contact support.
								</p>
							</td>
						</tr>
						<tr>
							<td style="padding:16px 32px 28px; font-size:12px; color:#8a8f98;">
								© ${new Date().getFullYear()} Nova Bot Studio. All rights reserved.
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;
};
