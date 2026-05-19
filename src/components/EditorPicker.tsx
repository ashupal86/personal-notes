'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Smile, Image, Film, X, Upload, Loader2, GripHorizontal } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const TENOR_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? '';
type Tab = 'emoji' | 'gif' | 'upload';

interface Props {
  anchorEl: HTMLTextAreaElement | null;
  defaultTab?: Tab;
  onEmoji: (emoji: string) => void;
  onImageUrl: (url: string, alt?: string) => void;
  onClose: () => void;
}

export default function EditorPicker({ anchorEl, defaultTab = 'emoji', onEmoji, onImageUrl, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string; title: string }[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Drag state
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Initial position above anchor
  useEffect(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const h = 400; const w = 360;
    const top = Math.max(8, r.top - h - 8);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setPos({ top, left });
  }, [anchorEl]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.left, py: pos.top };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 360, dragStart.current.px + dx));
      const newTop  = Math.max(0, Math.min(window.innerHeight - 400, dragStart.current.py + dy));
      setPos({ left: newLeft, top: newTop });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos]);

  // Close on outside click (skip if dragging)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dragging.current) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  // GIF search
  useEffect(() => {
    if (tab !== 'gif' || !TENOR_KEY) return;
    const t = setTimeout(async () => {
      setGifsLoading(true);
      try {
        const q = gifQuery || 'trending';
        const endpoint = gifQuery
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=12&media_filter=gif`
          : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=12&media_filter=gif`;
        const res = await fetch(endpoint);
        const json = await res.json();
        setGifs((json.results ?? []).map((r: { id: string; title: string; media_formats: { gif: { url: string }; tinygif: { url: string } } }) => ({
          id: r.id, title: r.title,
          url: r.media_formats.gif.url,
          preview: r.media_formats.tinygif.url,
        })));
      } catch { setGifs([]); }
      finally { setGifsLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [gifQuery, tab]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      onImageUrl(url, file.name.replace(/\.[^.]+$/, ''));
      onClose();
    } catch {
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') { onImageUrl(reader.result, file.name); onClose(); } };
      reader.readAsDataURL(file);
    } finally { setUploading(false); }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'emoji',  label: 'Emoji',  icon: <Smile size={13}/> },
    { id: 'gif',    label: 'GIF',    icon: <Film  size={13}/> },
    { id: 'upload', label: 'Upload', icon: <Image size={13}/> },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[300] bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-2xl shadow-2xl overflow-hidden select-none"
      style={{ top: pos.top, left: pos.left, width: 360, height: 400 }}
    >
      {/* Drag handle header */}
      <div
        className="flex items-center border-b border-[var(--color-surface-high)] cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        {/* Tabs */}
        <div className="flex flex-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onMouseDown={e => e.stopPropagation()} // don't trigger drag on tab click
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-colors ${tab === t.id ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-px' : 'text-[var(--color-outline)] hover:text-[var(--color-on-surface)]'}`}
            >{t.icon}{t.label}</button>
          ))}
        </div>
        {/* Drag grip indicator */}
        <GripHorizontal size={13} className="text-[var(--color-outline)] opacity-40 mx-2 flex-shrink-0" />
        {/* Close */}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          className="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] mr-1"
        >
          <X size={13}/>
        </button>
      </div>

      {/* Emoji tab */}
      {tab === 'emoji' && (
        <div className="overflow-hidden" style={{ height: 'calc(100% - 44px)' }}>
          <Picker
            data={data}
            onEmojiSelect={(e: { native: string }) => { onEmoji(e.native); onClose(); }}
            theme="auto" previewPosition="none" skinTonePosition="none"
            navPosition="bottom" perLine={9} emojiSize={22} emojiButtonSize={32}
          />
        </div>
      )}

      {/* GIF tab */}
      {tab === 'gif' && (
        <div className="flex flex-col" style={{ height: 'calc(100% - 44px)' }}>
          <div className="px-3 py-2">
            <input autoFocus value={gifQuery} onChange={e => setGifQuery(e.target.value)}
              placeholder={TENOR_KEY ? 'Search GIFs…' : 'Add NEXT_PUBLIC_TENOR_API_KEY to .env.local'}
              className="w-full text-[13px] bg-[var(--color-surface-low)] border border-[var(--color-surface-high)] rounded-lg px-3 py-1.5 outline-none focus:border-[var(--color-primary)] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]"
            />
          </div>
          {!TENOR_KEY ? (
            <div className="flex-1 flex items-center justify-center text-center px-4">
              <p className="text-[12px] text-[var(--color-outline)]">GIF support requires a <strong>Tenor API key</strong>.<br/>Add <code className="bg-[var(--color-surface-low)] px-1 rounded">NEXT_PUBLIC_TENOR_API_KEY</code> to <code>.env.local</code>.</p>
            </div>
          ) : gifsLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[var(--color-outline)]"/></div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {gifs.map(g => (
                <button key={g.id} onClick={() => { onImageUrl(g.url, g.title); onClose(); }}
                  className="aspect-square rounded-lg overflow-hidden hover:ring-2 ring-[var(--color-primary)] transition-all">
                  <img src={g.preview} alt={g.title} className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div className="flex flex-col items-center justify-center gap-4 p-6" style={{ height: 'calc(100% - 44px)' }}>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-[var(--color-surface-high)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all group">
            {uploading
              ? <Loader2 size={28} className="animate-spin text-[var(--color-primary)]"/>
              : <Upload size={28} className="text-[var(--color-outline)] group-hover:text-[var(--color-primary)] transition-colors"/>}
            <div className="text-center">
              <p className="text-[13px] font-medium text-[var(--color-on-surface)]">{uploading ? 'Uploading…' : 'Click to upload'}</p>
              <p className="text-[11px] text-[var(--color-outline)] mt-0.5">PNG, JPG, GIF, WebP · Max 10MB</p>
            </div>
          </button>
          <p className="text-[10px] text-[var(--color-outline)] text-center">Images are stored securely and accessible only to you.</p>
        </div>
      )}
    </div>
  );
}
