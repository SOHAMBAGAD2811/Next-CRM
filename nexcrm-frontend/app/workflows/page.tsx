'use client';
import { useState, useEffect } from 'react';
import { marketingApi, Workflow } from '../../lib/api';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkflowId, setActiveWorkflowId] = useState<number | null>(null);

  useEffect(() => {
    marketingApi.getWorkflows()
      .then(setWorkflows)
      .finally(() => setLoading(false));
  }, []);

  const handleCreateWorkflow = async () => {
    const w = await marketingApi.createWorkflow({ 
      name: 'New Workflow', 
      trigger: 'status_change', 
      actions_json: '{"action":"send_email","template":"welcome"}',
      is_active: false
    });
    setWorkflows([...workflows, w]);
    setActiveWorkflowId(w.id);
  };

  const updateWorkflow = async (id: number, updates: Partial<Workflow>) => {
    setWorkflows(workflows.map(w => w.id === id ? { ...w, ...updates } : w));
    await marketingApi.updateWorkflow(id, updates);
  };

  const deleteWorkflow = async (id: number) => {
    await marketingApi.deleteWorkflow(id);
    setWorkflows(workflows.filter(w => w.id !== id));
    if (activeWorkflowId === id) setActiveWorkflowId(null);
  };

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">⚙ Workflows</div>
      </div>
      <div className="page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          
          {/* Workflows List */}
          <div className="panel" style={{ width: 350, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0 }}>Automations</h2>
              <button onClick={handleCreateWorkflow} style={{ background: 'var(--brand)', color: 'green', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+ New Workflow</button>
            </div>
            <div style={{ padding: 15 }}>
              { loading ? 'Loading...' : workflows.length === 0 ? <p style={{color:'gray'}}>No workflows configured.</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {workflows.map(w => (
                    <li 
                      key={w.id} 
                      onClick={() => setActiveWorkflowId(w.id)}
                      style={{ 
                        padding: '12px', 
                        cursor: 'pointer', 
                        background: activeWorkflowId === w.id ? 'var(--gray-900)' : 'transparent', 
                        borderBottom: '1px solid var(--border)', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <strong>{w.name}</strong>
                      <span style={{ color: w.is_active ? '#4ade80' : 'gray', fontSize: 12 }}>
                        {w.is_active ? 'Active' : 'Paused'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Workflow Editor */}
          {activeWorkflow && (
            <div className="panel" style={{ flex: 1, padding: 20, minWidth: 400 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 20 }}>
                <h2 style={{margin:0}}>Edit Automation</h2>
                <button 
                  onClick={() => updateWorkflow(activeWorkflow.id, { is_active: !activeWorkflow.is_active })}
                  style={{ background: activeWorkflow.is_active ? '#334155' : '#16a34a', color: 'white' }}
                >
                  {activeWorkflow.is_active ? 'Pause Workflow' : 'Activate Workflow'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <label>
                  <div style={{fontSize: 12, color: 'gray', marginBottom: 4}}>Workflow Name</div>
                  <input 
                    type="text" 
                    value={activeWorkflow.name} 
                    onChange={e => updateWorkflow(activeWorkflow.id, { name: e.target.value })}
                    style={{ width: '100%', padding: '10px', boxSizing:'border-box', fontSize: 16 }}
                  />
                </label>

                <div style={{ background: 'var(--gray-900)', padding: 15, borderRadius: 8, borderLeft: '4px solid #3b82f6' }}>
                  <h4 style={{marginTop:0, marginBottom: 10, color:'#93c5fd'}}>WHEN (Trigger)</h4>
                  <select 
                    value={activeWorkflow.trigger} 
                    onChange={e => updateWorkflow(activeWorkflow.id, { trigger: e.target.value })}
                    style={{ width: '100%', padding: '10px', boxSizing:'border-box' }}
                  >
                    <option value="status_change">Lead Stage Changes to...</option>
                    <option value="lead_created">New Lead is Created</option>
                    <option value="high_churn_risk">Churn Risk &gt; 70%</option>
                    <option value="score_increase">AI Score &gt; 80</option>
                  </select>
                </div>

                <div style={{ textAlign: 'center', color: 'gray' }}>
                  <span>↓</span>
                </div>

                <div style={{ background: 'var(--gray-900)', padding: 15, borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                  <h4 style={{marginTop:0, marginBottom: 10, color:'#6ee7b7'}}>THEN DO (Action JSON payload)</h4>
                  <div style={{fontSize: 12, color: 'gray', marginBottom: 8}}>
                    Define the action payload here. E.g., {`{"action": "send_email", "template_id": 12}`}
                  </div>
                  <textarea 
                    rows={4}
                    value={activeWorkflow.actions_json}
                    onChange={e => updateWorkflow(activeWorkflow.id, { actions_json: e.target.value })}
                    style={{ width: '100%', padding: '10px', boxSizing:'border-box', fontFamily: 'monospace' }}
                  />
                </div>

                <button 
                  onClick={() => deleteWorkflow(activeWorkflow.id)} 
                  style={{ background: '#440000', color: 'white', alignSelf: 'flex-start' }}
                >
                  Delete Workflow
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}