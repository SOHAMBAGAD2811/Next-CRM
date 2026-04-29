'use client';

import { useEffect, useState } from 'react';
import { leadsApi, type Lead } from '@/lib/api';
import LeadModal from '@/components/LeadModal';

function initials(name: string) {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#4d7cff','#00c896','#f5c518','#ff4d00','#b04dff','#00b8d4'];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = ((h << 5) - h) + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function ContactsPage() {
  const [leads,      setLeads]     = useState<Lead[]>([]);
  const [selected,   setSelected]  = useState<Lead | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState('');
  const [showModal,  setModal]     = useState(false);
  const [editTarget, setEdit]      = useState<Lead | undefined>();
  const [search,     setSearch]    = useState('');
  const [intBody,    setIntBody]   = useState('');
  const [intChannel, setIntCh]     = useState<'email'|'call'|'chat'|'note'>('note');
  const [intSaving,  setIntSave]   = useState(false);
  const [intMsg,     setIntMsg]    = useState('');

  useEffect(() => {
    leadsApi.list({ sort: 'created_at', order: 'desc' })
      .then(setLeads)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load full detail when selecting a contact
  async function selectContact(lead: Lead) {
    setSelected(null);
    try {
      const detail = await leadsApi.get(lead.id);
      setSelected(detail);
    } catch { setSelected(lead); }
  }

  function handleSaved(saved: Lead) {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === saved.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [saved, ...prev];
    });
    setModal(false);
    if (selected?.id === saved.id) setSelected(saved);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this contact?')) return;
    await leadsApi.delete(id);
    setLeads(prev => prev.filter(l => l.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function logInt() {
    if (!selected || !intBody.trim()) return;
    setIntSave(true); setIntMsg('');
    try {
      await leadsApi.addInteraction(selected.id, { channel: intChannel, body: intBody });
      const updated = await leadsApi.get(selected.id);
      setSelected(updated);
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setIntBody('');
      setIntMsg('Interaction saved + sentiment analysed.');
    } catch (e: any) { setIntMsg(`Error: ${e.message}`); }
    finally { setIntSave(false); }
  }

  const filtered = leads.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Contact Management</div>
        <div className="topbar-right">
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gray4)' }}>{filtered.length} contacts</span>
          <button className="btn btn-primary" onClick={() => { setEdit(undefined); setModal(true); }}>+ New Contact</button>
        </div>
      </div>

      <div className="page" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, height: 'calc(100vh - 88px)' }}>

        {/* Contact list */}
        <div className="panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: 'var(--border)' }}>
            <input
              className="form-input"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>

          {error && <div style={{ padding: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>⚠ {error}</div>}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading
              ? <div className="loading-state">Loading contacts...</div>
              : filtered.map(lead => (
                <div key={lead.id}
                  onClick={() => selectContact(lead)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderBottom: '1.5px solid #e0ddd6',
                    cursor: 'pointer',
                    background: selected?.id === lead.id ? '#faf0eb' : 'transparent',
                    borderLeft: selected?.id === lead.id ? '3px solid var(--accent)' : '3px solid transparent',
                  }}>
                  <div className="avatar" style={{ width: 36, height: 36, background: avatarColor(lead.name), color: 'white', fontSize: 11, flexShrink: 0 }}>
                    {initials(lead.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray4)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</div>
                  </div>
                  {lead.churn_risk && <span style={{ fontSize: 14 }}>⚠</span>}
                </div>
              ))
            }
          </div>
        </div>

        {/* Contact detail */}
        {!selected
          ? (
            <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">← Select a contact to view details</div>
            </div>
          )
          : (
            <div className="panel" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: 'var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="avatar" style={{ width: 52, height: 52, background: avatarColor(selected.name), color: 'white', fontSize: 16 }}>
                  {initials(selected.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray4)', fontFamily: 'var(--mono)' }}>{selected.company}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" onClick={() => { setEdit(selected); setModal(true); }}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, borderBottom: 'var(--border)' }}>
                {[
                  { label: 'Email',        value: selected.email },
                  { label: 'Phone',        value: selected.phone || '—' },
                  { label: 'Stage',        value: selected.stage },
                  { label: 'AI Score',     value: `${selected.ai_score}/100` },
                  { label: 'Sentiment',    value: selected.sentiment },
                  { label: 'Deal Value',   value: `₹${selected.deal_value.toLocaleString('en-IN')}` },
                  { label: 'Churn Risk',   value: selected.churn_risk ? `${selected.churn_risk_pct}% ⚠` : 'None' },
                  { label: 'Last Contact', value: selected.days_since_contact != null ? `${selected.days_since_contact} days ago` : '—' },
                  { label: 'Added',        value: new Date(selected.created_at).toLocaleDateString('en-IN') },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--gray4)', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Interaction history */}
              <div style={{ padding: '20px 24px', borderBottom: 'var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--gray4)', marginBottom: 14 }}>
                  Interaction History ({selected.interactions?.length ?? 0})
                </div>
                {!selected.interactions || selected.interactions.length === 0
                  ? <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gray4)' }}>No interactions yet.</div>
                  : selected.interactions.slice().reverse().map(int => (
                    <div key={int.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #e0ddd6' }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', background: '#e0ddd6', border: '1px solid #ccc' }}>
                          {int.channel}
                        </span>
                        <span className={`tag ${int.sentiment === 'Positive' ? 'tag-pos' : int.sentiment === 'Negative' ? 'tag-neg' : 'tag-neu'}`}>
                          {int.sentiment}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--gray4)', marginLeft: 'auto' }}>
                          {new Date(int.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--gray3)', whiteSpace: 'pre-wrap' }}>
                        {int.body}
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Log new interaction */}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--gray4)', marginBottom: 14 }}>
                  Log New Interaction
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {(['email','call','chat','note'] as const).map(c => (
                    <button key={c} className={`btn btn-sm ${intChannel === c ? 'btn-primary' : ''}`} onClick={() => setIntCh(c)}>
                      {c}
                    </button>
                  ))}
                </div>
                <textarea
                  className="form-textarea"
                  placeholder="Notes, email content, call summary... AI will analyse sentiment."
                  rows={4}
                  value={intBody}
                  onChange={e => setIntBody(e.target.value)}
                />
                {intMsg && (
                  <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--mono)', color: intMsg.startsWith('Error') ? 'var(--accent)' : 'var(--green)' }}>
                    {intMsg}
                  </div>
                )}
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={logInt} disabled={intSaving || !intBody.trim()}>
                  {intSaving ? 'Saving...' : 'Log Interaction + Analyse Sentiment'}
                </button>
              </div>
            </div>
          )
        }
      </div>

      {showModal && (
        <LeadModal lead={editTarget} onClose={() => setModal(false)} onSaved={handleSaved} />
      )}
    </>
  );
}
