import React from 'react';

const LoadingScreen = ({ message = 'Loading...' }) => (
  <div style={{
    minHeight: '100vh',
    background: '#080f1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 16,
  }}>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
    <div style={{
      width: 48, height: 48,
      border: '3px solid #1e3a5f',
      borderTop: '3px solid #f97316',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      color: '#475569',
      fontSize: 14,
    }}>{message}</div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingScreen;