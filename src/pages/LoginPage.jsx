import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginPage = ({ onLoginSuccess }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim().toLowerCase(), password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080f1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Background geometric accents */}
      <div style={{
        position: 'absolute', top: -120, right: -120,
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, left: -80,
        width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: 420,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 60, height: 60,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(249,115,22,0.3)',
          }}>
            <span style={{ fontSize: 28 }}>📋</span>
          </div>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 32,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-1px',
          }}>
            Quote<span style={{ color: '#f97316' }}>Karo</span>
          </div>
          <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
            Smart Quotation Platform
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#0d1422',
          border: '1px solid #1a2540',
          borderRadius: 20,
          padding: '32px 28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 6,
          }}>
            Welcome back
          </div>
          <div style={{ color: '#475569', fontSize: 13, marginBottom: 28 }}>
            Sign in to your QuoteKaro account
          </div>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@yourshop.com"
                autoComplete="email"
                style={{
                  width: '100%',
                  background: '#080f1e',
                  border: `1px solid ${error ? '#ef4444' : '#1e3a5f'}`,
                  borderRadius: 10,
                  padding: '13px 16px',
                  color: '#e2e8f0',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#f97316'}
                onBlur={e => e.target.style.borderColor = error ? '#ef4444' : '#1e3a5f'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    background: '#080f1e',
                    border: `1px solid ${error ? '#ef4444' : '#1e3a5f'}`,
                    borderRadius: 10,
                    padding: '13px 44px 13px 16px',
                    color: '#e2e8f0',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#f97316'}
                  onBlur={e => e.target.style.borderColor = error ? '#ef4444' : '#1e3a5f'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: '#475569', cursor: 'pointer', fontSize: 16,
                    padding: 0,
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#2a0f0f',
                border: '1px solid #7f1d1d',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 18,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#1e2d52' : 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'opacity 0.2s, transform 0.1s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(249,115,22,0.3)',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => { if (!loading) e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <>
                  <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                  Signing in...
                </>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid #0f1e38',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#334155' }}>
              Access is by invitation only.
            </div>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
              Contact your administrator to get access.
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: '#1e3a5f', fontSize: 12 }}>
          QuoteKaro © 2026
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LoginPage;
