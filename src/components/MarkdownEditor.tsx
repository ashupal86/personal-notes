'use client';
import { useState, useRef, useEffect, useCallback, useReducer, memo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Code2, Table2, Minus,
  Smile, Image as ImageIcon, Undo2, Redo2, Copy, Check, GitBranch,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import '@/lib/prism-languages';
import type { SlashCmd } from './SlashMenu';

const SlashMenu    = dynamic(() => import('./SlashMenu'),    { ssr: false });
const EditorPicker = dynamic(() => import('./EditorPicker'), { ssr: false });

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
const REHYPE_PLUGINS = [rehypeRaw, rehypeKatex, rehypeSlug];
const TABLE_TPL = '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |';

/** Pre-process markdown: ==highlight== → <mark>, def lists → <dl> */
function preprocess(md: string): string {
  // Protect fenced code blocks and math blocks from substitution
  const FENCE = /^```[\s\S]*?^```/gm;
  const MATH  = /\$\$[\s\S]*?\$\$/g;
  const placeholders: string[] = [];
  let s = md
    .replace(FENCE,  m => { placeholders.push(m); return `\0BLOCK${placeholders.length-1}\0`; })
    .replace(MATH,   m => { placeholders.push(m); return `\0BLOCK${placeholders.length-1}\0`; });

  // ==highlight==
  s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  // Definition lists
  s = s.replace(/^([^\n\s:][^\n]*)\n\n?((?:\s*:\s+[^\n]+\n?)+)/gm, (_, term, defs) => {
    const dds = defs.trim().split('\n')
      .map((d: string) => d.replace(/^\s*:\s+/, '').trim())
      .filter(Boolean)
      .map((d: string) => `<dd>${d}</dd>`).join('');
    return `<dl><dt>${term.trim()}</dt>${dds}</dl>\n`;
  });

  // Restore protected blocks
  s = s.replace(/\0BLOCK(\d+)\0/g, (_, i) => placeholders[+i]);
  return s;
}

// Unique ID counter for mermaid renders
let _mermaidCounter = 0;

/** Mermaid diagram renderer — loaded client-side only */
function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const id = useRef(`md-mermaid-${++_mermaidCounter}`);

  useEffect(() => {
    let alive = true;
    setLoading(true); setSvg(''); setErr('');
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'neutral',
          securityLevel: 'loose',
          fontFamily: 'var(--font-sans)',
        });
        const { svg } = await mermaid.render(id.current, code.trim());
        if (alive) { setSvg(svg); setLoading(false); }
      } catch (e) {
        if (alive) { setErr(String(e).replace(/^Error:\s*/, '')); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [code]);

  if (loading) return (
    <div className="md-mermaid-wrap md-mermaid-loading">
      <GitBranch size={18} className="animate-pulse" />
      <span>Rendering diagram…</span>
    </div>
  );
  if (err) return (
    <div className="md-mermaid-wrap md-mermaid-error">
      <span className="font-mono text-[11px]">{err}</span>
    </div>
  );
  return <div className="md-mermaid-wrap" dangerouslySetInnerHTML={{ __html: svg }} />;
}


/** iOS-style code block: matte-gray top bar + frosted glass code body */
function CodeBlock({ node: _n, inline, className, children, ...props }: Record<string, unknown> & { inline?: boolean; className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const lang = (className as string | undefined)?.replace('language-', '') ?? '';
  const code = String(children).replace(/\n$/, '');

  // Reliable inline detection: fenced blocks always have a language- className;
  // backtick inline code never does. The `inline` prop is unreliable in v8.
  const isInline = !className?.startsWith('language-') && !code.includes('\n');
  if (isInline) return <code className="md-inline-code" {...props}>{children}</code>;
  if (lang === 'mermaid') return <MermaidDiagram code={code} />;

  const copyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(code);
    } catch {
      // fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="md-code-block" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
      {/* ── Matte-gray top bar ── */}
      <div className="md-code-topbar">
        <span className="md-code-lang">{lang || 'code'}</span>
        <div className="md-code-dots">
          <span title="Close" />
          <span title="Minimise" />
          <span title="Fullscreen" />
        </div>
      </div>
      {/* ── Frosted glass code body ── */}
      <div className="md-code-body">
        <button className="md-code-copy" onClick={copyCode} title="Copy code">
          {copied ? <Check size={10}/> : <Copy size={10}/>}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
        <SyntaxHighlighter
          language={lang || 'text'}
          style={oneDark}
          customStyle={{ margin:0, padding:'0.75rem 1rem 1rem', background:'transparent', fontSize:'13px', lineHeight:'1.7', fontFamily:'ui-monospace,SFMono-Regular,Consolas,monospace' }}
          codeTagProps={{ style: { fontFamily: 'inherit' } }}
          wrapLines={false}
          PreTag="div"
        >{code}</SyntaxHighlighter>
      </div>
    </div>
  );
}


