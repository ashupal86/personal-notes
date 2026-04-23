import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { db } from '@/lib/supabase/server';

const SYSTEM_PROMPT = `You are an intelligent assistant embedded inside "The Quiet Archive", a personal knowledge workspace. You help users find, summarize, and reason over their notes, tasks, and calendar events.

Rules:
- Be concise and helpful. Max 3 sentences unless the user asks for more.
- If you reference a note or task, mention its title.
- If asked something you cannot answer from context, say so honestly.
- Tone: calm, thoughtful, slightly minimal. No excessive enthusiasm.`;

/** POST /api/chat */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { message, history = [] } = body as {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!message?.trim()) {
    return Response.json({ success: false, error: 'Message is required.' }, { status: 400 });
  }

  // Gather context: recent notes + open tasks
  const [notesRes, tasksRes] = await Promise.allSettled([
    db.from('notes').select('title, content_md').is('deleted_at', null)
      .eq('created_by', auth.userId).order('updated_at', { ascending: false }).limit(8),
    db.from('tasks').select('title, status, priority').is('deleted_at', null)
      .neq('status', 'done').limit(6),
  ]);

  const notes = notesRes.status === 'fulfilled' ? (notesRes.value.data ?? []) : [];
  const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data ?? []) : [];

  const notesSummary = notes.length
    ? notes.map((n: any) => `• ${n.title}: ${(n.content_md ?? '').slice(0, 120).replace(/[#*`]/g, '')}…`).join('\n')
    : 'No recent notes.';
  const tasksSummary = tasks.length
    ? tasks.map((t: any) => `• [${t.status}/${t.priority}] ${t.title}`).join('\n')
    : 'No open tasks.';

  const contextBlock = `User context:\nRECENT NOTES:\n${notesSummary}\n\nOPEN TASKS:\n${tasksSummary}`;

  // Try Google Gemini if key is available, otherwise use a smart fallback
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const messages = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + contextBlock }] },
        { role: 'model', parts: [{ text: 'Understood. I have your context. How can I help?' }] },
        ...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: messages, generationConfig: { maxOutputTokens: 256, temperature: 0.7 } }),
        }
      );
      const json = await res.json();
      const reply = json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I could not generate a response.';
      return Response.json({ success: true, reply });
    } catch {
      // fall through to smart fallback
    }
  }

  // ── Smart keyword fallback (no external API needed) ──────────────
  const q = message.toLowerCase();
  let reply = '';

  if (q.includes('note') && (q.includes('how many') || q.includes('count'))) {
    reply = `You have ${notes.length} recent notes in your archive.`;
  } else if (q.includes('task') && (q.includes('how many') || q.includes('open') || q.includes('pending'))) {
    reply = `You have ${tasks.length} open task${tasks.length !== 1 ? 's' : ''}${tasks.length ? ': ' + tasks.map((t: any) => t.title).join(', ') + '.' : '.'}`;
  } else if (q.includes('note') && (q.includes('recent') || q.includes('last') || q.includes('latest'))) {
    reply = notes.length
      ? `Your most recent note is "${notes[0].title}".`
      : 'You have no notes yet.';
  } else if (q.includes('summarize') || q.includes('summary')) {
    const noteTitles = notes.slice(0, 3).map((n: any) => `"${n.title}"`).join(', ');
    reply = `Here's a quick overview: ${notes.length} notes (recent: ${noteTitles || 'none'}), ${tasks.length} open tasks.`;
  } else if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    reply = 'Hello! I can help you find notes, check tasks, or summarize your workspace. What do you need?';
  } else if (q.includes('help') || q.includes('what can you do')) {
    reply = 'I can answer questions about your notes and tasks — try "summarize my notes", "how many open tasks do I have?", or "what was my last note about?".';
  } else {
    // Semantic note search: look for any note title mentioned
    const match = notes.find((n: any) => q.includes(n.title?.toLowerCase()));
    if (match) {
      const preview = (match as any).content_md?.replace(/[#*`>]/g, '').trim().slice(0, 200);
      reply = `Found "${(match as any).title}": ${preview || 'No content yet.'}`;
    } else {
      reply = `I searched your ${notes.length} notes and ${tasks.length} tasks but couldn't find a direct match. Try rephrasing or ask me to summarize your workspace.`;
    }
  }

  return Response.json({ success: true, reply });
}
