'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = ['Summarize my workspace', 'How many open tasks?', 'What was my last note?'];

export default function InlineChat() {
  const [messages,  setMessages]  = useState<Message[]>([{
    id: 'init', role: 'assistant',
    content: 'Hi! Ask me about your notes, tasks, or anything in your archive.',
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.filter(m => m.id !== 'init').map(m => ({ role: m.role, content: m.content }));
      const res  = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message: msg, history }) });
      const json = await res.json();
      setMessages(prev => [...prev, { id: Date.now() + 'a', role: 'assistant', content: json.reply ?? 'Sorry, something went wrong.' }]);
    } catch {
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden flex flex-col"
      style={{ background: 'rgba(10,10,30,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-violet-500 flex items-center justify-center">
          <Bot size={11} className="text-white" />
        </div>
        <span className="text-[11.5px] font-semibold text-white/80">Archive Assistant</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-bold uppercase tracking-wider ml-1">AI</span>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 space-y-3 max-h-[200px] overflow-y-auto">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={10} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-[12px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-[var(--color-primary)] text-white rounded-tr-sm'
                : 'bg-white/10 text-white/85 rounded-tl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-violet-500 flex items-center justify-center">
              <Bot size={10} className="text-white" />
            </div>
            <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3 py-1.5 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-white/50" />
              <span className="text-[11px] text-white/40">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips — only until first user message */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-[10.5px] px-2.5 py-0.5 rounded-full border border-white/15 text-white/55 hover:bg-white/10 hover:text-white/90 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/10 focus-within:border-[var(--color-primary)]/40 transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about your notes or tasks…"
            disabled={loading}
            className="flex-1 bg-transparent text-[12.5px] text-white/90 placeholder:text-white/30 outline-none"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-6 h-6 rounded-lg flex items-center justify-center bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-30 transition-all flex-shrink-0">
            <Send size={11} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