/** Memoised preview line — lives OUTSIDE MarkdownEditor so its identity is stable,
 *  meaning React.memo can bail out when `line` hasn't changed */
const PreviewLine = memo(function PreviewLine({
  line, idx, onOpen, placeholder,
}: {
  line: string; idx: number;
  onOpen: (i: number) => void;
  placeholder?: string;
}) {
  if (!line.trim()) return (
    <div className="min-h-[1.6rem] cursor-text" onClick={() => onOpen(idx)}
      data-placeholder={placeholder} />
  );
  return (
    <div className="preview-line cursor-text" onClick={() => onOpen(idx)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={mdComponents}>
        {preprocess(line)}
      </ReactMarkdown>
    </div>
  );
});
function TableBlock({ children }: { children?: React.ReactNode }) {
  return <div className="md-table-wrap"><table>{children}</table></div>;
}

// ── History reducer ───────────────────────────────────────────
type HS = { snaps: string[]; ptr: number };
type HA = { type:'push';val:string }|{type:'undo'}|{type:'redo'};
function histR(s: HS, a: HA): HS {
  if (a.type === 'push') {
    const base = s.snaps.slice(0, s.ptr + 1);
    if (base[base.length-1] === a.val) return s;
    const next = [...base, a.val].slice(-100);
    return { snaps: next, ptr: next.length - 1 };
  }
  if (a.type === 'undo' && s.ptr > 0) return { ...s, ptr: s.ptr - 1 };
  if (a.type === 'redo' && s.ptr < s.snaps.length - 1) return { ...s, ptr: s.ptr + 1 };
  return s;
}

function autoResize(el: HTMLTextAreaElement) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }

// ── Toolbar button ─────────────────────────────────────────────
function TB({ icon, tip, fn, active }: { icon:React.ReactNode; tip:string; fn:()=>void; active?:boolean }) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button type="button" onClick={fn} aria-label={tip}
            className={`relative p-1.5 rounded-lg transition-all flex items-center justify-center
              ${active ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/12' : 'text-[var(--color-outline)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'}`}
          >
            {icon}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top" sideOffset={6}
            className="z-[9999] px-2.5 py-1.5 text-[11px] font-semibold rounded-lg shadow-xl bg-[var(--color-on-surface)] text-[var(--color-surface)] select-none animate-in fade-in-0 zoom-in-95"
          >
            {tip}
            <Tooltip.Arrow className="fill-[var(--color-on-surface)]"/>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
function TSep() { return <div className="w-px h-4 bg-[var(--color-surface-high)] mx-0.5 flex-shrink-0"/>; }

interface Props {
  initialContent?: string;
  onChange?: (t: string) => void;
  placeholder?: string;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  historyRef?: React.MutableRefObject<{ undo:()=>void; redo:()=>void } | null>;
  previewOnly?: boolean;
}

