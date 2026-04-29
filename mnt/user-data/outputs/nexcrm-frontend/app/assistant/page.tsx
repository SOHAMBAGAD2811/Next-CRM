'use client';

import { useState, useRef, useEffect } from 'react';
import { assistantApi } from '@/lib/api';

interface Message {
  role:    'user' | 'assistant';
  content: string;
  ts:      string;
}

const QUICK_QUERIES = [
  "Summarize my top 5 leads and their status",
  "Which accounts are at churn risk this month?",
  "What should I prioritize today to hit my monthly quota?",
  "How is my pipeline performing? Any bottlenecks?",
  "Draft a re-engagement email for a dormant lead",
  "Which leads haven't been contacted in over 7 days?",
  "What's the total pipeline value in the Proposal stage?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI sales assistant with live access to your CRM data.\n\nI can help you:\n• Summarize lead status and interactions\n• Identify at-risk accounts\n• Prioritize your daily outreach\n• Draft re-engagement messages\n• Analyse pipeline health\n\nTry one of the quick queries on the right, or ask me anything.",
      ts: new Date().toISOString(),
    }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(query?: string) {
    const text = (query ?? input).trim();
    if (!text || loading) return;

    setInput('');
    const userMsg: Message = { role: 'user', content: text, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const { reply } = await assistantApi.chat(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ Could not reach the AI backend: ${e.message}\n\nMake sure Flask is running and OPENAI_API_KEY or Ollama is configured in your .env`,
        ts: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">✦ AI Assistant</div>
        <div className="topbar-right">
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--black)', color: 'var(--accent)', padding: '4px 10px', fontWeight: 700, letterSpacing: 1 }}>
            POWERED BY GEMINI
          </span>
        </div>
      </div>

      <div className="page" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, height: 'calc(100vh - 88px)' }}>

        {/* Chat */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: '#ece9e2', borderBottom: 'var(--border)' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : ''}`}>
                <div className={`msg-avatar ${msg.role === 'user' ? 'msg-user-av' : 'msg-ai-av'}`}>
                  {msg.role === 'user' ? 'AS' : '✦'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '80%' }}>
                  <div className={`msg-bubble ${msg.role === 'user' ? 'msg-user-bubble' : 'msg-ai-bubble'}`}
                    style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--gray4)', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {formatTime(msg.ts)}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-msg">
                <div className="msg-avatar msg-ai-av">✦</div>
                <div className="msg-bubble msg-ai-bubble">
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(n => (
                      <div key={n} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--gray4)',
                        animation: 'bounce 1s infinite', animationDelay: `${n * 0.15}s`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              rows={2}
              placeholder="Ask about your pipeline, leads, or customers... (Enter to send)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              style={{ resize: 'none' }}
            />
            <button className="chat-send" onClick={() => send()} disabled={loading || !input.trim()}>
              SEND →
            </button>
          </div>
        </div>

        {/* Sidebar — quick queries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Quick Queries</div></div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_QUERIES.map((q, i) => (
                <button
                  key={i}
                  className="btn btn-sm"
                  style={{ textAlign: 'left', fontSize: 12, fontWeight: 400, lineHeight: 1.4, padding: '8px 12px' }}
                  onClick={() => send(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Context</div></div>
            <div style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.8, color: 'var(--gray4)' }}>
              AI has access to:<br />
              • All leads + scores<br />
              • Churn risk flags<br />
              • Pipeline stages<br />
              • Interaction history<br />
              • Sentiment data<br />
              <br />
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>Context rebuilt live from MySQL on each message.</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
