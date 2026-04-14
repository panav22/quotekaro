import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const StatCard = ({ icon, label, value, sub, color = '#f97316' }) => (
  <div style={{ background: '#0d1422', borderRadius: 14, padding: '18px', border: '1px solid #1a2540', flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{sub}</div>}
  </div>
);

const OwnerDashboard = ({ onNavigate }) => {
  const { tenant, profile } = useAuth();
  const [stats, setStats] = useState({ total_quoted: 0, total_converted: 0, commission: 0, pending: 0, accepted: 0, rejected: 0, total_quotes: 0 });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => { if (tenant) loadStats(); }, [tenant, period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const from = new Date();
      if (period === 'week') from.setDate(from.getDate() - 7);
      else if (period === 'month') from.setMonth(from.getMonth() - 1);
      else from.setFullYear(from.getFullYear() - 1);

      const { data: quotes } = await supabase
        .from('quotes')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('created_at', from.toISOString());

      if (quotes) {
        const accepted = quotes.filter(q => q.status === 'accepted');
        setStats({
          total_quoted: quotes.reduce((s, q) => s + (q.total_amount || 0), 0),
          total_converted: accepted.reduce((s, q) => s + (q.total_amount || 0), 0),
          commission: quotes.reduce((s, q) => s + (q.commission_total || 0), 0),
          pending: quotes.filter(q => q.status === 'sent' || q.status === 'draft').length,
          accepted: accepted.length,
          rejected: quotes.filter(q => q.status === 'rejected').length,
          total_quotes: quotes.length,
        });
      }

      const { data: recent } = await supabase
        .from('quotes')
        .select(`*, contacts!quotes_customer_id_fkey(full_name, phone)`)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentQuotes(recent || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const conversionRate = stats.total_quotes > 0 ? Math.round((stats.accepted / stats.total_quotes) * 100) : 0;

  const statusColor = { draft: '#475569', sent: '#38bdf8', accepted: '#4ade80', rejected: '#f87171' };
  const statusLabel = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected' };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>
            Welcome, {profile?.full_name?.split(' ')[0]}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{tenant?.shop_name} · {tenant?.city}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['week', 'month', 'year'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              border: period === p ? '1px solid #f97316' : '1px solid #1e3a5f',
              background: period === p ? 'rgba(249,115,22,0.1)' : '#0d1422',
              color: period === p ? '#f97316' : '#475569',
              fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
              fontFamily: "'DM Sans', sans-serif",
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard icon="📋" label="Total Quoted" value={fmt(stats.total_quoted)} sub={`${stats.total_quotes} quotes`} color="#38bdf8" />
        <StatCard icon="✅" label="Converted" value={fmt(stats.total_converted)} sub={`${conversionRate}% conversion`} color="#4ade80" />
        <StatCard icon="💰" label="Commission" value={fmt(stats.commission)} sub="This period" color="#f97316" />
        <StatCard icon="⏳" label="Pending" value={stats.pending} sub="Awaiting response" color="#fbbf24" />
      </div>

      {/* Conversion bar */}
      <div style={{ background: '#0d1422', borderRadius: 14, padding: '18px', border: '1px solid #1a2540', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Quote Conversion</span>
          <span style={{ fontSize: 13, color: '#475569' }}>{stats.accepted} accepted · {stats.rejected} rejected · {stats.pending} pending</span>
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
          {stats.total_quotes > 0 && <>
            <div style={{ width: `${(stats.accepted / stats.total_quotes) * 100}%`, background: '#4ade80', borderRadius: '4px 0 0 4px', minWidth: stats.accepted > 0 ? 4 : 0 }} />
            <div style={{ width: `${(stats.rejected / stats.total_quotes) * 100}%`, background: '#f87171', minWidth: stats.rejected > 0 ? 4 : 0 }} />
            <div style={{ width: `${(stats.pending / stats.total_quotes) * 100}%`, background: '#475569', borderRadius: '0 4px 4px 0', minWidth: stats.pending > 0 ? 4 : 0 }} />
          </>}
          {stats.total_quotes === 0 && <div style={{ width: '100%', background: '#1e3a5f' }} />}
        </div>
      </div>

      {/* Recent Quotes */}
      <div style={{ background: '#0d1422', borderRadius: 14, border: '1px solid #1a2540', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #0f1e38', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#fff' }}>Recent Quotes</span>
          <button onClick={() => onNavigate('quotes')} style={{ fontSize: 12, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading...</div>
        ) : recentQuotes.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
            No quotes yet. <button onClick={() => onNavigate('new-quote')} style={{ color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Create your first quote →</button>
          </div>
        ) : recentQuotes.map(q => (
          <div key={q.id} style={{ padding: '14px 20px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
                {q.contacts?.full_name || 'Unknown'} — {q.quote_number}
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                {new Date(q.created_at).toLocaleDateString('en-IN')} · {q.contacts?.phone}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>
                ₹{Math.round(q.total_amount || 0).toLocaleString('en-IN')}
              </div>
              <div style={{
                display: 'inline-block', marginTop: 3,
                padding: '2px 8px', borderRadius: 20,
                background: `${statusColor[q.status] || '#475569'}18`,
                fontSize: 10, fontWeight: 600,
                color: statusColor[q.status] || '#475569',
              }}>
                {statusLabel[q.status] || q.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OwnerDashboard;
