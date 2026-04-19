import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Activity, Trash2, Plus, Clock } from 'lucide-react';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  interval: number;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
}

export const Endpoints: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState(60);
  const [error, setError] = useState('');

  const fetchEndpoints = async () => {
    try {
      const response = await api.get('/endpoints');
      setEndpoints(response.data.endpoints);
    } catch (err) {
      console.error('Failed to fetch endpoints', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/endpoints', { name, url, interval: Number(interval) });
      setIsModalOpen(false);
      setName('');
      setUrl('');
      setInterval(60);
      fetchEndpoints();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create endpoint');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this endpoint?')) return;
    try {
      await api.delete(`/endpoints/${id}`);
      fetchEndpoints();
    } catch (err) {
      console.error('Failed to delete endpoint', err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Monitored Endpoints</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage the APIs you are currently tracking</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> New Endpoint
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading endpoints...</div>
      ) : endpoints.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Activity size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ marginBottom: '8px' }}>No endpoints found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>You haven't added any APIs to monitor yet.</p>
          <button className="btn btn-outline" onClick={() => setIsModalOpen(true)}>Add your first endpoint</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {endpoints.map((ep) => (
            <div key={ep.id} className="card flex-between" style={{ padding: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {ep.name}
                  <span className={`badge ${ep.status === 'ERROR' ? 'badge-error' : 'badge-success'}`}>
                    {ep.status || 'ACTIVE'}
                  </span>
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>{ep.url}</p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Interval: {ep.interval}s</span>
                </div>
              </div>
              <div>
                <button 
                  className="btn btn-outline" 
                  style={{ color: 'var(--error)', borderColor: 'var(--border-color)', padding: '8px' }}
                  onClick={() => handleDelete(ep.id)}
                  title="Delete Endpoint"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Basic Modal Implementation */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', margin: '20px' }}>
            <h2 style={{ marginBottom: '24px' }}>Add New Endpoint</h2>
            
            {error && <div className="badge badge-error" style={{ width: '100%', padding: '12px', marginBottom: '20px' }}>{error}</div>}
            
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">API Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production Payment API" required />
              </div>
              <div className="form-group">
                <label className="form-label">Target URL</label>
                <input className="form-input" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/health" required />
              </div>
              <div className="form-group">
                <label className="form-label">Check Interval (seconds)</label>
                <input className="form-input" type="number" min="10" max="3600" value={interval} onChange={e => setInterval(Number(e.target.value))} required />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Endpoint</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
