'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';

// ── Markdown renderer (inline-safe) ──────────────────────────
marked.setOptions({ breaks: false, gfm: true });

function renderMarkdown(line: string): string {
  if (!line.trim()) return '';
  const html = (marked.parse(line, { async: false }) as string).trim();
  // Strip wrapping <p>…</p> so inline content flows naturally
  return html.replace(/^<p>([\s\S]*?)<\/p>$/, '$1');
}

// ── Classify a line for display ───────────────────────────────
function lineStyle(line: string): React.CSSProperties & { className: string } {
  if (/^#{1}\s/.test(line)) return { className: 'text-[1.65rem] font-bold leading-tight tracking-tight text-[var(--color-on-surface)] mt-4 mb-1' };
  if (/^#{2}\s/.test(line)) return { className: 'text-[1.25rem] font-bold leading-snug text-[var(--color-on-surface)] mt-3 mb-1' };
  if (/^#{3}\s/.test(line)) return { className: 'text-[1.05rem] font-semibold leading-snug text-[var(--color-on-surface)] mt-2' };
  if (/^>\s/.test(line))    return { className: 'border-l-[3px] border-[var(--color-primary)] pl-3 italic text-[var(--color-on-surface-var)]' };
  if (/^```/.test(line))    return { className: 'font-mono text-[12.5px] bg-[var(--color-surface-mid)] px-2 py-0.5 rounded text-[var(--color-primary)]' };
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

  // Notify parent
  useEffect(() => {
    onChange?.(lines.join('\n'));
  }, [lines]); // eslint-disable-line

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

    // Handle pasted content with newlines
    if (val.includes('\n')) {
      const parts = val.split('\n');
      setLines(ls => {
        const n = [...ls];
        n.splice(idx, 1, ...parts);
        return n;
      });
      requestAnimationFrame(() => focusAt(idx + parts.length - 1));
      return;
    }
    updateLine(idx, val);
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
        return n;
      });
      requestAnimationFrame(() => focusAt(idx + 1, 'start'));

    } else if (e.key === 'Backspace' && s === 0 && end === 0 && idx > 0) {
      e.preventDefault();
      const prevLen = lines[idx - 1].length;
      setLines(ls => {
        const n = [...ls];
        n[idx - 1] = n[idx - 1] + n[idx];
        n.splice(idx, 1);
        return n;
      });
      requestAnimationFrame(() => {
        const el2 = refs.current[idx - 1];
        if (!el2) return;
        el2.focus();
        el2.setSelectionRange(prevLen, prevLen);
        autoResize(el2);
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

    // Checked / unchecked task
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

    return (
      <div
        className={`cursor-text ${style.className} preview-inline`}
        onClick={() => focusAt(idx)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div className="w-full" onClick={e => { if (e.currentTarget === e.target) focusAt(lines.length - 1); }}>
      {lines.map((line, idx) => (
        <div key={idx} className="group relative">
          {active === idx ? (
            /* ── RAW EDIT LINE ── */
            <textarea
              ref={el => { refs.current[idx] = el; }}
              value={line}
              rows={1}
              spellCheck
              autoCorrect="on"
              className={`w-full bg-[var(--color-primary-container)]/20 border-l-[3px] border-[var(--color-primary)] pl-3 -ml-4 outline-none resize-none overflow-hidden leading-relaxed rounded-r-[var(--radius-sm)] font-mono text-[13.5px] text-[var(--color-on-surface)] caret-[var(--color-primary)] ${
                (() => { const s = lineStyle(line); return s.className.replace('text-[1.65rem]','text-[1.5rem]').replace('text-[1.25rem]','text-[1.15rem]'); })()
              }`}
              style={{ paddingTop: '2px', paddingBottom: '2px' }}
              onChange={e => handleChange(e, idx)}
              onKeyDown={e => handleKeyDown(e, idx)}
              onBlur={() => setActive(null)}
            />
          ) : (
            /* ── PREVIEW LINE ── */
            <PreviewLine line={line} idx={idx} />
          )}
        </div>
      ))}

      {/* Padding zone — click to append */}
      <div className="h-32 cursor-text" onClick={() => focusAt(lines.length - 1)} />

      <style>{`
        .preview-inline a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
        .preview-inline strong { font-weight: 700; }
        .preview-inline em { font-style: italic; }
        .preview-inline code {
          background: var(--color-surface-mid);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.82em;
          font-family: ui-monospace, monospace;
          color: var(--color-primary);
        }
        .preview-inline del { text-decoration: line-through; opacity: 0.7; }
        .preview-inline mark { background: #fef08a; border-radius: 2px; padding: 0 0.1rem; }
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
