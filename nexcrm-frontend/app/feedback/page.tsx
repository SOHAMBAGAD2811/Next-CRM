'use client';

import { useState } from 'react';

export default function FeedbackPortal() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rating: 5,
    comments: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/public/feedback', {
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
        <h2 style={{ fontSize: 32, marginBottom: 16 }}>Thank you for your feedback!</h2>
        <p style={{ color: 'var(--gray4)' }}>Your responses have been recorded, and our team will use them to improve.</p>
        <button onClick={() => setSubmitted(false)} style={{ marginTop: 24, padding: '12px 24px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)', cursor: 'pointer' }}>
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>We Value Your Opinion</h1>
      <p style={{ color: 'var(--gray4)', marginBottom: 32 }}>Please let us know how your experience was working with us.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Full Name *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Email Address *</label>
            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Overall Satisfaction (1-5)</label>
          <input type="range" min="1" max="5" value={formData.rating} onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray4)', marginTop: 8 }}>
            <span>1 - Poor</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5 - Excellent</span>
          </div>
          <p style={{ marginTop: 8, fontSize: 18, fontWeight: 'bold' }}>Rating: {formData.rating}</p>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Any other feedback?</label>
          <textarea rows={5} value={formData.comments} onChange={e => setFormData({ ...formData, comments: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--black)', resize: 'vertical' }} placeholder="Please share any other details about your experience..." />
        </div>

        <button type="submit" style={{ padding: '16px', background: 'var(--accent)', color: 'var(--white)', fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>
          Submit Feedback
        </button>
      </form>
    </div>
  );
}