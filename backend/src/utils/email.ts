import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Zoop password reset code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px">
        <h1 style="font-size:28px;font-weight:800;color:#6366f1;margin:0 0 8px">zoop</h1>
        <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 16px">Reset your password</h2>
        <p style="color:#475569;margin:0 0 24px">Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#0f172a">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin:0">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
