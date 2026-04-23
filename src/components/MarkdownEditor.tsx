'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';

// ── Markdown renderer (inline-safe) ──────────────────────────
marked.setOptions({ breaks: false, gfm: true });

// Safe grey SVG used in place of broken external image placeholders
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='300' viewBox='0 0 600 300'%3E%3Crect width='600' height='300' fill='%23e2e3dc'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='16' fill='%237a7b75' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";

function renderMarkdown(line: string): string {
  if (!line.trim()) return '';
  let html = (marked.parse(line, { async: false }) as string).trim();
  // Strip wrapping <p>…</p> so inline content flows naturally
  html = html.replace(/^<p>([\s\S]*?)<\/p>$/, '$1');
  // Only open proper external links in a new tab; neutralise anchor/relative links
  html = html.replace(/<a href="([^"]*)"([^>]*)>/g, (_match, href) => {
    const isExternal = /^https?:\/\//i.test(href) || /^www\./i.test(href);
    if (isExternal) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
    }
    // Broken / relative / anchor — render as inert styled text
    return `<a href="#" onclick="return false;" class="broken-link">`;
  });
  // Replace broken placeholder service URLs with a safe local SVG
  html = html.replace(/src="https?:\/\/(via\.placeholder\.com|placehold\.co)[^"]*"/g, `src="${PLACEHOLDER_IMG}"`);
  return html;
}

