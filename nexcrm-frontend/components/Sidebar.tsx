'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/dashboard', icon: '⬡', label: 'Dashboard' },
  { href: '/leads',     icon: '◈', label: 'Leads' },
  { href: '/pipeline',  icon: '⬗', label: 'Pipeline' },
  { href: '/churn',     icon: '⚠', label: 'Churn Risk' },
  { href: '/assistant', icon: '✦', label: 'AI Assistant' },
  { href: '/contacts',  icon: '◎', label: 'Contacts' },  { href: '/campaigns', icon: '▶', label: 'Campaigns' },
  { href: '/workflows', icon: '⚙', label: 'Workflows' },];

export default function Sidebar() {
  const path = usePathname();
  const [user, setUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nexcrm_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('nexcrm_user');
    window.location.href = '/login';
  };

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: 220,
      background: 'var(--black)', color: 'var(--white)',
      borderRight: 'var(--border)', display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '2px solid #2a2a2a' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
          Nex<span style={{ color: 'var(--accent)' }}>CRM</span>
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#555', marginTop: 4, letterSpacing: 1 }}>
          AI SALES INTELLIGENCE
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {navItems.map(item => {
          const active = path === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 20px', cursor: 'pointer',
                fontSize: 14, fontWeight: 500,
                color: active ? 'var(--white)' : '#666',
                background: active ? '#1a1a1a' : 'transparent',
                borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                transition: 'all 0.1s',
              }}>
                <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '2px solid #2a2a2a', position: 'relative' }}>
        {showLogout && (
          <div 
            onClick={handleLogout}
            style={{
              position: 'absolute', bottom: '100%', left: 20, right: 20, marginBottom: 8,
              background: 'var(--white)', color: 'var(--black)', padding: '10px 16px',
              borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              boxShadow: 'var(--shadow-sm)', border: 'var(--border)', textAlign: 'center'
            }}
          >
            Log Out →
          </div>
        )}
        <div onClick={() => setShowLogout(!showLogout)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--accent)', border: '2px solid #444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, color: 'white',
          }}>{initials}</div>
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: 'var(--white)' }}>{user ? user.name : 'Loading...'}</div>
            <div style={{ color: '#666' }}>{user ? user.role : ''}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
