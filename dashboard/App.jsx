import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const WS = process.env.REACT_APP_WORKSPACE_ID || 'dev_workspace';

export default function App() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/dashboard/${WS}`)
      .then(r => r.json())
      .then(d => { setMetrics(d.metrics || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={s.wrap}><p>Loading...</p></div>;
  if (error) return <div style={s.wrap}><p style={{color:'red'}}>{error}</p></div>;

  return (
    <div style={s.wrap}>
      <h1 style={s.title}>DataPulse</h1>
      <p style={s.sub}>Workspace: {WS}</p>
      {metrics.length === 0
        ? <p>No metrics yet. POST to /api/metrics to get started.</p>
        : <div style={s.grid}>
            {metrics.map(m => (
              <div key={m.name} style={s.card}>
                <p style={s.label}>{m.name}</p>
                <p style={s.value}>{m.latest}</p>
                <p style={s.meta}>{m.count} data points</p>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

const s = {
  wrap: {fontFamily:'sans-serif',padding:'40px',maxWidth:'900px',margin:'0 auto'},
  title: {fontSize:'28px',fontWeight:'700',marginBottom:'4px'},
  sub: {color:'#666',marginBottom:'32px'},
  grid: {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'},
  card: {background:'#f9f9f9',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'20px'},
  label: {fontSize:'13px',color:'#888',textTransform:'uppercase',marginBottom:'8px'},
  value: {fontSize:'32px',fontWeight:'700',color:'#111',marginBottom:'4px'},
  meta: {fontSize:'12px',color:'#aaa'}
};

