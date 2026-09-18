import nodemailer from 'nodemailer';
import os from 'node:os';
import { renderMarkdown } from './markdown';
import { formatWeek } from './week';

// QQ 邮箱 SMTP。默认值就是 QQ 邮箱，国内用户开箱即用。
// 注意：SMTP_PASS 是「授权码」，不是 QQ 登录密码。
const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.qq.com';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_SECURE = (process.env.SMTP_SECURE ?? 'true') !== 'false';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// QQ 邮箱要求发件地址与登录账号一致，所以 FROM 默认直接用 SMTP_USER。
const FROM = process.env.NEWSLETTER_FROM ?? SMTP_USER ?? 'LearnFromGithub <newsletter@example.com>';

const SITE_PORT = Number(process.env.PORT ?? 3000);

/**
 * 自动探测本机局域网 IPv4，让周报底部链接在「换 WiFi 后」也能直接可用，不用手动改。
 * 优先选物理网卡（en/eth），跳过回环(lo)、VPN(utun)、虚拟网卡(bridge/vboxnet 等)；
 * 探测不到就退回 localhost。设置了 SITE_URL 环境变量时，此函数不会被使用。
 */
function detectSiteUrl(): string {
  const nets = os.networkInterfaces();
  const physical: string[] = [];
  const others: string[] = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (/^(en|eth)\d*$/i.test(name)) physical.push(net.address);
      else if (!/^(utun|llw|awdl|bridge|vboxnet|vmnet|docker|lo)/i.test(name)) {
        others.push(net.address);
      }
    }
  }
  const address = physical[0] ?? others[0] ?? 'localhost';
  return `http://${address}:${SITE_PORT}`;
}

const SITE_URL = process.env.SITE_URL ?? detectSiteUrl();

export type SendResult = { sent: number; dryRun: boolean };

export function buildEmailHtml(issue: {
  title: string;
  subtitle: string;
  markdown: string;
  weekOf: string;
}): string {
  const body = renderMarkdown(issue.markdown);
  // Light theme on purpose: email clients (incl. QQ 邮箱) often ignore a dark
  // background set on <body>, which left light-gray text floating on white.
  // Dark text on a white card is readable everywhere, so we go light instead.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${issue.title}</title>
<style>
  a { color:#2563eb; text-decoration:none; }
  h2, h3, h4 { color:#111827; }
  h2 { font-size:20px; margin:28px 0 12px; }
  h3 { font-size:17px; margin:22px 0 8px; }
  h4 { font-size:16px; margin:20px 0 8px; }
  p { margin:0 0 16px; }
  ul, ol { margin:0 0 16px; padding-left:22px; }
  li { margin:4px 0; }
  blockquote { margin:0 0 16px; padding:2px 16px; border-left:3px solid #e5e7eb; color:#6b7280; }
  code { background:#f3f4f6; padding:2px 5px; border-radius:4px; font-size:14px; }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <div style="max-width:640px;margin:0 auto;padding:40px 24px;background:#ffffff;font:16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2937;">
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a94a6;">
      LearnFromGithub &middot; ${formatWeek(issue.weekOf)}
    </p>
    <h1 style="margin:0 0 8px;font-size:28px;line-height:1.25;color:#111827;">${issue.title}</h1>
    <p style="margin:0 0 36px;font-size:17px;color:#6b7280;">${issue.subtitle}</p>
    <div style="color:#1f2937;">${body}</div>
    <hr style="margin:40px 0 24px;border:0;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:15px;">
      <a href="${SITE_URL}" style="color:#2563eb;text-decoration:none;">
        Explore every project on the dashboard &rarr;
      </a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
      You are receiving this because you subscribed to LearnFromGithub.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Sends the issue to every active subscriber over SMTP (QQ 邮箱 by default).
 * Without SMTP_USER / SMTP_PASS this is a dry run that logs recipients, so the
 * pipeline stays runnable end to end before email is configured.
 */
export async function sendIssue(
  issue: { title: string; subtitle: string; html: string },
  recipients: string[],
): Promise<SendResult> {
  if (recipients.length === 0) {
    console.log('   No active subscribers — nothing to send.');
    return { sent: 0, dryRun: false };
  }

  if (!SMTP_USER || !SMTP_PASS) {
    console.log(`   DRY RUN: would email ${recipients.length} subscriber(s):`);
    for (const email of recipients) console.log(`     - ${email}`);
    console.log('   Set SMTP_USER (QQ 邮箱) and SMTP_PASS (授权码) in .env to send for real.');
    return { sent: 0, dryRun: true };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // 465 端口走 SSL；若改用 587 请设为 false（STARTTLS）
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  let sent = 0;
  for (const email of recipients) {
    try {
      await transporter.sendMail({
        from: FROM,
        to: email,
        subject: issue.title,
        html: issue.html,
      });
      sent += 1;
      console.log(`     Sent to ${email}`);
    } catch (error) {
      console.error(`   Failed to send to ${email}: ${(error as Error).message}`);
    }
  }

  return { sent, dryRun: false };
}
