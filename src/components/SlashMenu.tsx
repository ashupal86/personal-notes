'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code2, Table2, Minus, Bold, Italic, Strikethrough,
  Image, Smile, Link2, Calendar, GitBranch, Sigma, BookOpen,
} from 'lucide-react';


export type SlashCmd = {
  id: string; cat: string; label: string; desc: string;
  icon: React.ReactNode; hint?: string;
  action: 'prefix' | 'wrap' | 'template' | 'special';
  payload: string;
};

export const SLASH_COMMANDS: SlashCmd[] = [
  // Text
  { id:'h1',     cat:'Text',   label:'Heading 1',     desc:'Large section heading',  icon:<Heading1    size={15}/>, action:'prefix',   payload:'# ',        hint:'#' },
  { id:'h2',     cat:'Text',   label:'Heading 2',     desc:'Medium heading',          icon:<Heading2    size={15}/>, action:'prefix',   payload:'## ',       hint:'##' },
  { id:'h3',     cat:'Text',   label:'Heading 3',     desc:'Small heading',           icon:<Heading3    size={15}/>, action:'prefix',   payload:'### ',      hint:'###' },
  { id:'bold',   cat:'Text',   label:'Bold',          desc:'Bold the selected text',  icon:<Bold        size={15}/>, action:'wrap',     payload:'**' },
  { id:'italic', cat:'Text',   label:'Italic',        desc:'Italicize text',          icon:<Italic      size={15}/>, action:'wrap',     payload:'*' },
  { id:'strike', cat:'Text',   label:'Strikethrough', desc:'Strike through text',     icon:<Strikethrough size={15}/>, action:'wrap', payload:'~~' },
  // Lists
  { id:'bullet', cat:'List',   label:'Bullet List',   desc:'Unordered list',          icon:<List        size={15}/>, action:'prefix',   payload:'- ',        hint:'-' },
  { id:'numbered',cat:'List',  label:'Numbered List', desc:'Ordered list',            icon:<ListOrdered size={15}/>, action:'prefix',  payload:'1. ',       hint:'1.' },
  { id:'todo',   cat:'List',   label:'To-do',         desc:'Checkbox task item',      icon:<CheckSquare size={15}/>, action:'prefix',  payload:'- [ ] ',   hint:'[]' },
  // Blocks
  { id:'quote',  cat:'Block',  label:'Quote',         desc:'Highlighted quote block', icon:<Quote       size={15}/>, action:'prefix',   payload:'> ',        hint:'>' },
  { id:'code',   cat:'Block',  label:'Code Block',    desc:'Monospace code fence',    icon:<Code2       size={15}/>, action:'template', payload:'```\n\n```',hint:'```' },
  { id:'table',  cat:'Block',  label:'Table',         desc:'3-column data table',     icon:<Table2      size={15}/>, action:'template', payload:'| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |' },
  { id:'divider',cat:'Block',  label:'Divider',       desc:'Horizontal rule',         icon:<Minus       size={15}/>, action:'template', payload:'---',       hint:'---' },
  // Media
  { id:'image',  cat:'Media',  label:'Upload Image',  desc:'Insert image from device',icon:<Image       size={15}/>, action:'special',  payload:'image' },
  { id:'emoji',  cat:'Media',  label:'Emoji',         desc:'Pick an emoji',           icon:<Smile       size={15}/>, action:'special',  payload:'emoji' },
  { id:'link',   cat:'Media',  label:'Link',          desc:'Insert hyperlink',        icon:<Link2       size={15}/>, action:'template', payload:'[label](https://)' },
  { id:'date',   cat:'Utility',label:'Today\'s Date', desc:'Insert current date',     icon:<Calendar    size={15}/>, action:'special',  payload:'date' },
  // Advanced
  { id:'mermaid',cat:'Advanced',label:'Mermaid Diagram',desc:'Flowchart / sequence / pie chart', icon:<GitBranch size={15}/>, action:'template', payload:'```mermaid\ngraph LR\n  A --> B\n```' },
  { id:'math',   cat:'Advanced',label:'Math Block',   desc:'LaTeX equation ($$)',       icon:<Sigma       size={15}/>, action:'template', payload:'$$\n\n$$' },
  { id:'mathInline',cat:'Advanced',label:'Inline Math',desc:'LaTeX inline ($)',          icon:<Sigma       size={15}/>, action:'wrap',     payload:'$' },
  { id:'deflist',cat:'Advanced',label:'Definition List',desc:'Term + definition',       icon:<BookOpen    size={15}/>, action:'template', payload:'Term\n: Definition here' },
];

interface Props {
  query: string;           // text after `/`
  onSelect: (cmd: SlashCmd) => void;
  onClose: () => void;
  anchorEl: HTMLTextAreaElement | null;
}

export default function SlashMenu({ query, onSelect, onClose, anchorEl }: Props) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase()) || c.cat.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when filter changes
  useEffect(() => { setIdx(0); }, [query]);

  // Position above anchor textarea
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  useEffect(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const menuH = Math.min(filtered.length * 48 + 32, 320);
    setPos({ top: r.top - menuH - 8, left: r.left, width: Math.max(300, r.width) });
  }, [anchorEl, filtered.length]);

  // Keyboard navigation
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setIdx(i => (i + 1) % filtered.length); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setIdx(i => (i - 1 + filtered.length) % filtered.length); }
      if (e.key === 'Enter')      { e.preventDefault(); e.stopPropagation(); if (filtered[idx]) onSelect(filtered[idx]); }
      if (e.key === 'Escape')     { onClose(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [filtered, idx, onSelect, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = ref.current?.querySelector('[data-active="true"]') as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!filtered.length) { onClose(); return null; }

  const cats = [...new Set(filtered.map(c => c.cat))];

  return (
    <div
      className="fixed z-[200] bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-xl shadow-2xl overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 320 }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-surface-high)] flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">Commands</span>
        {query && <span className="text-[11px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-0.5 rounded font-mono">/{query}</span>}
        <span className="ml-auto text-[9px] text-[var(--color-outline)] opacity-60">↑↓ navigate · ↵ select · Esc close</span>
      </div>

      <div ref={ref} className="overflow-y-auto" style={{ maxHeight: 274 }}>
        {cats.map(cat => (
          <div key={cat}>
            <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--color-outline)] opacity-60">{cat}</p>
            {filtered.filter(c => c.cat === cat).map(cmd => {
              const globalIdx = filtered.indexOf(cmd);
              const active = globalIdx === idx;
              return (
                <button
                  key={cmd.id}
                  data-active={active}
                  onClick={() => onSelect(cmd)}
                  onMouseEnter={() => setIdx(globalIdx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface-low)]'}`}
                >
                  <span className={`flex-shrink-0 ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-outline)]'}`}>{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium leading-none ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface)]'}`}>{cmd.label}</p>
                    <p className="text-[11px] text-[var(--color-outline)] mt-0.5">{cmd.desc}</p>
                  </div>
                  {cmd.hint && <span className="text-[10px] font-mono bg-[var(--color-surface-low)] px-1.5 py-0.5 rounded text-[var(--color-outline)] flex-shrink-0">{cmd.hint}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
