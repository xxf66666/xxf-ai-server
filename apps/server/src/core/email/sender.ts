import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

function buildTransport(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const transport = buildTransport();

export const MAIL_ENABLED = Boolean(transport);

export interface SendResult {
  ok: boolean;
  error?: string;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!transport) {
    return { ok: false, error: 'email service not configured (SMTP_* missing)' };
  }
  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, to: opts.to }, 'smtp send threw');
    return { ok: false, error: msg };
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<SendResult> {
  const subject = '验证你的 Nexa 邮箱 / Verify your email';
  const text = [
    `你好，`,
    ``,
    `有人（希望是你本人）在 Nexa 注册了这个邮箱。`,
    `点下面链接完成验证（48 小时内有效）：`,
    verifyUrl,
    ``,
    `不是你？忽略这封邮件即可。`,
    ``,
    `---`,
    `Hello,`,
    ``,
    `Someone (hopefully you) registered this email on Nexa.`,
    `Click the link below to verify (valid for 48 hours):`,
    verifyUrl,
    ``,
    `Not you? Just ignore this message.`,
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
      <div style="border-radius:12px;border:1px solid #e5e7eb;padding:32px;background:#fff">
        <div style="font-weight:600;font-size:18px;margin-bottom:8px">验证你的邮箱</div>
        <p style="font-size:14px;line-height:1.6;color:#4b5563">
          有人（希望是你本人）在 <b>Nexa</b> 注册了这个邮箱。
          点下方按钮完成验证 —— 链接 <b>48 小时内有效</b>，且只能使用一次。
        </p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
            验证邮箱 / Verify email
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">
          按钮无法点击？把下面链接粘贴到浏览器地址栏：<br/>
          <span style="word-break:break-all">${verifyUrl}</span>
        </p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
        <p style="font-size:12px;color:#9ca3af;line-height:1.5">
          不是你本人操作？请忽略这封邮件。<br/>
          — Nexa
        </p>
      </div>
    </div>
  `;
  return send({ to, subject, html, text });
}
