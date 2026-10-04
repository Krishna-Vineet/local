import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const SupportWidget = () => {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, subject, message } = form;
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/api/support`, {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        ticketType: 'end_user',
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ name: '', email: '', subject: '', message: '' });
    setSubmitted(false);
    setError('');
  };

  return (
    <>
      {/* Floating Button */}
      <button
        id="support-widget-btn"
        onClick={() => { setOpen(prev => !prev); if (submitted) handleReset(); }}
        aria-label="Open support"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          width: 54, height: 54, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', cursor: 'pointer', color: '#fff',
          boxShadow: '0 6px 24px rgba(99,102,241,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.25s, box-shadow 0.25s',
          transform: open ? 'rotate(45deg) scale(1.05)' : 'scale(1)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.5)'; }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        )}
      </button>

      {/* Pulse ring */}
      {!open && (
        <span style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 8999,
          width: 54, height: 54, borderRadius: '50%',
          border: '2px solid rgba(99,102,241,0.4)',
          animation: 'supportPulse 2s ease-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Support Panel */}
      {open && (
        <div
          ref={panelRef}
          id="support-widget-panel"
          style={{
            position: 'fixed', bottom: 90, right: 24, zIndex: 9001,
            width: 360, maxWidth: 'calc(100vw - 32px)',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: 20, border: '1px solid #334155',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
            overflow: 'hidden',
            animation: 'supportSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '18px 20px 16px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
            borderBottom: '1px solid #1e293b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  HappyPix Support
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '2px 0 0' }}>
                  We typically reply within a few hours
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '20px' }}>
            {submitted ? (
              /* Success */
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'successPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h4 style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 700, margin: '0 0 8px' }}>
                  Ticket Submitted!
                </h4>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 20px', lineHeight: '1.5' }}>
                  We've received your request and will get back to you at{' '}
                  <strong style={{ color: '#818cf8' }}>{form.email}</strong> shortly.
                </p>
                <button
                  onClick={handleReset}
                  style={{
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                    color: '#818cf8', borderRadius: 10, padding: '9px 20px',
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                >
                  Submit another request
                </button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Your Name</label>
                    <input
                      id="support-name" name="name" type="text" value={form.name}
                      onChange={handleChange} placeholder="Jane Smith" required
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#334155'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input
                      id="support-email" name="email" type="email" value={form.email}
                      onChange={handleChange} placeholder="you@email.com" required
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#334155'}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Subject</label>
                  <input
                    id="support-subject" name="subject" type="text" value={form.subject}
                    onChange={handleChange} placeholder="How can we help?" required
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Message</label>
                  <textarea
                    id="support-message" name="message" value={form.message}
                    onChange={handleChange} placeholder="Describe your issue or question…"
                    required rows={4}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5', minHeight: 80 }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>

                {error && (
                  <p style={{
                    color: '#ef4444', fontSize: '0.8rem', margin: '0 0 12px',
                    background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}>
                    {error}
                  </p>
                )}

                <button
                  id="support-submit" type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '12px',
                    background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none', borderRadius: 12, color: '#fff',
                    fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.5)'; }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.3)'; }}
                >
                  {loading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes supportPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes supportSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes successPop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        #support-widget-btn { outline: none; }
      `}</style>
    </>
  );
};

const labelStyle = {
  display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600,
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
};

const inputStyle = {
  width: '100%', padding: '9px 12px',
  background: 'rgba(15,23,42,0.8)', border: '1px solid #334155', borderRadius: 10,
  color: '#f1f5f9', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', transition: 'border-color 0.2s',
};

export default SupportWidget;
