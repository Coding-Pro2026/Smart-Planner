import React from 'react';

/** Renders **bold**, _italic_ and `- ` / `1. ` lists without innerHTML (XSS-safe). */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-stone-900">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      out.push(<em key={`${keyPrefix}-i${i}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = String(text ?? '').split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul${k}`} className="list-disc pl-5 space-y-0.5">
          {list.map((li, j) => (
            <li key={j}>{renderInline(li, `li${k}-${j}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((line, idx) => {
    const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flush(idx);
    if (line.trim()) blocks.push(<p key={`p${idx}`}>{renderInline(line, `p${idx}`)}</p>);
  });
  flush(lines.length);
  return <div className={`space-y-1.5 ${className ?? ''}`}>{blocks}</div>;
}
