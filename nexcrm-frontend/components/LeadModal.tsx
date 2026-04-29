'use client';

import { useState } from 'react';
import { leadsApi, type Lead, type Stage, type Sentiment } from '@/lib/api';

interface Props {
  lead?:    Lead;
  onClose:  () => void;
  onSaved:  (lead: Lead) => void;
}

const STAGES:     Stage[]     = ['Lead', 'Qualified', 'Proposal', 'Closed'];
const SENTIMENTS: Sentiment[] = ['Positive', 'Neutral', 'Negative'];

export default function LeadModal({ lead, onClose, onSaved }: Props) {
  const isEdit = !!lead;

  const defaultCreatedDate = lead?.created_at ? lead.created_at.slice(0, 10) : '';

  const [form, setForm] = useState({
    name:            lead?.name            ?? '',
    email:           lead?.email           ?? '',
    company:         lead?.company         ?? '',
    phone:           lead?.phone           ?? '',
    stage:           lead?.stage           ?? 'Lead',
    deal_value:      lead?.deal_value      ?? '',
    win_probability: lead?.win_probability ?? 0,
    tags:            lead?.tags            ?? '',
    next_action:     lead?.next_action     ?? '',
    created_at:      defaultCreatedDate,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit() {
    if (!form.name || !form.email) { setError('Name and email are required.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { 
        ...form, 
        deal_value: Number(form.deal_value) || 0,
        win_probability: Number(form.win_probability) || 0
      };
      const saved = isEdit
        ? await leadsApi.update(lead!.id, payload)
        : await leadsApi.create(payload);
      onSaved(saved);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Lead' : 'Add New Lead'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', border: 'var(--border)', background: '#fff0eb', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>
              {error}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Riya Mehta" />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="riya@company.com" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="TechNova Pvt. Ltd." />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Stage</label>
              <select className="form-select" value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deal Value (₹)</label>
              <input className="form-input" type="number" value={form.deal_value} onChange={e => set('deal_value', e.target.value)} placeholder="500000" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Win Probability (%)</label>
              <input className="form-input" type="number" value={form.win_probability} onChange={e => set('win_probability', e.target.value)} placeholder="50" min="0" max="100" />
            </div>
            <div className="form-group">
              <label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="enterprise, SaaS, high-priority" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Next Action (Prompt)</label>
              <input className="form-input" value={form.next_action} onChange={e => set('next_action', e.target.value)} placeholder="Send contract for review" />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Date</label>
              <input className="form-input" type="date" value={form.created_at} onChange={e => set('created_at', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 8, padding: '12px 14px', background: '#ece9e2', border: '1.5px solid #ccc', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gray4)', lineHeight: 1.6 }}>
            ✦ AI Score, Churn Risk, and Lead Date are saved automatically after saving.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
