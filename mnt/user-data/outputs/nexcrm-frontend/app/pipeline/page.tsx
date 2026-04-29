'use client';
import { useState, useEffect } from 'react';

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const stages = ['Lead', 'Qualified', 'Proposal', 'Closed'];

  useEffect(() => {
    // Fetch pipeline data from your Flask backend
    fetch('http://localhost:5000/api/pipeline')
      .then(res => res.json())
      .then(data => {
        setPipeline(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch pipeline:", err);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">✦ Pipeline Board</div>
      </div>
      
      <div className="page" style={{ padding: 20, height: 'calc(100vh - 56px)', overflowX: 'auto' }}>
        {loading || !pipeline ? (
          <div style={{ padding: 20 }}>Loading pipeline...</div>
        ) : (
          <div style={{ display: 'flex', gap: 20, height: '100%', minWidth: 1000 }}>
            {stages.map(stage => {
              const column = pipeline[stage] || { leads: [], count: 0, total_value: 0 };
              return (
                <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ece9e2', borderRadius: 8, padding: 16, border: 'var(--border)' }}>
                  
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #d4d0c5', paddingBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>{stage} <span style={{ color: 'var(--gray4)', fontWeight: 'normal' }}>({column.count})</span></strong>
                    <span style={{ fontSize: 12, color: 'var(--gray4)' }}>₹{column.total_value.toLocaleString()}</span>
                  </div>
                  
                  {/* Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4 }}>
                    {column.leads.map((lead: any) => (
                      <div key={lead.id} className="panel" style={{ padding: 12, cursor: 'pointer', transition: 'transform 0.1s' }}
                           onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                           onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 13 }}>{lead.name}</strong>
                          <span style={{ fontSize: 11, fontWeight: 'bold', color: lead.ai_score >= 70 ? 'var(--green)' : 'inherit' }}>
                            ✦ {lead.ai_score}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: 12, color: 'var(--gray4)', marginBottom: 8 }}>{lead.company}</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span>₹{lead.deal_value.toLocaleString()}</span>
                          <span style={{ color: lead.sentiment === 'Negative' ? 'var(--red)' : lead.sentiment === 'Positive' ? 'var(--green)' : 'var(--gray4)' }}>
                            {lead.sentiment}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}