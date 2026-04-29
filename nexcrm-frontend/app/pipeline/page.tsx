'use client';
import { useState, useEffect } from 'react';
import autoAnimate from '@formkit/auto-animate';
import { dashboardApi } from '@/lib/api';

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const stages = ['Lead', 'Qualified', 'Proposal', 'Closed'];

  useEffect(() => {
    // Fetch pipeline data from your Flask backend
    dashboardApi.pipeline()
      .then(data => {
        setPipeline(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch pipeline:", err);
        setLoading(false);
      });
  }, []);

  const handleDragStart = (e: React.DragEvent, leadId: string, sourceStage: string) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.setData('sourceStage', sourceStage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData('leadId');
    const sourceStage = e.dataTransfer.getData('sourceStage');

    if (!leadId || sourceStage === targetStage) return;

    setPipeline((prev: any) => {
      if (!prev) return prev;
      
      const newPipeline = { ...prev };
      const sourceColumn = newPipeline[sourceStage] ? { ...newPipeline[sourceStage], leads: [...newPipeline[sourceStage].leads] } : { leads: [], count: 0, total_value: 0 };
      const targetColumn = newPipeline[targetStage] ? { ...newPipeline[targetStage], leads: [...newPipeline[targetStage].leads] } : { leads: [], count: 0, total_value: 0 };

      const leadIndex = sourceColumn.leads.findIndex((l: any) => l.id.toString() === leadId);
      if (leadIndex === -1) return prev;

      const [leadToMove] = sourceColumn.leads.splice(leadIndex, 1);

      // Update counts and values locally
      sourceColumn.count -= 1;
      sourceColumn.total_value -= leadToMove.deal_value;

      targetColumn.leads.push(leadToMove);
      targetColumn.count += 1;
      targetColumn.total_value += leadToMove.deal_value;

      newPipeline[sourceStage] = sourceColumn;
      newPipeline[targetStage] = targetColumn;

      return newPipeline;
    });

    // Send the stage update to the Flask backend
    try {
      const updatedLead = await dashboardApi.movePipeline(parseInt(leadId), targetStage as any);
      
      // Update the lead's new score and attributes from the backend response
      setPipeline((prev: any) => {
        if (!prev) return prev;
        
        const newPipeline = { ...prev };
        const tgtColumn = newPipeline[targetStage];
        if (tgtColumn) {
          const leadIndex = tgtColumn.leads.findIndex((l: any) => l.id.toString() === leadId);
          if (leadIndex !== -1) {
            tgtColumn.leads[leadIndex] = { ...tgtColumn.leads[leadIndex], ...updatedLead };
          }
        }
        return newPipeline;
      });
    } catch (err) {
      console.error("Network error while trying to update lead stage:", err);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dropIn {
          0% { opacity: 0; transform: scale(1.05) translateY(-10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}} />
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
                <div key={stage} 
                     style={{ 
                       flex: 1, 
                       display: 'flex', 
                       flexDirection: 'column', 
                       background: dragOverColumn === stage ? '#e0ded8' : '#ece9e2', 
                       borderRadius: 8, 
                       padding: 16, 
                       border: 'var(--border)',
                       outline: dragOverColumn === stage ? '2px dashed #a8a599' : 'none',
                       outlineOffset: '-2px',
                       transition: 'background 0.2s, outline 0.2s'
                     }}
                     onDragEnter={(e) => { e.preventDefault(); setDragOverColumn(stage); }}
                     onDragOver={handleDragOver}
                     onDrop={(e) => handleDrop(e, stage)}
                >
                  
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #d4d0c5', paddingBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>{stage} <span style={{ color: 'var(--gray4)', fontWeight: 'normal' }}>({column.count})</span></strong>
                    <span style={{ fontSize: 12, color: 'var(--gray4)' }}>₹{column.total_value.toLocaleString()}</span>
                  </div>
                  
                  {/* Cards List */}
                  <div 
                    ref={(el) => { if (el) autoAnimate(el); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4 }}
                  >
                    {column.leads.map((lead: any) => (
                      <div key={lead.id} className="panel" 
                           draggable
                           onDragStart={(e) => handleDragStart(e, lead.id.toString(), stage)}
                           onDragEnd={() => setDragOverColumn(null)}
                           style={{ 
                             padding: 12, 
                             cursor: 'grab', 
                             transition: 'transform 0.1s',
                             animation: 'dropIn 0.3s ease-out'
                           }}
                           onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                           onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 13 }}>{lead.name}</strong>
                          <span style={{ fontSize: 11, fontWeight: 'bold', color: lead.ai_score >= 70 ? 'var(--green)' : 'inherit' }}>
                            ✦ {lead.ai_score}
                          </span>
                        </div>
                          {lead.next_action && (
                            <div style={{ marginTop: 8, padding: 6, background: 'rgba(59, 130, 246, 0.1)', borderLeft: '3px solid #3b82f6', borderRadius: 4, fontSize: 11, color: '#1e3a8a' }}>
                              <strong>Next Action:</strong> {lead.next_action}
                            </div>
                          )}                        
                        <div style={{ fontSize: 12, color: 'var(--gray4)', marginBottom: 8 }}>{lead.company}</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span>
                            ₹{lead.deal_value.toLocaleString()} 
                            {lead.win_probability ? <span style={{color: 'var(--gray4)'}}> • {lead.win_probability}% win</span> : null}
                          </span>
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