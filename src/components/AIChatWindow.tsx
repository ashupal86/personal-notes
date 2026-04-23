'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Summarize my workspace',
  'How many open tasks?',
  'What was my last note?',
];

export default function AIChatWindow() {
  const [messages,  setMessages]  = useState<Message[]>([{
    id: 'init',
    role: 'assistant',
    content: 'Hi! I\'m your workspace assistant. Ask me about your notes, tasks, or anything in your archive.',
  }]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!collapsed) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, collapsed]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'init')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, history }),
      });
      const json = await res.json();
      const reply = json.reply ?? 'Sorry, I couldn\'t process that.';
      setMessages(prev => [...prev, { id: Date.now().toString() + 'a', role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl"
      style={{ background: 'rgba(10,10,30,0.55)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-violet-500 flex items-center justify-center">
            <Bot size={13} className="text-white" />
          </div>
          <span className="text-[12.5px] font-semibold text-white/90">Archive Assistant</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-bold uppercase tracking-wider">AI</span>
        </div>
        {collapsed
          ? <ChevronDown size={14} className="text-white/40" />
          : <ChevronUp   size={14} className="text-white/40" />
        }
      </button>

      {!collapsed && (
        <>
          {/* Messages */}
          <div className="px-4 py-3 space-y-3 max-h-[220px] overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={11} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[var(--color-primary)] text-white rounded-tr-sm ml-auto'
                    : 'bg-white/10 text-white/90 rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-violet-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={11} className="text-white" />
                </div>
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin text-white/60" />
                  <span className="text-[11px] text-white/50">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions (only when 1 message) */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[10.5px] px-2.5 py-1 rounded-full border border-white/15 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-2 border border-white/10 focus-within:border-[var(--color-primary)]/40 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about your notes or tasks…"
                disabled={loading}
                className="flex-1 bg-transparent text-[12.5px] text-white/90 placeholder:text-white/30 outline-none"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-30 transition-all flex-shrink-0"
              >
                <Send size={12} className="text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
