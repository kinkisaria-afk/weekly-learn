/**
 * Minimal Markdown renderer for the newsletter body.
 *
 * Input is our own generated content constrained to headings, paragraphs,
 * lists, and inline emphasis/links — not arbitrary user Markdown. HTML in the
 * source is escaped rather than passed through, so output is safe to inject.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

const HEADING = /^(#{1,4})\s+(.*)$/;

export function renderMarkdown(markdown: string): string {
  const blocks = markdown.trim().split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) continue;

    // A heading may be followed directly by body text with no blank line
    // between them, so emit headings as they appear and keep the remainder.
    let lines = rawLines;
    while (lines.length > 0) {
      const heading = lines[0].match(HEADING);
      if (!heading) break;
      // `#` is demoted to h2: the page supplies its own h1.
      const level = Math.max(2, heading[1].length);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      lines = lines.slice(1);
    }
    if (lines.length === 0) continue;

    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('');
      html.push(`<ul>${items}</ul>`);
      continue;
    }

    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('');
      html.push(`<ol>${items}</ol>`);
      continue;
    }

    if (lines.every((l) => l.startsWith('>'))) {
      const quote = lines.map((l) => l.replace(/^>\s?/, '')).join(' ');
      html.push(`<blockquote>${inline(quote)}</blockquote>`);
      continue;
    }

    html.push(`<p>${inline(lines.join(' '))}</p>`);
  }

  return html.join('\n');
}
