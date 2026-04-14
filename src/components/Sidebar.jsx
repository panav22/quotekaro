import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = {
  superadmin: [
    { icon: '⚡', label: 'Overview', key: 'overview' },
    { icon: '🏪', label: 'Tenants', key: 'tenants' },
    { icon: '📦', label: 'Master Catalogue', key: 'catalogue' },
    { icon: '🏷️', label: 'Brands', key: 'brands' },
    { icon: '📋', label: 'All Quotes', key: 'all-quotes' },
    { icon: '👥', label: 'All Contacts', key: 'all-contacts' },
    { icon: '📊', label: 'Analytics', key: 'analytics' },
    { icon: '🗂️', label: 'Activity Log', key: 'activity-log' },
  ],
  owner: [
    { icon: '📊', label: 'Dashboard', key: 'dashboard' },
    { icon: '📋', label: 'Quotes', key: 'quotes' },
    { icon: '➕', label: 'New Quote', key: 'new-quote', highlight: true },
    { icon: '👥', label: 'Contacts', key: 'contacts' },
    { icon: '💰', label: 'Commission', key: 'commission' },
    { icon: '📦', label: 'My Catalogue', key: 'catalogue' },
    { icon: '🎚️', label: 'Pricing Tiers', key: 'tiers' },
    { icon: '👤', label: 'Staff', key: 'staff' },
  ],
  staff: [
    { icon: '➕', label: 'New Quote', key: 'new-quote', highlight: true },
    { icon: '📋', label: 'My Quotes', key: 'quotes' },
    { icon: '👥', label: 'Contacts', key: 'contacts' },
    { icon: '📦', label: 'Catalogue', key: 'catalogue' },
  ],
};

const Sidebar = ({ activePage, onNavigate }) => {
  const { profile, tenant, signOut, isSuperAdmin, isOwner } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const role = profile?.role || 'staff';
  const navItems = NAV_ITEMS[role] || NAV_ITEMS.staff;

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); } catch (e) { console.error(e); }
    setSigningOut(false);
  };

  const shopName = isSuperAdmin ? 'QuoteKaro Admin' : tenant?.shop_name || 'Your Shop';
  const roleLabel = isSuperAdmin ? 'Super Admin' : isOwner ? 'Owner' : 'Staff';
  const roleColor = isSuperAdmin ? '#f97316' : isOwner ? '#38bdf8' : '#a3e635';

  return (
    <div style={{
      width: 220,
      minHeight: '100vh',
      background: '#080f1e',
      borderRight: '1px solid #0f1e38',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px',
        borderBottom: '1px solid #0f1e38',
      }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '-0.5px',
        }}>
          Quote<span style={{ color: '#f97316' }}>Karo</span>
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
          Smart Quotation Platform
        </div>
      </div>

      {/* Shop / User Info */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #0f1e38',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', lineHeight: 1.3 }}>
          {shopName}
        </div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
          {profile?.full_name}
        </div>
        <div style={{
          display: 'inline-block',
          marginTop: 6,
          padding: '2px 8px',
          borderRadius: 20,
          background: `${roleColor}18`,
          border: `1px solid ${roleColor}40`,
          fontSize: 10,
          fontWeight: 600,
          color: roleColor,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {roleLabel}
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const isActive = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: item.highlight && !isActive
                  ? 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.1))'
                  : isActive
                  ? 'linear-gradient(135deg, #f97316, #ea580c)'
                  : 'transparent',
                color: isActive ? '#fff' : item.highlight ? '#f97316' : '#64748b',
                fontSize: 13,
                fontWeight: isActive || item.highlight ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 2,
                transition: 'all 0.15s',
                borderLeft: item.highlight && !isActive ? '2px solid #f97316' : '2px solid transparent',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#0d1422'; e.currentTarget.style.color = '#e2e8f0'; }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = item.highlight ? 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.1))' : 'transparent';
                  e.currentTarget.style.color = item.highlight ? '#f97316' : '#64748b';
                }
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid #0f1e38' }}>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #1a2540',
            background: 'transparent',
            color: '#475569',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#0d1422'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }}
        >
          <span>🚪</span>
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