// ── Classify a line for display ───────────────────────────────
function lineStyle(line: string): React.CSSProperties & { className: string } {
  if (/^#{1}\s/.test(line)) return { className: 'text-[1.65rem] font-bold leading-tight tracking-tight text-[var(--color-on-surface)] mt-4 mb-1' };
  if (/^#{2}\s/.test(line)) return { className: 'text-[1.25rem] font-bold leading-snug text-[var(--color-on-surface)] mt-3 mb-1' };
  if (/^#{3}\s/.test(line)) return { className: 'text-[1.05rem] font-semibold leading-snug text-[var(--color-on-surface)] mt-2' };
  if (/^>\s/.test(line))    return { className: 'border-l-[3px] border-[var(--color-primary)] pl-3 italic text-[var(--color-on-surface-var)]' };
  if (/^```/.test(line))    return { className: 'font-mono text-[12.5px] bg-[var(--color-primary)]/5 px-2 py-0.5 rounded text-[var(--color-primary)]' };
  if (/^[-*+]\s/.test(line)) return { className: 'flex gap-2 items-start text-[14px]' };
  if (/^\d+\.\s/.test(line)) return { className: 'text-[14px] text-[var(--color-on-surface)]' };
  if (/^---/.test(line))    return { className: 'border-t border-[var(--color-surface-high)] my-2' };
  return { className: 'text-[14px] leading-relaxed text-[var(--color-on-surface)]' };
}

// ── Auto-resize a textarea to fit its content ─────────────────
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  initialContent?: string;
  onChange?: (text: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ initialContent = '', onChange, placeholder = 'Click to start writing…' }: Props) {
  const [lines, setLines] = useState<string[]>(() => {
    const ls = initialContent.split('\n');
    return ls.length ? ls : [''];
  });
  const [active, setActive] = useState<number | null>(null);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Sync initialContent changes (when switching notes)
  useEffect(() => {
    setLines(initialContent.split('\n').length ? initialContent.split('\n') : ['']);
    setActive(null);
  }, [initialContent]);

  // Keep a ref so blur/keydown always see the latest lines without stale closure
  const linesRef = useRef<string[]>(lines);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  // Flush current content to parent — called only on Enter, Backspace-merge, paste, or blur
  const flush = useCallback(() => {
    onChange?.(linesRef.current.join('\n'));
  }, [onChange]);

  const focusAt = useCallback((idx: number, col?: 'start' | 'end') => {
    setActive(idx);
    requestAnimationFrame(() => {
      const el = refs.current[idx];
      if (!el) return;
      el.focus();
      autoResize(el);
      const pos = col === 'start' ? 0 : el.value.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const updateLine = (idx: number, val: string) => {
    setLines(ls => { const n = [...ls]; n[idx] = val; return n; });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>, idx: number) => {
    const val = e.target.value;
    autoResize(e.target);

    // Handle pasted content with newlines — flush after paste
    if (val.includes('\n')) {
      const parts = val.split('\n');
      setLines(ls => {
        const n = [...ls];
        n.splice(idx, 1, ...parts);
        linesRef.current = n;
        return n;
      });
      requestAnimationFrame(() => {
        focusAt(idx + parts.length - 1);
        flush();
      });
      return;
    }
    updateLine(idx, val);
    // No flush here — typing alone does NOT sync
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number) => {
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end, value } = el;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = value.slice(0, s);
      const after  = value.slice(end);

      // Auto-continue markdown lists
      let prefix = '';
      const listMatch = before.match(/^(\s*)([-*+]|\d+\.)\s(.*)$/);
      if (listMatch) {
        if (!listMatch[3]) {
          // Empty list item → break out of list
          updateLine(idx, '');
          return;
        }
        const bullet = listMatch[2].replace(/\d+/, n => String(parseInt(n) + 1));
        prefix = listMatch[1] + bullet + ' ';
      }

      setLines(ls => {
        const n = [...ls];
        n[idx] = before;
        n.splice(idx + 1, 0, prefix + after);
        linesRef.current = n;
        return n;
      });
      requestAnimationFrame(() => {
        focusAt(idx + 1, 'start');
        flush(); // Enter → sync
      });

    } else if (e.key === 'Backspace' && s === 0 && end === 0 && idx > 0) {
      e.preventDefault();
      const prevLen = lines[idx - 1].length;
      setLines(ls => {
        const n = [...ls];
        n[idx - 1] = n[idx - 1] + n[idx];
        n.splice(idx, 1);
        linesRef.current = n;
        return n;
      });
      requestAnimationFrame(() => {
        const el2 = refs.current[idx - 1];
        if (!el2) return;
        el2.focus();
        el2.setSelectionRange(prevLen, prevLen);
        autoResize(el2);
        flush(); // Backspace-merge → sync
      });

    } else if (e.key === 'ArrowUp' && idx > 0) {
      // Move up if cursor is on first line of textarea
      if (s <= value.indexOf('\n') || value.indexOf('\n') === -1) {
        e.preventDefault();
        focusAt(idx - 1, 'end');
      }

    } else if (e.key === 'ArrowDown' && idx < lines.length - 1) {
      // Move down if cursor is on last line of textarea
      const lastNL = value.lastIndexOf('\n');
      if (s > lastNL) {
        e.preventDefault();
        focusAt(idx + 1, 'start');
      }

    } else if (e.key === 'Delete' && s === value.length && end === value.length && idx < lines.length - 1) {
      // Delete at end of line → merge next line into this one
      e.preventDefault();
      const curLen = value.length;
      setLines(ls => {
        const n = [...ls];
        n[idx] = n[idx] + n[idx + 1];
        n.splice(idx + 1, 1);
        linesRef.current = n;
        return n;
      });
      requestAnimationFrame(() => {
        const el2 = refs.current[idx];
        if (!el2) return;
        el2.focus();
        el2.setSelectionRange(curLen, curLen);
        autoResize(el2);
        flush(); // Delete-merge → sync
      });

    } else if (e.key === 'Tab') {
      e.preventDefault();
      const before = value.slice(0, s);
      const after  = value.slice(end);
      updateLine(idx, before + '  ' + after);
      requestAnimationFrame(() => {
        el.setSelectionRange(s + 2, s + 2);
        autoResize(el);
      });
    }
  };

  // Render a single preview line
  const PreviewLine = ({ line, idx }: { line: string; idx: number }) => {
    const style = lineStyle(line);

    if (!line.trim()) {
      return (
        <div
          className="min-h-[1.75rem] cursor-text"
          onClick={() => focusAt(idx)}
          data-placeholder={idx === 0 ? placeholder : undefined}
        />
      );
    }

    if (/^---+$/.test(line.trim())) {
      return <hr className="border-[var(--color-surface-high)] my-3 cursor-text" onClick={() => focusAt(idx)} />;
    }

    const html = renderMarkdown(line);

    // Checked / unchecked task — must come BEFORE the generic bullet check
    if (/^- \[(x| )\] /.test(line)) {
      const checked = line[3] === 'x';
      const text    = renderMarkdown(line.replace(/^- \[(x| )\] /, ''));
      return (
        <div className="flex gap-2 items-start cursor-text text-[14px]" onClick={() => focusAt(idx)}>
          <input type="checkbox" checked={checked} readOnly className="mt-1 accent-[var(--color-primary)]" />
          <span className={`preview-inline flex-1 ${checked ? 'line-through opacity-60' : ''}`} dangerouslySetInnerHTML={{ __html: text }} />
        </div>
      );
    }

    // Bullet list item
    if (/^[-*+]\s/.test(line)) {
      const content = renderMarkdown(line.replace(/^[-*+]\s/, ''));
      return (
        <div className={`flex gap-2 items-start cursor-text ${style.className}`} onClick={() => focusAt(idx)}>
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-on-surface)] flex-shrink-0" />
          <span className="preview-inline flex-1" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    }

    // Add id for heading scroll targets (for ToC navigation)
    const headingSlug = /^#{1,3}\s/.test(line)
      ? line.replace(/^#+\s/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : undefined;

    return (
      <div
        id={headingSlug ? `heading-${headingSlug}` : undefined}
        className={`cursor-text ${style.className} preview-inline`}
        onClick={() => focusAt(idx)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  // ── Build segments: group ``` fences into code blocks ─────────
  type Segment =
    | { type: 'line'; idx: number; line: string }
    | { type: 'code'; lang: string; body: string; startIdx: number; endIdx: number };

  const segments: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    const fenceMatch = lines[i].match(/^```(\S*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || '';
      const startIdx = i;
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        bodyLines.push(lines[i]);
        i++;
      }
      const endIdx = i < lines.length ? i : i - 1;
      segments.push({ type: 'code', lang, body: bodyLines.join('\n'), startIdx, endIdx });
      i++; // skip closing ```
    } else {
      segments.push({ type: 'line', idx: i, line: lines[i] });
      i++;
    }
  }

  return (
    <div className="w-full" onClick={e => { if (e.currentTarget === e.target) focusAt(lines.length - 1); }}>
      {segments.map((seg, si) => {
        if (seg.type === 'code') {
          // If any line in this block is active, show raw edit for that line
          const isEditing = active !== null && active >= seg.startIdx && active <= seg.endIdx;
          if (isEditing) {
            // Render the raw lines of this fence block for editing
            return (
              <div key={si}>
                {[seg.startIdx, ...Array.from({ length: seg.endIdx - seg.startIdx - 1 }, (_, k) => seg.startIdx + 1 + k), seg.endIdx].map(idx => (
                  <div key={idx} className="group relative">
                    {active === idx ? (
                      <textarea
                        ref={el => { refs.current[idx] = el; }}
                        value={lines[idx]}
                        rows={1}
                        spellCheck={false}
                        className="w-full bg-transparent border-l-[3px] border-[var(--color-primary)] pl-3 -ml-4 outline-none resize-none overflow-hidden leading-relaxed rounded-r-[var(--radius-sm)] font-mono text-[13px] text-[var(--color-on-surface)] caret-[var(--color-primary)]"
                        style={{ paddingTop: '2px', paddingBottom: '2px' }}
                        onChange={e => handleChange(e, idx)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        onBlur={() => { flush(); setActive(null); }}
                      />
                    ) : (
                      <PreviewLine line={lines[idx]} idx={idx} />
                    )}
                  </div>
                ))}
              </div>
            );
          }
          // Rendered code block
          return (
            <div
              key={si}
              className="my-3 rounded-xl overflow-hidden border border-[var(--color-surface-high)] cursor-text"
              onClick={() => focusAt(seg.startIdx)}
            >
              {/* header bar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-surface-high)]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
                  {seg.lang || 'code'}
                </span>
                <div className="flex gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
                </div>
              </div>
              {/* code body */}
              <pre className="px-4 py-3 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-[var(--color-primary)]">
                <code>{seg.body}</code>
              </pre>
            </div>
          );
        }

        // Normal line
        const { idx, line } = seg;
        return (
          <div key={si} className="group relative">
            {active === idx ? (
              <textarea
                ref={el => { refs.current[idx] = el; }}
                value={line}
                rows={1}
                spellCheck
                autoCorrect="on"
                className={`w-full bg-transparent border-l-[3px] border-[var(--color-primary)] pl-3 -ml-4 outline-none resize-none overflow-hidden leading-relaxed rounded-r-[var(--radius-sm)] font-mono text-[13.5px] text-[var(--color-on-surface)] caret-[var(--color-primary)] ${
                  (() => { const s = lineStyle(line); return s.className.replace('text-[1.65rem]','text-[1.5rem]').replace('text-[1.25rem]','text-[1.15rem]'); })()
                }`}
                style={{ paddingTop: '2px', paddingBottom: '2px' }}
                onChange={e => handleChange(e, idx)}
                onKeyDown={e => handleKeyDown(e, idx)}
                onBlur={() => { flush(); setActive(null); }}
              />
            ) : (
              <PreviewLine line={line} idx={idx} />
            )}
          </div>
        );
      })}

      {/* Padding zone — click to append */}
      <div className="h-32 cursor-text" onClick={() => focusAt(lines.length - 1)} />

      <style>{`
        .preview-inline a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
        .preview-inline a.broken-link { cursor: default; pointer-events: none; }
        .preview-inline strong { font-weight: 700; }
        .preview-inline em { font-style: italic; }
        .preview-inline code {
          background: color-mix(in srgb, var(--color-primary) 8%, transparent);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.82em;
          font-family: ui-monospace, monospace;
          color: var(--color-primary);
        }
        .preview-inline del { text-decoration: line-through; opacity: 0.7; }
        .preview-inline mark { background: #fef08a; border-radius: 2px; padding: 0 0.1rem; }
        .preview-inline img { max-width: 100%; border-radius: 6px; margin: 0.5rem 0; display: block; }
        .preview-inline ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .preview-inline ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .preview-inline li { margin: 0.1rem 0; }
        [data-theme=dark] .preview-inline mark { background: #713f12; color: #fef3c7; }
        [data-placeholder]:empty::after {
          content: attr(data-placeholder);
          color: var(--color-outline);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
