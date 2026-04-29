'use client';

import { useState } from 'react';

export default function CustomerPortal() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    deal_value: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (submitted) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, marginBottom: 16 }}>Thank you for reaching out!</h2>
        <p style={{ color: 'var(--gray4)' }}>Our sales team will be in touch with you shortly.</p>
        <button onClick={() => setSubmitted(false)} style={{ marginTop: 24, padding: '12px 24px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)', cursor: 'pointer' }}>
          Submit another inquiry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>Partner with Us</h1>
      <p style={{ color: 'var(--gray4)', marginBottom: 32 }}>Leave your details and we'll route you to the right team member based on your needs.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Full Name *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '12px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Email Address *</label>
            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '12px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Company</label>
            <input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} style={{ width: '100%', padding: '12px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Phone</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '12px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Estimated Deal Size ($)</label>
          <input type="number" value={formData.deal_value} onChange={e => setFormData({ ...formData, deal_value: e.target.value })} style={{ width: '100%', padding: '12px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} placeholder="e.g. 5000" />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>How can we help you?</label>
          <textarea rows={5} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} style={{ width: '100%', padding: '12px', border: 'var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)', resize: 'vertical' }} placeholder="Describe your product needs or questions..." />
        </div>

        <button type="submit" style={{ padding: '16px', background: 'var(--accent)', color: 'var(--white)', fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>
          Submit Inquiry
        </button>
      </form>
    </div>
  );
}