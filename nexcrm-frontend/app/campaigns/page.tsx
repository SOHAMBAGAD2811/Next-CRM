'use client';
import { useState, useEffect } from 'react';
import { marketingApi, Campaign, Segment } from '@/lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([marketingApi.getCampaigns(), marketingApi.getSegments()]);
      setCampaigns(c);
      setSegments(s);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSegment = async () => {
    const s = await marketingApi.createSegment({ name: 'New Segment', rules_json: '{"stage":"Lead"}' });
    setSegments([...segments, s]);
    setActiveSegmentId(s.id);
  };

  const handleCreateCampaign = async () => {
    const c = await marketingApi.createCampaign({ name: 'New Campaign', subject: '', body_html: '', status: 'Draft', type: 'email' });
    setCampaigns([...campaigns, c]);
    setActiveCampaignId(c.id);
  };

  const updateSegment = async (id: number, updates: Partial<Segment>) => {
    setSegments(segments.map(s => s.id === id ? { ...s, ...updates } : s));
    await marketingApi.updateSegment(id, updates);
  };

  const deleteSegment = async (id: number) => {
    await marketingApi.deleteSegment(id);
    setSegments(segments.filter(s => s.id !== id));
    if (activeSegmentId === id) setActiveSegmentId(null);
  };

  const updateCampaign = async (id: number, updates: Partial<Campaign>) => {
    setCampaigns(campaigns.map(c => c.id === id ? { ...c, ...updates } : c));
    await marketingApi.updateCampaign(id, updates);
  };

  const deleteCampaign = async (id: number) => {
    await marketingApi.deleteCampaign(id);
    setCampaigns(campaigns.filter(c => c.id !== id));
    if (activeCampaignId === id) setActiveCampaignId(null);
  };

  const activeSegment = segments.find(s => s.id === activeSegmentId);
  const activeCampaign = campaigns.find(c => c.id === activeCampaignId);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">▶ Campaigns & Segments</div>
      </div>
      <div className="page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          
          {/* Segments Column */}
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ margin: 0 }}>Segments</h2>
                <button onClick={handleCreateSegment} style={{ background: 'var(--brand)', color: 'green', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+ New Segment</button>
              </div>
              <div style={{ padding: 15 }}>
                { loading ? 'Loading...' : segments.length === 0 ? <p style={{color:'gray'}}>No segments yet.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {segments.map(s => (
                      <li key={s.id} onClick={() => setActiveSegmentId(s.id)} style={{ padding: '10px', cursor: 'pointer', background: activeSegmentId === s.id ? 'var(--gray-900)' : 'transparent', borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
                        <strong>{s.name}</strong>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteSegment(s.id); }} 
                          style={{ background: 'transparent', color: '#ff4444', border: 'none', cursor: 'pointer', padding: '4px', fontSize: 12 }}
                          title="Delete Segment"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {activeSegment && (
              <div className="panel" style={{ padding: 15 }}>
                <h3 style={{marginTop:0}}>Edit Segment: {activeSegment.name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label>
                    <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Segment Name</div>
                    <input 
                      type="text" 
                      value={activeSegment.name} 
                      onChange={e => updateSegment(activeSegment.id, { name: e.target.value })}
                      style={{ width: '100%', padding: '8px', boxSizing:'border-box' }}
                    />
                  </label>
                  <label>
                    <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Filter Rules (JSON Format for now)</div>
                    <textarea 
                      rows={5}
                      value={activeSegment.rules_json}
                      onChange={e => updateSegment(activeSegment.id, { rules_json: e.target.value })}
                      style={{ width: '100%', padding: '8px', boxSizing:'border-box', fontFamily:'monospace' }}
                    />
                  </label>
                  <button onClick={() => deleteSegment(activeSegment.id)} style={{ background: '#440000', color: 'white', marginTop: 10 }}>Delete Segment</button>
                </div>
              </div>
            )}
          </div>

          {/* Campaigns Column */}
          <div style={{ flex: 1, minWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ margin: 0 }}>Campaigns</h2>
                <button onClick={handleCreateCampaign} style={{ background: 'var(--brand)', color: 'green', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+ New Campaign</button>
              </div>
              <div style={{ padding: 15 }}>
                { loading ? 'Loading...' : campaigns.length === 0 ? <p style={{color:'gray'}}>No campaigns yet.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {campaigns.map(c => (
                      <li key={c.id} onClick={() => setActiveCampaignId(c.id)} style={{ padding: '10px', cursor: 'pointer', background: activeCampaignId === c.id ? 'var(--gray-900)' : 'transparent', borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{c.name}</strong> 
                          <span style={{color:'gray', fontSize: 12, marginLeft: 8}}>{c.status}</span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }} 
                          style={{ background: 'transparent', color: '#ff4444', border: 'none', cursor: 'pointer', padding: '4px', fontSize: 12 }}
                          title="Delete Campaign"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {activeCampaign && (
              <div className="panel" style={{ padding: 15 }}>
                <h3 style={{marginTop:0}}>Edit Campaign: {activeCampaign.name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <label>
                    <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Campaign Name</div>
                    <input 
                      type="text" 
                      value={activeCampaign.name} 
                      onChange={e => updateCampaign(activeCampaign.id, { name: e.target.value })}
                      style={{ width: '100%', padding: '8px', boxSizing:'border-box' }}
                    />
                  </label>

                  <div style={{ display:'flex', gap: 15 }}>
                    <label style={{flex: 1}}>
                      <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Target Segment</div>
                      <select 
                        value={activeCampaign.segment_id || ''} 
                        onChange={e => updateCampaign(activeCampaign.id, { segment_id: parseInt(e.target.value) || null })}
                        style={{ width: '100%', padding: '8px', boxSizing:'border-box' }}
                      >
                        <option value="">-- Select Segment --</option>
                        {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                    <label style={{width: 100}}>
                      <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Status</div>
                      <select 
                        value={activeCampaign.status} 
                        onChange={e => updateCampaign(activeCampaign.id, { status: e.target.value as any })}
                        style={{ width: '100%', padding: '8px', boxSizing:'border-box' }}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Sent">Sent</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Subject Line</div>
                    <input 
                      type="text" 
                      value={activeCampaign.subject} 
                      onChange={e => updateCampaign(activeCampaign.id, { subject: e.target.value })}
                      placeholder="Special offer for you!"
                      style={{ width: '100%', padding: '8px', boxSizing:'border-box' }}
                    />
                  </label>

                  <label>
                    <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Email Body (HTML/Text)</div>
                    <textarea 
                      rows={8}
                      value={activeCampaign.body_html}
                      onChange={e => updateCampaign(activeCampaign.id, { body_html: e.target.value })}
                      placeholder="Write your email content here..."
                      style={{ width: '100%', padding: '8px', boxSizing:'border-box' }}
                    />
                  </label>
                  
                  <button onClick={() => deleteCampaign(activeCampaign.id)} style={{ background: '#440000', color: 'white', marginTop: 10 }}>Delete Campaign</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
