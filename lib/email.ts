import { Resend } from 'resend';
import { renderMarkdown } from './markdown';
import { formatWeek } from './week';

const FROM = process.env.NEWSLETTER_FROM ?? 'LearnFromGithub <newsletter@example.com>';
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

export type SendResult = { sent: number; dryRun: boolean };

export function buildEmailHtml(issue: {
  title: string;
  subtitle: string;
  markdown: string;
  weekOf: string;
}): string {
  const body = renderMarkdown(issue.markdown);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${issue.title}</title>
</head>
<body style="margin:0;padding:0;background:#0b0d10;">
  <div style="max-width:640px;margin:0 auto;padding:40px 24px;font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6e8eb;">
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7c8896;">
      LearnFromGithub &middot; ${formatWeek(issue.weekOf)}
    </p>
    <h1 style="margin:0 0 8px;font-size:30px;line-height:1.2;color:#fff;">${issue.title}</h1>
    <p style="margin:0 0 36px;font-size:17px;color:#9aa5b1;">${issue.subtitle}</p>
    <div style="color:#d5dae0;">${body}</div>
    <hr style="margin:40px 0 24px;border:0;border-top:1px solid #22272e;">
    <p style="margin:0;font-size:15px;">
      <a href="${SITE_URL}" style="color:#7cc4ff;text-decoration:none;">
        Explore every project on the dashboard &rarr;
      </a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#6b7480;">
      You are receiving this because you subscribed to LearnFromGithub.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Sends the issue to every active subscriber. Without RESEND_API_KEY this is a
 * dry run that logs recipients instead of sending, so the pipeline stays
 * runnable end to end before email is configured.
 */
export async function sendIssue(
  issue: { title: string; subtitle: string; html: string },
  recipients: string[],
): Promise<SendResult> {
  if (recipients.length === 0) {
    console.log('   No active subscribers — nothing to send.');
    return { sent: 0, dryRun: false };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`   DRY RUN: would email ${recipients.length} subscriber(s):`);
    for (const email of recipients) console.log(`     - ${email}`);
    console.log('   Set RESEND_API_KEY to send for real.');
    return { sent: 0, dryRun: true };
  }

  const resend = new Resend(apiKey);
  let sent = 0;

  for (const email of recipients) {
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: issue.title,
      html: issue.html,
    });
    if (error) {
      console.error(`   Failed to send to ${email}: ${error.message}`);
      continue;
    }
    sent += 1;
  }

  return { sent, dryRun: false };
}