export default function MarkdownEditor({ initialContent='', onChange, placeholder='Click to start writing…', onHistoryChange, historyRef, previewOnly=false }: Props) {
  const [content, setContent] = useState(initialContent);
  const [editLine, setEditLine] = useState<number | null>(null);
  const [hist, dispatch] = useReducer(histR, { snaps: [initialContent], ptr: 0 });
  const [slashQuery, setSlashQuery] = useState<string|null>(null);  // null = closed, string = query
  const [pickerTab, setPickerTab] = useState<'emoji'|'gif'|'upload'|null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top:number; left:number; width:number }|null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);

  // Sync from parent
  useEffect(() => { setContent(initialContent); setEditLine(null); dispatch({ type:'push', val:initialContent }); contentRef.current=initialContent; }, [initialContent]);

  // Expose history methods via ref
  useEffect(() => {
    if (historyRef) historyRef.current = {
      undo: () => dispatch({ type:'undo' }),
      redo: () => dispatch({ type:'redo' }),
    };
  }, [historyRef]);

  // Apply history pointer
  useEffect(() => {
    const val = hist.snaps[hist.ptr];
    if (val !== undefined && val !== contentRef.current) {
      contentRef.current = val; setContent(val); onChange?.(val); setEditLine(null);
    }
    onHistoryChange?.(hist.ptr > 0, hist.ptr < hist.snaps.length - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist.ptr]);

  // Global Ctrl+Z / Ctrl+Y shortcuts (works even when textarea is not focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      // Don't intercept when user is typing in other inputs
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (!e.shiftKey && e.key === 'z') { e.preventDefault(); dispatch({ type: 'undo' }); }
      if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); dispatch({ type: 'redo' }); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const lines = content.split('\n');

  const histTimeout = useRef<ReturnType<typeof setTimeout>|null>(null);

  const commit = useCallback((newLines: string[]) => {
    const next = newLines.join('\n');
    contentRef.current = next; setContent(next); onChange?.(next);
    // Debounce: push to history 600 ms after last keystroke to avoid a
    // useReducer dispatch (and full re-render) on every character typed
    if (histTimeout.current) clearTimeout(histTimeout.current);
    histTimeout.current = setTimeout(() => dispatch({ type:'push', val:next }), 600);
  }, [onChange]);

  const openLine = useCallback((idx: number) => {
    setEditLine(idx);
    requestAnimationFrame(() => {
      const el = taRef.current; if (!el) return;
      el.focus(); autoResize(el); el.setSelectionRange(el.value.length, el.value.length);
      // Position toolbar above textarea
      const r = el.getBoundingClientRect();
      const containerR = el.closest('.md-editor-root')?.getBoundingClientRect();
      if (containerR) setToolbarPos({ top: r.top - containerR.top - 52, left: 0, width: containerR.width });
      else setToolbarPos({ top: r.top - 52, left: r.left, width: r.width });
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (editLine === null) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end, value } = el;

    // Undo/Redo
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); dispatch({ type:'undo' }); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); dispatch({ type:'redo' }); return; }

    if (e.key === 'Escape') { setEditLine(null); setSlashQuery(null); setPickerTab(null); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If slash menu open, let SlashMenu handle it
      if (slashQuery !== null) return;
      const before = value.slice(0, s); const after = value.slice(end);
      let prefix = '';
      const m = before.match(/^(\s*)([-*+]|\d+\.)\s(.*)$/);
      if (m) { if (!m[3]) { const nl=[...lines]; nl[editLine]=''; commit(nl); return; } prefix = m[1] + m[2].replace(/\d+/, n => String(+n+1)) + ' '; }
      const nl=[...lines]; nl[editLine]=before; nl.splice(editLine+1,0,prefix+after); commit(nl);
      setEditLine(editLine+1);
      requestAnimationFrame(()=>{ const e2=taRef.current; if(e2){e2.focus();autoResize(e2);e2.setSelectionRange(prefix.length,prefix.length);} });

    } else if (e.key==='Backspace' && s===0 && end===0 && editLine>0) {
      e.preventDefault();
      const pl=lines[editLine-1].length;
      const nl=[...lines]; nl[editLine-1]+=nl[editLine]; nl.splice(editLine,1); commit(nl);
      setEditLine(editLine-1);
      requestAnimationFrame(()=>{ const e2=taRef.current; if(e2){e2.focus();autoResize(e2);e2.setSelectionRange(pl,pl);} });

    } else if (e.key==='ArrowUp' && editLine>0 && (s<=value.indexOf('\n')||!value.includes('\n'))) {
      e.preventDefault(); openLine(editLine-1);
    } else if (e.key==='ArrowDown' && editLine<lines.length-1 && s>value.lastIndexOf('\n')) {
      e.preventDefault(); openLine(editLine+1);
    } else if (e.key==='Tab') {
      e.preventDefault();
      const nl=[...lines]; nl[editLine]=value.slice(0,s)+'  '+value.slice(end); commit(nl);
      requestAnimationFrame(()=>{ el.setSelectionRange(s+2,s+2); autoResize(el); });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (editLine===null) return;
    autoResize(e.target);
    const val = e.target.value;
    // Detect `/` for slash menu
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const slashMatch = textBefore.match(/(?:^|\s)\/([^/\s]*)$/);
    if (slashMatch !== null && (val.trim() === '/' + slashMatch[1] || textBefore.endsWith('/' + slashMatch[1]))) {
      setSlashQuery(slashMatch[1]);
    } else { setSlashQuery(null); }

    if (val.includes('\n')) {
      const parts = val.split('\n');
      const nl=[...lines]; nl.splice(editLine,1,...parts); commit(nl);
      const ni=editLine+parts.length-1; setEditLine(ni);
      requestAnimationFrame(()=>{ const el2=taRef.current; if(el2){el2.focus();autoResize(el2);} }); return;
    }
    const nl=[...lines]; nl[editLine]=val; commit(nl);
  };

  // Toolbar helpers
  const wrapSel = (w: string) => {
    if (editLine===null||!taRef.current) return;
    const {selectionStart:s,selectionEnd:e,value}=taRef.current;
    const sel=value.slice(s,e)||'text';
    const nl=[...lines]; nl[editLine]=value.slice(0,s)+w+sel+w+value.slice(e); commit(nl);
    requestAnimationFrame(()=>{ const el=taRef.current; if(el){el.focus();el.setSelectionRange(s+w.length,s+w.length+sel.length);autoResize(el);} });
  };
  const togglePfx = (pfx: string) => {
    if (editLine===null) return;
    const cur=lines[editLine];
    const nl=[...lines]; nl[editLine]=cur.startsWith(pfx)?cur.slice(pfx.length):pfx+cur.replace(/^(#{1,6}\s|>\s|-\s|\d+\.\s|- \[ \] )/,''); commit(nl);
    requestAnimationFrame(()=>{ const el=taRef.current; if(el){el.focus();autoResize(el);} });
  };
  const insertTpl = (tpl: string) => {
    if (editLine===null) return;
    const parts=tpl.split('\n');
    const nl=[...lines]; nl.splice(editLine+1,0,...parts); commit(nl);
    setEditLine(editLine+1);
    requestAnimationFrame(()=>{ const el=taRef.current; if(el){el.focus();autoResize(el);} });
  };
  const insertText = (text: string) => {
    if (editLine===null) return;
    const el=taRef.current; const s=el?.selectionStart??lines[editLine].length;
    const nl=[...lines]; nl[editLine]=lines[editLine].slice(0,s)+text+lines[editLine].slice(s); commit(nl);
    requestAnimationFrame(()=>{ if(el){el.focus();el.setSelectionRange(s+text.length,s+text.length);autoResize(el);} });
  };

  // Slash command execution
  const execSlash = useCallback((cmd: SlashCmd) => {
    if (editLine===null) return;
    setSlashQuery(null);
    // Remove the `/query` from the current line
    const cur = lines[editLine];
    const cleaned = cur.replace(/\/[^\s]*$/, '').trimEnd();
    if (cmd.action === 'special') {
      if (cmd.payload === 'emoji') { const nl=[...lines]; nl[editLine]=cleaned; commit(nl); setPickerTab('emoji'); return; }
      if (cmd.payload === 'image') { const nl=[...lines]; nl[editLine]=cleaned; commit(nl); setPickerTab('upload'); return; }
      if (cmd.payload === 'date')  { const nl=[...lines]; nl[editLine]=cleaned+new Date().toLocaleDateString('en-CA'); commit(nl); return; }
    }
    if (cmd.action === 'prefix')   { const nl=[...lines]; nl[editLine]=cmd.payload+cleaned; commit(nl); }
    if (cmd.action === 'wrap')     { const nl=[...lines]; nl[editLine]=cleaned+cmd.payload+'text'+cmd.payload; commit(nl); }
    if (cmd.action === 'template') { const nl=[...lines]; nl[editLine]=cleaned; nl.splice(editLine+1,0,...cmd.payload.split('\n')); commit(nl); setEditLine(editLine+1); }
    requestAnimationFrame(()=>{ const el=taRef.current; if(el){el.focus();autoResize(el);} });
  }, [editLine, lines, commit]);

  // Build blocks — groups code fences, tables, footnote defs, def-lists, raw HTML
  type Block = { type:'single';idx:number }|{ type:'group';start:number;end:number;raw:string };
  const isRow    = (l:string) => /^\s*\|/.test(l)||/\|\s*$/.test(l);
  const isFootDef = (l:string) => /^\[\^[^\]]+\]:/.test(l.trim());
  const isDefDef  = (l:string) => /^:\s+.+/.test(l);
  const blocks: Block[] = []; let bi=0;
  while (bi<lines.length) {
    const line = lines[bi];

    // ── Fenced code block ````lang … ``` ──
    if (line.match(/^```\S*$/)) {
      const start=bi; bi++;
      while(bi<lines.length&&!lines[bi].match(/^```\s*$/)) bi++;
      const end=bi<lines.length?bi:bi-1;
      blocks.push({type:'group',start,end,raw:lines.slice(start,end+1).join('\n')}); bi++;

    // ── Tables: collect pipe rows, bridging up to 1 blank line between rows ──
    } else if (isRow(line)) {
      const start=bi; const rows:string[]=[];
      while(bi<lines.length) {
        if (isRow(lines[bi])) { rows.push(lines[bi]); bi++; }
        // Bridge a single blank line if the next non-blank line is also a row
        else if (lines[bi].trim()==='' && bi+1<lines.length && isRow(lines[bi+1])) { bi++; }
        else break;
      }
      const nonBlankRows = rows.filter(r=>r.trim()!=='');
      // A separator row only contains |, -, :, and spaces
      const hasSep=nonBlankRows.some(r=>/^[\|\-\:\s]+$/.test(r.trim()) && r.includes('-'));
      if(hasSep&&nonBlankRows.length>=2) blocks.push({type:'group',start,end:bi-1,raw:nonBlankRows.join('\n')});
      else rows.forEach((_,k)=>blocks.push({type:'single',idx:start+k}));

    // ── HTML blocks: <details>, <summary>, <div>, <table> … </tag> ──
    } else if (/^<(details|summary|div|figure|table|blockquote)\b/i.test(line)) {
      const tag = line.match(/^<(\w+)/i)![1].toLowerCase();
      const close = new RegExp(`^<\/${tag}\s*>`, 'i');
      const start=bi; bi++;
      while(bi<lines.length && !close.test(lines[bi])) bi++;
      const end=bi<lines.length?bi:bi-1;
      blocks.push({type:'group',start,end,raw:lines.slice(start,end+1).join('\n')}); bi++;

    // ── Footnote definitions (consecutive [^n]: lines) ──
    } else if (isFootDef(line)) {
      const start=bi; bi++;
      // continuation lines are indented by >=2 spaces
      while(bi<lines.length && (isFootDef(lines[bi]) || /^\s{2,}/.test(lines[bi]))) bi++;
      blocks.push({type:'group',start,end:bi-1,raw:lines.slice(start,bi).join('\n')});

    // ── Definition list: Term followed by one or more ": Def" lines ──
    } else if (bi+1<lines.length && isDefDef(lines[bi+1])) {
      const start=bi; bi++; // skip the term
      while(bi<lines.length && isDefDef(lines[bi])) bi++;
      blocks.push({type:'group',start,end:bi-1,raw:lines.slice(start,bi).join('\n')});

    // ── Display math block $$ … $$ ──
    } else if (line.trimStart() === '$$') {
      const start=bi; bi++;
      while(bi<lines.length && lines[bi].trimStart() !== '$$') bi++;
      const end=bi<lines.length?bi:bi-1;
      blocks.push({type:'group',start,end,raw:lines.slice(start,end+1).join('\n')}); bi++;

    } else { blocks.push({type:'single',idx:bi}); bi++; }
  }

  // Render a textarea for the active line — called as a function (NOT a component)
  // so React never unmounts/remounts the DOM node on re-render
  const renderTA = (idx: number) => (
    <textarea ref={taRef} value={lines[idx]} rows={1} spellCheck autoCorrect="on"
      className="w-full bg-transparent border-l-[3px] border-[var(--color-primary)] pl-3 -ml-4 outline-none resize-none overflow-hidden leading-relaxed font-mono text-[13.5px] text-[var(--color-on-surface)] caret-[var(--color-primary)] block"
      style={{ paddingTop:'2px', paddingBottom:'2px' }}
      onChange={handleChange} onKeyDown={handleKeyDown}
      onBlur={() => { if(!slashQuery&&!pickerTab){ setEditLine(null); setToolbarPos(null); } }}
    />
  );

  const linePrefix = editLine!==null ? lines[editLine] : '';
  const isH1 = linePrefix.startsWith('# '), isH2=linePrefix.startsWith('## '), isH3=linePrefix.startsWith('### ');
  const isQuote=linePrefix.startsWith('> '), isBullet=linePrefix.startsWith('- '), isNum=/^\d+\. /.test(linePrefix), isTask=linePrefix.startsWith('- [ ] ');

  return (
    <div className="w-full relative md-editor-root">

      {/* ── PREVIEW MODE: full document, interactive, no editing ── */}
      {previewOnly && (
        <div className="preview-block">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={mdComponents}>
            {preprocess(content)}
          </ReactMarkdown>
        </div>
      )}

      {/* ── EDIT MODE: floating toolbar + line-by-line editor ── */}
      {!previewOnly && (<>
        {/* Floating toolbar — appears above active line */}
        {editLine!==null && toolbarPos && (
          <div
            className="absolute z-30 flex flex-wrap items-center gap-0.5 px-1 py-1.5 bg-[var(--color-surface-pure)]/98 backdrop-blur-sm border border-[var(--color-surface-high)] rounded-xl shadow-xl"
            style={{ top: Math.max(0, toolbarPos.top), left: 0, right: 0 }}
            onMouseDown={e => e.preventDefault()}
          >
            <TB tip="Undo (Ctrl+Z)"  fn={()=>dispatch({type:'undo'})} icon={<Undo2 size={13}/>} active={hist.ptr>0} />
            <TB tip="Redo (Ctrl+Y)"  fn={()=>dispatch({type:'redo'})} icon={<Redo2 size={13}/>} active={hist.ptr<hist.snaps.length-1} />
            <TSep/>
            <TB tip="Bold"          fn={()=>wrapSel('**')}     icon={<Bold size={13}/>} />
            <TB tip="Italic"        fn={()=>wrapSel('*')}      icon={<Italic size={13}/>} />
            <TB tip="Strikethrough" fn={()=>wrapSel('~~')}     icon={<Strikethrough size={13}/>} />
            <TSep/>
            <TB tip="Heading 1" fn={()=>togglePfx('# ')}   icon={<Heading1 size={13}/>} active={isH1} />
            <TB tip="Heading 2" fn={()=>togglePfx('## ')}  icon={<Heading2 size={13}/>} active={isH2} />
            <TB tip="Heading 3" fn={()=>togglePfx('### ')} icon={<Heading3 size={13}/>} active={isH3} />
            <TSep/>
            <TB tip="Bullet list"   fn={()=>togglePfx('- ')}     icon={<List size={13}/>}        active={isBullet} />
            <TB tip="Numbered list" fn={()=>togglePfx('1. ')}    icon={<ListOrdered size={13}/>} active={isNum} />
            <TB tip="Task item"     fn={()=>togglePfx('- [ ] ')} icon={<CheckSquare size={13}/>} active={isTask} />
            <TSep/>
            <TB tip="Blockquote" fn={()=>togglePfx('> ')}              icon={<Quote size={13}/>}   active={isQuote} />
            <TB tip="Code block" fn={()=>insertTpl('```\n\n```')}       icon={<Code2 size={13}/>} />
            <TB tip="Table"      fn={()=>insertTpl(TABLE_TPL)}          icon={<Table2 size={13}/>} />
            <TB tip="Divider"    fn={()=>insertTpl('---')}              icon={<Minus size={13}/>} />
            <TSep/>
            <TB tip="Emoji / GIF" fn={()=>setPickerTab(p=>p?null:'emoji')} icon={<Smile size={13}/>} active={!!pickerTab} />
            <TB tip="Upload image" fn={()=>setPickerTab(p=>p?null:'upload')} icon={<ImageIcon size={13}/>} />
          </div>
        )}

        {/* Content blocks */}
        <div style={{ paddingTop: editLine!==null && toolbarPos ? 52 : 0 }}>
          {blocks.map((block, bk) => {
            if (block.type==='group') {
              const editing=editLine!==null&&editLine>=block.start&&editLine<=block.end;
              if (editing) return (
                <div key={bk} className="my-2 rounded-xl border-2 border-[var(--color-primary)]/30 overflow-hidden">
                  {Array.from({length:block.end-block.start+1},(_,k)=>block.start+k).map(idx=>
                    editLine===idx
                      ? renderTA(idx)
                      : <div key={idx} className="font-mono text-[12.5px] text-[var(--color-outline)] px-3 py-0.5 cursor-text hover:bg-[var(--color-surface-low)]" onClick={()=>openLine(idx)}>{lines[idx]||' '}</div>
                  )}
                </div>
              );
              return <div key={bk} className="preview-block cursor-text" onClick={()=>openLine(block.start)}><ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={mdComponents}>{preprocess(block.raw)}</ReactMarkdown></div>;
            }
            const {idx}=block;
            return <div key={bk} className="group relative">{editLine===idx ? renderTA(idx) : <PreviewLine line={lines[idx]} idx={idx} onOpen={openLine} placeholder={idx===0?placeholder:undefined}/>}</div>;
          })}
        </div>

        <div className="h-16 cursor-text" onClick={()=>openLine(lines.length-1)}/>

        {/* Slash command menu */}
        {slashQuery!==null && taRef.current && (
          <SlashMenu query={slashQuery} onSelect={execSlash} onClose={()=>setSlashQuery(null)} anchorEl={taRef.current}/>
        )}

        {/* Emoji / upload picker */}
        {pickerTab && taRef.current && (
          <EditorPicker
            anchorEl={taRef.current}
            defaultTab={pickerTab}
            onEmoji={e=>{ insertText(e); setPickerTab(null); }}
            onImageUrl={(url,alt)=>{ insertText(`![${alt??'image'}](${url})`); setPickerTab(null); }}
            onClose={()=>setPickerTab(null)}
          />
        )}
      </>)}

      <style>{`
        .preview-line > * { margin: 0 !important; }
        .preview-line p,.preview-block p{margin:.35rem 0;color:var(--color-on-surface);font-size:14px;line-height:1.75;}
        .preview-line h1,.preview-block h1{font-size:1.65rem;font-weight:800;margin:.5rem 0 .2rem;line-height:1.2;color:var(--color-on-surface);}
        .preview-line h2,.preview-block h2{font-size:1.3rem;font-weight:700;margin:.4rem 0 .15rem;color:var(--color-on-surface);}
        .preview-line h3,.preview-block h3{font-size:1.1rem;font-weight:600;margin:.3rem 0 .1rem;color:var(--color-on-surface);}
        .preview-line h4,.preview-block h4{font-size:.95rem;font-weight:600;color:var(--color-on-surface);}
        .preview-line h5,.preview-line h6,.preview-block h5,.preview-block h6{font-size:.875rem;font-weight:600;color:var(--color-on-surface-var);}
        .preview-line a,.preview-block a{color:var(--color-primary);text-decoration:underline;text-underline-offset:2px;}
        .preview-line strong,.preview-block strong{font-weight:700;}
        .preview-line em,.preview-block em{font-style:italic;}
        .preview-line del,.preview-block del{text-decoration:line-through;opacity:.65;}
        /* Highlight ==text== */
        .preview-line mark,.preview-block mark{background:#fef08a;border-radius:3px;padding:0 .2rem;color:#1a1a1a;}
        [data-theme=dark] .preview-line mark,[data-theme=dark] .preview-block mark{background:#713f12;color:#fef3c7;}
        /* Inline code */
        /* Inline code — light blue pill, clearly distinct from block code */
        .md-inline-code{display:inline;background:#dbeafe;border:1px solid #bfdbfe;padding:.05rem .38rem;border-radius:5px;font-size:.8em;font-family:ui-monospace,SFMono-Regular,monospace;color:#1e40af;font-weight:500;letter-spacing:.01em;vertical-align:baseline;}
        [data-theme=dark] .md-inline-code{background:#1e3a5f;border-color:#1d4ed8;color:#93c5fd;}
        /* ── Code block outer shell ── uses same border language as tables */
        .md-code-block{margin:.75rem 0;border-radius:10px;overflow:hidden;border:1px solid var(--color-surface-high);background:transparent;}

        /* ── Matte-gray top bar ── */
        .md-code-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 12px;height:36px;background:#3a3a3c;border-bottom:1px solid rgba(0,0,0,.25);flex-shrink:0;}

        /* Language label (left) */
        .md-code-lang{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.55);font-family:ui-monospace,monospace;user-select:none;}

        /* iOS dots (right) — always colored */
        .md-code-dots{display:flex;flex-direction:row;gap:6px;align-items:center;}
        .md-code-dots span{width:12px;height:12px;border-radius:50%;cursor:default;flex-shrink:0;}
        .md-code-dots span:nth-child(1){background:#ff5f57;}
        .md-code-dots span:nth-child(2){background:#febc2e;}
        .md-code-dots span:nth-child(3){background:#28c840;}
        .md-code-dots span:hover{filter:brightness(1.15);}

        /* ── Transparent code body ── */
        .md-code-body{position:relative;background:transparent;overflow-x:auto;}
        [data-theme=dark] .md-code-body{background:transparent;}

        /* Copy button — always visible, not hidden until hover */
        .md-code-copy{position:absolute;top:8px;right:10px;z-index:10;display:flex;align-items:center;gap:3px;font-size:9.5px;font-weight:600;padding:.25rem .6rem;border-radius:7px;border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.5);background:rgba(255,255,255,.07);cursor:pointer;transition:all .15s ease;font-family:ui-monospace,monospace;letter-spacing:.03em;white-space:nowrap;user-select:none;backdrop-filter:blur(4px);}
        .md-code-copy:hover{color:#fff;border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.16);}
        .md-code-copy svg{flex-shrink:0;}

        /* details/summary — interactive collapsible in preview */
        .preview-block details{margin:.5rem 0;border:1px solid var(--color-surface-high);border-radius:8px;padding:.4rem .75rem;background:color-mix(in srgb,var(--color-surface-low) 50%,transparent);}
        .preview-block summary{font-weight:600;cursor:pointer;padding:.2rem 0;color:var(--color-on-surface);list-style:none;display:flex;align-items:center;gap:.5rem;}
        .preview-block summary::before{content:'▶';font-size:.7em;transition:transform .2s;flex-shrink:0;}
        .preview-block details[open] summary::before{transform:rotate(90deg);}
        .preview-block summary::-webkit-details-marker{display:none;}
        /* Footnotes — need rehype-raw for full link back */
        .md-code-body [class*=language-],.md-code-body pre{background:transparent!important;margin:0!important;padding:0!important;}

        /* Mermaid diagram wrapper */
        .md-mermaid-wrap{margin:.75rem 0;padding:.875rem 1rem;border-radius:16px;border:1px solid var(--color-surface-high);background:color-mix(in srgb,var(--color-surface-low) 60%,transparent);overflow-x:auto;}
        .md-mermaid-wrap svg{max-width:100%;height:auto;display:block;margin:0 auto;}
        .md-mermaid-loading{display:flex;align-items:center;gap:.5rem;color:var(--color-outline);font-size:12px;}
        .md-mermaid-error{color:var(--color-error);font-size:12px;padding:.5rem;background:color-mix(in srgb,var(--color-error) 8%,transparent);border-radius:8px;}

        /* Scrollable table */
        .md-table-wrap{overflow-x:auto;margin:.5rem 0;border-radius:10px;border:1px solid var(--color-surface-high);}
        .md-table-wrap table{width:100%;border-collapse:collapse;font-size:13px;min-width:400px;}
        .md-table-wrap th,.md-table-wrap td{padding:.45rem .875rem;border:1px solid var(--color-surface-high);text-align:left;vertical-align:top;color:var(--color-on-surface);}
        .md-table-wrap th{background:color-mix(in srgb,var(--color-primary) 8%,transparent);font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--color-primary);border-bottom:2px solid color-mix(in srgb,var(--color-primary) 20%,transparent);}
        .md-table-wrap tr:nth-child(even) td{background:color-mix(in srgb,var(--color-surface-low) 40%,transparent);}
        .md-table-wrap tr:hover td{background:color-mix(in srgb,var(--color-primary) 5%,transparent);}
        /* Images */
        .md-img{max-width:100%;border-radius:10px;margin:.5rem 0;display:block;}
        /* Lists — reset color so nested items are NOT blue */
        .preview-line ul,.preview-block ul{list-style:disc;padding-left:1.5rem;margin:.25rem 0;}
        .preview-line ol,.preview-block ol{list-style:decimal;padding-left:1.5rem;margin:.25rem 0;}
        .preview-line li,.preview-block li{margin:.1rem 0;font-size:14px;color:var(--color-on-surface) !important;}
        .preview-line li *,.preview-block li *{color:inherit;}
        .preview-line ul ul,.preview-block ul ul{list-style:circle;margin:0;}
        .preview-line ul ul ul,.preview-block ul ul ul{list-style:square;}
        .preview-line blockquote,.preview-block blockquote{border-left:3px solid var(--color-primary);padding:.15rem 0 .15rem .875rem;margin:.3rem 0;color:var(--color-on-surface-var);font-style:italic;}
        .preview-line hr,.preview-block hr{border:none;border-top:1px solid var(--color-surface-high);margin:.75rem 0;}
        /* Footnotes */
        .preview-block .footnotes{border-top:1px solid var(--color-surface-high);margin-top:1.5rem;padding-top:.75rem;font-size:12px;color:var(--color-on-surface-var);}
        .preview-block .footnotes ol{padding-left:1.25rem;}
        .preview-block sup a{color:var(--color-primary);font-size:.75em;vertical-align:super;text-decoration:none;}
        /* Definition lists */
        .preview-line dl,.preview-block dl{margin:.5rem 0;}
        .preview-line dt,.preview-block dt{font-weight:700;color:var(--color-on-surface);font-size:14px;margin-top:.5rem;}
        .preview-line dd,.preview-block dd{margin-left:1.5rem;color:var(--color-on-surface-var);font-size:13.5px;margin-top:.1rem;}
        /* KaTeX */
        .preview-block .math-display{overflow-x:auto;margin:.5rem 0;padding:.5rem;}
        .preview-line .math-inline,.preview-block .math-inline{display:inline;}
        /* Task list — interactive in preview */
        .preview-block ul:has(li input[type=checkbox]){list-style:none;padding-left:.25rem;}
        .preview-block li:has(input[type=checkbox]){display:flex;align-items:baseline;gap:.45rem;padding:.25rem .6rem;border-radius:7px;transition:background .15s,opacity .15s;cursor:pointer;}
        .preview-block li:has(> input[type=checkbox]:not(:checked)),.preview-block li:has(> p > input[type=checkbox]:not(:checked)){background:rgba(76,153,230,.13);}
        .preview-block li:has(> input[type=checkbox]:checked),.preview-block li:has(> p > input[type=checkbox]:checked){background:rgba(128,128,128,.09);opacity:.65;}
        .preview-block li:has(> input[type=checkbox]:checked)>*:not(input),.preview-block li:has(> p > input[type=checkbox]:checked)>p{text-decoration:line-through;text-decoration-color:rgba(128,128,128,.6);}
        [data-theme=dark] .preview-block li:has(input[type=checkbox]:not(:checked)){background:rgba(99,179,237,.1);}
        [data-theme=dark] .preview-block li:has(input[type=checkbox]:checked){background:rgba(255,255,255,.04);}
        .preview-block input[type=checkbox]{width:15px;height:15px;flex-shrink:0;margin-top:.15rem;accent-color:var(--color-primary);cursor:pointer;appearance:auto;-webkit-appearance:auto;}
        .preview-block li:has(input[type=checkbox]) p{margin:0;display:inline;}
        .preview-line input[type=checkbox]{accent-color:var(--color-primary);margin-right:.4rem;}
        [data-placeholder]:empty::after{content:attr(data-placeholder);color:var(--color-outline);opacity:.55;font-style:italic;pointer-events:none;}
      `}</style>
    </div>
  );
}

