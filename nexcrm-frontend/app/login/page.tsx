// NexCRM - Login Page

'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@nexcrm.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister 
      ? { name: name.trim(), email: email.trim(), password } 
      : { email: email.trim(), password };

    try {
      const res = await fetch('http://localhost:5000' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      // Save user to browser storage
      localStorage.setItem('nexcrm_user', JSON.stringify(data.user));
      
      // Redirect to the main dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#e0dcd1' }}>
      <div className="panel" style={{ width: 400, padding: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Nex<span style={{ color: 'var(--accent)' }}>CRM</span></div>
        <div style={{ fontSize: 14, color: 'var(--gray4)', marginBottom: 24 }}>
          {isRegister ? 'Create a new account' : 'Sign in to access your dashboard'}
        </div>
        
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16, background: '#ffebf0', padding: 10, borderRadius: 4 }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>FULL NAME</label>
              <input type="text" required className="form-input" style={{ width: '100%' }} value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>EMAIL</label>
            <input type="email" required className="form-input" style={{ width: '100%' }} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>PASSWORD</label>
            <input type="password" required className="form-input" style={{ width: '100%' }} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Processing...' : (isRegister ? 'Create Account ->' : 'Sign In ->')}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Sign In' : 'Register'}
          </span>
        </div>
      </div>
    </div>
  );
}
