import { Fragment, type ReactNode } from "react";

/** **bold** and [label](https://link). Anything else is plain text, so model output can never inject HTML. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else {
      const [, label, url] = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(tok)!;
      parts.push(<a key={i++} href={url} target="_blank" rel="noreferrer" className="text-brand underline">{label}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const bullet = /^\s*[-*]\s+/;
  const heading = /^#{1,4}\s+/;
  return (
    <>
      {blocks.flatMap((b, i) => {
        // A block can mix text, headings and bullets, so walk it line by line and group the runs.
        const out: ReactNode[] = [];
        let list: string[] = [];
        let para: string[] = [];
        const flushList = () => { if (list.length) { out.push(<ul key={`${i}-u${out.length}`} className="my-1 list-disc space-y-1 pl-5">{list.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>); list = []; } };
        const flushPara = () => { if (para.length) { out.push(<p key={`${i}-p${out.length}`} className="my-1">{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>); para = []; } };
        for (const line of b.split("\n")) {
          if (bullet.test(line)) { flushPara(); list.push(line.replace(bullet, "")); }
          else if (heading.test(line)) { flushPara(); flushList(); out.push(<p key={`${i}-h${out.length}`} className="mb-1 mt-3 font-bold text-ink">{inline(line.replace(heading, ""))}</p>); }
          else { flushList(); para.push(line); }
        }
        flushList(); flushPara();
        return out;
      })}
    </>
  );
}
