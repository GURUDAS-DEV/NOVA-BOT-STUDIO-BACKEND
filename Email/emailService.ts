import nodemailer from "nodemailer";

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Creates and returns a Nodemailer transporter configured via environment variables.
 * Supports Gmail (default), custom SMTP, Brevo, etc.
 */
export const createEmailTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host) {
        return nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass,
            },
        });
    }

    // Default to Gmail service if host is not explicitly set
    return nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        auth: {
            user,
            pass,
        },
    });
};

/**
 * Sends an email using the configured SMTP transporter.
 */
export const sendEmail = async ({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
        if (!to) {
            console.warn("[Email Service] No recipient email provided. Skipping email send.");
            return { success: false, error: "Recipient email is required" };
        }

        const user = process.env.SMTP_USER;
        const from = process.env.EMAIL_FROM || (user ? `"NOVA Bot Studio" <${user}>` : '"NOVA Bot Studio" <noreply@novabotstudio.com>');
        
        const transporter = createEmailTransporter();
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text,
        });

        console.log(`[Email Service] Email sent successfully to ${to} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error(`[Email Service] Failed to send email to ${to}:`, error?.message || error);
        return { success: false, error: error?.message || "Unknown email error" };
    }
};