const mdComponents = {
  // Links: external open in tab; #anchors scroll smoothly within the document
  a: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement>&{children?:React.ReactNode}) => {
    if (/^https?:\/\//i.test(href??''))
      return <a href={href} target="_blank" rel="noopener noreferrer" {...p}>{children}</a>;
    if (href?.startsWith('#')) {
      const onClick = (e: React.MouseEvent) => {
        e.preventDefault();
        const el = document.getElementById(decodeURIComponent(href.slice(1)));
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      return <a href={href} onClick={onClick} {...p}>{children}</a>;
    }
    return <a href="#" onClick={e=>e.preventDefault()} {...p}>{children}</a>;
  },
  // Headings: IDs are auto-generated by rehype-slug for TOC anchor scrolling
  img: ({ src, alt, ...p }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={src} alt={alt??'image'} className="md-img" loading="lazy"
      onError={e => { (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23e2e3dc'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='14' fill='%237a7b75' text-anchor='middle' dominant-baseline='middle'%3E${encodeURIComponent(alt??'image')}%3C/text%3E%3C/svg%3E`; }}
      {...p}/>
  ),
  // Interactive checkbox — uses uncontrolled DOM so CSS :has(:checked) works
  input: ({ type, checked }: React.InputHTMLAttributes<HTMLInputElement>) => {
    const ref = useRef<HTMLInputElement>(null);
    if (type !== 'checkbox') return null;
    return (
      <input
        ref={ref}
        type="checkbox"
        defaultChecked={!!checked}
        onClick={e => e.stopPropagation()}
        onChange={() => {/* uncontrolled – DOM updates directly */}}
        style={{ cursor: 'pointer' }}
      />
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: CodeBlock as never,
  table: TableBlock as never,
};
