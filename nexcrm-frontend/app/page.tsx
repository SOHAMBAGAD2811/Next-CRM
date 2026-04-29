'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div style={{ backgroundColor: 'var(--white)', minHeight: '100vh', color: 'var(--black)', fontFamily: 'var(--font-grotesk)' }}>
      {/* Navigation */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: 'var(--white)', display: 'flex', justifyContent: 'space-between', padding: '24px 48px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
          Nex<span style={{ color: 'var(--accent)' }}>CRM</span>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', fontWeight: 600 }}>
          <a href="#features" style={{ color: 'var(--black)', textDecoration: 'none' }}>Features</a>
          <a href="#about" style={{ color: 'var(--black)', textDecoration: 'none' }}>About</a>
          <a href="#process" style={{ color: 'var(--black)', textDecoration: 'none' }}>Process</a>
          <a href="#contact" style={{ color: 'var(--black)', textDecoration: 'none' }}>Contact</a>
          <Link href="/customer-portal" style={{ color: 'var(--blue)', textDecoration: 'none' }}>Submit Inquiry</Link>
          <Link href="/feedback" style={{ color: 'var(--green)', textDecoration: 'none' }}>Submit Feedback</Link>
          <Link href="/login" style={{ padding: '8px 16px', background: 'var(--black)', color: 'var(--white)', borderRadius: 4, textDecoration: 'none' }}>Sales Portal Login</Link>
        </div>
      </nav>

      {/* Hero / Home */}
      <section id="home" style={{ padding: '120px 48px', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-app)' }}>
        <h1 style={{ fontSize: 64, fontWeight: 700, margin: '0 0 24px', letterSpacing: -1 }}>
          The Smart CRM for <br/><span style={{ color: 'var(--accent)' }}>Modern Sales Teams</span>
        </h1>
        <p style={{ fontSize: 20, color: 'var(--gray4)', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.5 }}>
          Turn data into deals with real-time forecasting, AI suggestions, and automated workflows.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <Link href="/login" style={{ padding: '16px 32px', background: 'var(--accent)', color: 'var(--white)', fontSize: 18, fontWeight: 600, borderRadius: 6, textDecoration: 'none' }}>
            Enter Sales Dashboard
          </Link>
          <Link href="/customer-portal" style={{ padding: '16px 32px', background: 'var(--white)', color: 'var(--black)', border: '2px solid var(--black)', fontSize: 18, fontWeight: 600, borderRadius: 6, textDecoration: 'none' }}>
            Customer Inquiry Portal
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '100px 48px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 40, textAlign: 'center', marginBottom: 64 }}>Powerful Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, maxWidth: 1200, margin: '0 auto' }}>
          {[
            { title: 'Pipeline Forecasts', desc: 'Realtime insights into expected revenues based on AI win probabilities.' },
            { title: 'Smart Deal Scoring', desc: 'Prioritize your outreach dynamically with AI-driven engagement scores.' },
            { title: 'Workflow Automations', desc: 'Set up customized outreach routines based on time and status triggers.' },
            { title: 'Customer Segmentation', desc: 'Drill down dynamically via tags, retention, and lifecycle parameters.' },
          ].map(f => (
            <div key={f.title} style={{ padding: 32, border: '2px solid var(--border)', background: 'var(--bg-app)', borderRadius: 8 }}>
              <h3 style={{ fontSize: 24, margin: '0 0 16px' }}>{f.title}</h3>
              <p style={{ color: 'var(--gray4)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" style={{ padding: '100px 48px', background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 40, marginBottom: 24 }}>About NexCRM</h2>
          <p style={{ fontSize: 18, color: 'var(--gray4)', lineHeight: 1.6 }}>
            We believe that sales teams spend too much time managing data instead of building relationships. 
            NexCRM was built to bridge the gap between heavy, clunky CRM tools and lightweight spreadsheets. 
            By integrating generative AI, predictive scoring, and automated task assignments, we empower sellers 
            to focus exactly on what matters—closing deals and retaining happy customers.
          </p>
        </div>
      </section>

      {/* Process */}
      <section id="process" style={{ padding: '100px 48px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 40, textAlign: 'center', marginBottom: 64 }}>How It Works</h2>
        <div style={{ display: 'flex', gap: 32, maxWidth: 1000, margin: '0 auto', flexDirection: 'column' }}>
          {[
            { step: '1', title: 'Capture the Lead', desc: 'Customers submit their inquiries directly through the Customer Portal. Leads auto-populate in the dashboard.' },
            { step: '2', title: 'AI Scoring & Insights', desc: 'The system instantly reads sentiment and assigns a smart deal score, calculating win probability.' },
            { step: '3', title: 'Actionable Outreach', desc: 'Following AI suggestions, sales teams perform the next best action and track progression on the pipeline board.' },
            { step: '4', title: 'Analyze & Retain', desc: 'Get transparent insights into conversions and monitor accounts for churn risk to deploy retention campaigns.' },
          ].map(p => (
            <div key={p.step} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{ width: 48, height: 48, background: 'var(--black)', color: 'var(--white)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                {p.step}
              </div>
              <div>
                <h3 style={{ fontSize: 24, margin: '0 0 8px' }}>{p.title}</h3>
                <p style={{ color: 'var(--gray4)', fontSize: 18 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: '100px 48px', background: 'var(--black)', color: 'var(--white)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 40, marginBottom: 24 }}>Get In Touch</h2>
        <p style={{ fontSize: 18, color: '#aaa', margin: '0 auto 48px', maxWidth: 600 }}>
          Have questions or want to learn more about how NexCRM can scale your operations? Drop us a message.
        </p>
        <Link href="mailto:hello@nexcrm.com" style={{ display: 'inline-block', padding: '16px 48px', background: 'var(--white)', color: 'var(--black)', fontSize: 18, fontWeight: 700, borderRadius: 6, textDecoration: 'none' }}>
          hello@nexcrm.com
        </Link>
      </section>
    </div>
  );
}
