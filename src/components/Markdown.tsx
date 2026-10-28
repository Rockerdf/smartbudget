import type { ReactNode } from "react";

// Small, safe Markdown renderer for AI replies: headings, paragraphs, bullet and
// numbered lists, tables, code blocks, **bold**, *italic*, `code` and links.
// It builds React elements (never raw HTML), so replies can't inject markup.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|(?<![\w*])\*[^*\s][^*]*\*(?![\w*]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="px-1 py-0.5 rounded bg-[#F1F5F9] text-[0.85em] font-mono">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      out.push(<a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] underline underline-offset-2">{label}</a>);
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${b++}`;
    if (!line.trim()) { i++; continue; }

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={key} className="bg-[#0F172A] text-[#E2E8F0] text-xs rounded-xl p-3 overflow-x-auto"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const cls = h[1].length <= 2 ? "text-base font-bold" : "text-sm font-bold";
      blocks.push(<p key={key} className={`${cls} text-[#0F172A] mt-1`}>{inline(h[2], key)}</p>);
      i++;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} className="overflow-x-auto -mx-1">
          <table className="text-xs border-collapse min-w-full">
            <thead><tr>{head.map((c, j) => <th key={j} className="text-left font-semibold text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1.5">{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-[#E2E8F0] px-2.5 py-1.5 text-[#334155] align-top">{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key} className={`${ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
          {items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s+)/.test(lines[i]) && !isTableRow(lines[i])) para.push(lines[i++]);
    if (!para.length) { para.push(lines[i++]); }
    blocks.push(<p key={key}>{para.flatMap((p, j) => (j ? [<br key={`${key}br${j}`} />, ...inline(p, `${key}-${j}`)] : inline(p, `${key}-${j}`)))}</p>);
  }
  return <div className="space-y-2.5 leading-relaxed break-words">{blocks}</div>;
}
