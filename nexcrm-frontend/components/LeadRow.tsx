'use client';

import type { Lead } from '@/lib/api';
import { useState } from 'react';

const AVATAR_COLORS = ['#4d7cff','#00c896','#f5c518','#ff4d00','#b04dff','#00b8d4','#ff6b6b','#00c896'];

function scoreColor(score: number) {
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--yellow)';
  return 'var(--accent)';
}

function stageClass(s: string) {
  return { Lead:'tag-lead', Qualified:'tag-qual', Proposal:'tag-prop', Closed:'tag-close' }[s] ?? 'tag-lead';
}

function sentClass(s: string) {
  return { Positive:'tag-pos', Negative:'tag-neg', Neutral:'tag-neu' }[s] ?? 'tag-neu';
}

function initials(name: string) {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = ((h << 5) - h) + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface Props {
  lead:    Lead;
  compact?: boolean;
  onEdit?: (lead: Lead) => void;
  onDelete?: (id: number) => void;
}

export default function LeadRow({ lead, compact, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (compact) {
    return (
      <tr>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="avatar" style={{ width: 28, height: 28, background: avatarColor(lead.name), color: 'white', fontSize: 10 }}>
              {initials(lead.name)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray4)', fontFamily: 'var(--mono)' }}>{lead.company}</div>
            </div>
          </div>
        </td>
        <td>
          <div className="score-bar">
            <div className="score-track" style={{ width: 60 }}>
              <div className="score-fill" style={{ width: `${lead.ai_score}%`, background: scoreColor(lead.ai_score) }} />
            </div>
            <span className="score-num" style={{ color: scoreColor(lead.ai_score) }}>{lead.ai_score}</span>
          </div>
        </td>
        <td><span className={`tag ${stageClass(lead.stage)}`}>{lead.stage}</span></td>
        <td><span className={`tag ${sentClass(lead.sentiment)}`}>{lead.sentiment}</span></td>
        <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
          ₹{lead.deal_value.toLocaleString('en-IN')}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ width: 32, height: 32, background: avatarColor(lead.name), color: 'white', fontSize: 11 }}>
            {initials(lead.name)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{lead.name}</div>
            <div style={{ fontSize: 11, color: 'var(--gray4)', fontFamily: 'var(--mono)' }}>{lead.email}</div>
          </div>
        </div>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gray4)' }}>{lead.company}</td>
      <td>
        <div className="score-bar">
          <div className="score-track">
            <div className="score-fill" style={{ width: `${lead.ai_score}%`, background: scoreColor(lead.ai_score) }} />
          </div>
          <span className="score-num" style={{ color: scoreColor(lead.ai_score) }}>{lead.ai_score}</span>
        </div>
      </td>
      <td><span className={`tag ${stageClass(lead.stage)}`}>{lead.stage}</span></td>
      <td><span className={`tag ${sentClass(lead.sentiment)}`}>{lead.sentiment}</span></td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gray4)' }}>
        {lead.days_since_contact != null ? `${lead.days_since_contact}d ago` : '—'}
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>
        ₹{lead.deal_value.toLocaleString('en-IN')}
      </td>
      {(onEdit || onDelete) && (
        <td>
          <div style={{ display: 'flex', gap: 6 }}>
            {onEdit && (
              <button className="btn btn-sm" onClick={() => onEdit(lead)}>Edit</button>
            )}
            {onDelete && !confirming && (
              <button className="btn btn-sm btn-danger" onClick={() => setConfirming(true)}>Delete</button>
            )}
            {onDelete && confirming && (
              <>
                <button className="btn btn-sm btn-danger" onClick={() => { onDelete(lead.id); setConfirming(false); }}>Confirm</button>
                <button className="btn btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
