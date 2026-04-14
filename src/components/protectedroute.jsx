import React from 'react';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user || !profile) return null;

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080f1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        fontFamily: "'Syne', sans-serif",
      }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 600 }}>Access Restricted</div>
        <div style={{ color: '#475569', fontSize: 14 }}>
          You don't have permission to view this page.
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;