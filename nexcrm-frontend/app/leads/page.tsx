'use client';

import { useEffect, useState, useCallback } from 'react';
import { leadsApi, type Lead, type Stage, type Sentiment } from '@/lib/api';
import LeadRow from '@/components/LeadRow';
import LeadModal from '@/components/LeadModal';

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showModal, setModal]   = useState(false);
  const [editLead, setEditLead] = useState<Lead | undefined>();

  // Filters
  const [stage,     setStage]     = useState('');
  const [sentiment, setSentiment] = useState('');
  const [sort,      setSort]      = useState('ai_score');
  const [search,    setSearch]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { sort, order: 'desc' };
      if (stage)     params.stage     = stage;
      if (sentiment) params.sentiment = sentiment;
      setLeads(await leadsApi.list(params));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [stage, sentiment, sort]);

  useEffect(() => { load(); }, [load]);

  function openAdd()  { setEditLead(undefined); setModal(true); }
  function openEdit(l: Lead) { setEditLead(l); setModal(true); }

  function handleSaved(saved: Lead) {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setModal(false);
  }

  async function handleDelete(id: number) {
    try { await leadsApi.delete(id); setLeads(prev => prev.filter(l => l.id !== id)); }
    catch (e: any) { alert(e.message); }
  }

  const filtered = leads.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.company || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Lead Scoring</div>
        <div className="topbar-right">
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gray4)' }}>
            {filtered.length} leads
          </span>
          <button className="btn btn-primary" onClick={openAdd}>+ New Lead</button>
        </div>
      </div>

      <div className="page">
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="Search name or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" style={{ width: 140 }} value={stage} onChange={e => setStage(e.target.value)}>
            <option value="">All Stages</option>
            {['Lead','Qualified','Proposal','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ width: 150 }} value={sentiment} onChange={e => setSentiment(e.target.value)}>
            <option value="">All Sentiment</option>
            {['Positive','Neutral','Negative'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ width: 160 }} value={sort} onChange={e => setSort(e.target.value)}>
            <option value="ai_score">Sort: AI Score</option>
            <option value="deal_value">Sort: Deal Value</option>
            <option value="created_at">Sort: Newest</option>
            <option value="last_contacted">Sort: Last Contact</option>
          </select>
          <button className="btn btn-sm" onClick={load}>↻ Refresh</button>
        </div>

        {error && (
          <div style={{ padding: 14, border: 'var(--border)', background: '#fff0eb', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        <div className="panel" style={{ overflowX: 'auto' }}>
          {loading
            ? <div className="loading-state">Loading leads from database...</div>
            : filtered.length === 0
            ? <div className="empty-state">No leads found. Click "New Lead" to add one.</div>
            : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Company</th><th>AI Score</th><th>Stage</th>
                    <th>Sentiment</th><th>Last Contact</th><th>Value</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <LeadRow key={l.id} lead={l} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Summary bar */}
        {!loading && filtered.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', gap: 24, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gray4)' }}>
            <span>Total Value: <strong style={{ color: 'var(--black)' }}>₹{filtered.reduce((a,l) => a + l.deal_value, 0).toLocaleString('en-IN')}</strong></span>
            <span>Avg Score: <strong style={{ color: 'var(--black)' }}>{Math.round(filtered.reduce((a,l) => a + l.ai_score, 0) / filtered.length)}</strong></span>
            <span>At Risk: <strong style={{ color: 'var(--accent)' }}>{filtered.filter(l => l.churn_risk).length}</strong></span>
          </div>
        )}
      </div>

      {showModal && (
        <LeadModal lead={editLead} onClose={() => setModal(false)} onSaved={handleSaved} />
      )}
    </>
  );
}
