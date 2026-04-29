'use client';
import { useState, useEffect } from 'react';

export default function ChurnPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch at-risk accounts from the Flask backend
    fetch('http://localhost:5000/api/churn-risk')
      .then(res => res.json())
      .then(data => {
        setLeads(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch churn risk data:", err);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">✦ Churn Radar</div>
      </div>

      <div className="page" style={{ padding: 20 }}>
        <div className="panel" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20 }}>Loading at-risk accounts...</div>
          ) : leads.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--gray4)' }}>No accounts currently at risk. Great job!</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#ece9e2', borderBottom: 'var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Account</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Risk Level</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Days Dormant</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sentiment</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Value At Risk</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.id} style={{ borderBottom: i === leads.length - 1 ? 'none' : 'var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <strong>{lead.name}</strong><br/>
                      <span style={{ fontSize: 12, color: 'var(--gray4)' }}>{lead.company}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#e0dcd1', height: 6, borderRadius: 3, overflow: 'hidden', minWidth: 60, maxWidth: 100 }}>
                          <div style={{ background: 'var(--red)', height: '100%', width: `${lead.churn_risk_pct}%` }} />
                        </div>
                        <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>{lead.churn_risk_pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{lead.days_since_contact !== null ? `${lead.days_since_contact} days` : 'Never'}</td>
                    <td style={{ padding: '12px 16px', color: lead.sentiment === 'Negative' ? 'var(--red)' : 'inherit' }}>{lead.sentiment}</td>
                    <td style={{ padding: '12px 16px' }}>₹{lead.deal_value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}