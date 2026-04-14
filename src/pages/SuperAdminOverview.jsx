import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const StatCard = ({ icon, label, value, color = '#f97316' }) => (
  <div style={{ background: '#0d1422', borderRadius: 14, padding: '20px', border: '1px solid #1a2540', flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
  </div>
);

const SuperAdminOverview = ({ onNavigate }) => {
  const [stats, setStats] = useState({ tenants: 0, quotes: 0, contacts: 0, revenue: 0, active_tenants: 0 });
  const [recentTenants, setRecentTenants] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ count: tenantCount }, { count: quoteCount }, { count: contactCount }, { data: tenants }, { data: activity }] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('quotes').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('tenants').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('activity_log').select(`*, users(full_name), tenants(shop_name)`).order('created_at', { ascending: false }).limit(10),
      ]);

      const { data: revenueData } = await supabase.from('quotes').select('total_amount').eq('status', 'accepted');
      const revenue = (revenueData || []).reduce((s, q) => s + (q.total_amount || 0), 0);

      setStats({ tenants: tenantCount || 0, quotes: quoteCount || 0, contacts: contactCount || 0, revenue, active_tenants: (tenants || []).filter(t => t.is_active).length });
      setRecentTenants(tenants || []);
      setRecentActivity(activity || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const activityIcon = { image_processed: '📷', quote_created: '📋', whatsapp_sent: '💬', quote_status_updated: '🔄' };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#fff' }}>
          Quote<span style={{ color: '#f97316' }}>Karo</span> Admin
        </div>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Platform-wide overview</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard icon="🏪" label="Total Tenants" value={stats.tenants} color="#f97316" />
        <StatCard icon="✅" label="Active Tenants" value={stats.active_tenants} color="#4ade80" />
        <StatCard icon="📋" label="Total Quotes" value={stats.quotes} color="#38bdf8" />
        <StatCard icon="👥" label="Total Contacts" value={stats.contacts} color="#a78bfa" />
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
        <div style={{ flex: 1, background: 'linear-gradient(135deg, #0f2a0f, #0a1e0a)', borderRadius: 14, padding: '20px', border: '1px solid #166534' }}>
          <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Platform GMV (Accepted)</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#4ade80' }}>
            ₹{Math.round(stats.revenue).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Tenants */}
        <div style={{ background: '#0d1422', borderRadius: 14, border: '1px solid #1a2540', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #0f1e38', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>Recent Tenants</span>
            <button onClick={() => onNavigate('tenants')} style={{ fontSize: 11, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          {loading ? <div style={{ padding: '20px', color: '#475569', fontSize: 13, textAlign: 'center' }}>Loading...</div>
            : recentTenants.map(t => (
              <div key={t.id} style={{ padding: '12px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0f1e38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏪</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.shop_name}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{t.city}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.is_active ? '#4ade80' : '#475569', flexShrink: 0 }} />
              </div>
            ))}
        </div>

        {/* Activity Log */}
        <div style={{ background: '#0d1422', borderRadius: 14, border: '1px solid #1a2540', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #0f1e38', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>Live Activity</span>
            <button onClick={() => onNavigate('activity-log')} style={{ fontSize: 11, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          {loading ? <div style={{ padding: '20px', color: '#475569', fontSize: 13, textAlign: 'center' }}>Loading...</div>
            : recentActivity.map(a => (
              <div key={a.id} style={{ padding: '10px 18px', borderBottom: '1px solid #080f1e', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{activityIcon[a.action] || '📌'}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>{a.tenants?.shop_name || 'System'}</span> · {a.users?.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                    {a.action.replace(/_/g, ' ')} · {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminOverview;
