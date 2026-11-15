import katex from "katex";
import type { ReactNode } from "react";

/**
 * The little Markdown the copilot writes: paragraphs, "- " lists, **bold**, `code` and LaTeX
 * ($…$ inline, $$…$$ on its own line). Everything else is shown as plain text (no raw HTML).
 */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return <>{blocks.map((b, i) => <Block key={i} text={b} />)}</>;
}

function Block({ text }: { text: string }) {
  const display = text.trim().match(/^\$\$([\s\S]+)\$\$$/);
  if (display) return <Tex tex={display[1]} block />;
  const lines = text.split("\n");
  if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
    const ordered = /^\s*\d/.test(lines[0]);
    const items = lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>);
    return ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  return <p>{lines.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l)}</span>)}</p>;
}

function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: false });
  return block ? <div className="cp-eq" dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\$([^$\n]+?)\$|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1] !== undefined) out.push(<Tex key={m.index} tex={m[1]} />);
    else if (m[2] !== undefined) out.push(<strong key={m.index}>{m[2]}</strong>);
    else out.push(<code key={m.index}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
