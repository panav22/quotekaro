// ─────────────────────────────────────────────────────────────
// QUOTEKARO — REMAINING PAGE COMPONENTS
// Each is a full page. Stubs show structure; data loads from Supabase.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── SHARED UI ─────────────────────────────────────────────────
const PageHeader = ({ title, sub, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, fontFamily: "'DM Sans', sans-serif" }}>
    <div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
    {action}
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: '#0d1422', borderRadius: 14, border: '1px solid #1a2540', overflow: 'hidden', ...style }}>
    {children}
  </div>
);

const EmptyState = ({ icon, message, action }) => (
  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 14, color: '#475569', marginBottom: action ? 16 : 0 }}>{message}</div>
    {action}
  </div>
);

const inputStyle = {
  width: '100%', background: '#080f1e', border: '1px solid #1e3a5f',
  borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
};

const PrimaryBtn = ({ onClick, children, style = {} }) => (
  <button onClick={onClick} style={{
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #f97316, #ea580c)',
    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
    ...style,
  }}>{children}</button>
);

const statusColor = { draft: '#475569', sent: '#38bdf8', accepted: '#4ade80', rejected: '#f87171' };

// ── QUOTES LIST (Staff + Owner) ───────────────────────────────
export const QuotesListPage = () => {
  const { tenant, profile } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadQuotes(); }, [tenant, filter]);

  const loadQuotes = async () => {
    setLoading(true);
    let query = supabase.from('quotes')
      .select(`*, contacts!quotes_customer_id_fkey(full_name, phone)`)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setQuotes(data || []);
    setLoading(false);
  };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Quotes" sub={`${quotes.length} quotes`} />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'draft', 'sent', 'accepted', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer', textTransform: 'capitalize',
            border: filter === f ? '1px solid #f97316' : '1px solid #1e3a5f',
            background: filter === f ? 'rgba(249,115,22,0.1)' : '#0d1422',
            color: filter === f ? '#f97316' : '#475569', fontSize: 12, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>{f}</button>
        ))}
      </div>

      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading quotes..." /> :
          quotes.length === 0 ? <EmptyState icon="📋" message="No quotes found." /> :
            quotes.map(q => (
              <div key={q.id} style={{ padding: '14px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{q.contacts?.full_name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {q.quote_number} · {new Date(q.created_at).toLocaleDateString('en-IN')}
                  </div>
                  {q.rejection_reason && <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>Reason: {q.rejection_reason}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>₹{Math.round(q.total_amount || 0).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: statusColor[q.status], marginTop: 3, textTransform: 'capitalize' }}>● {q.status}</div>
                </div>
              </div>
            ))}
      </Card>
    </div>
  );
};

// ── CONTACTS PAGE (Staff + Owner) ─────────────────────────────
export const ContactsPage = () => {
  const { tenant } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ full_name: '', phone: '', type: 'homeowner', address: '', area: '', city: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadContacts(); }, [tenant]);

  const loadContacts = async () => {
    setLoading(true);
    const { data } = await supabase.from('contacts').select('*, contacts!contacts_referred_by_fkey(full_name)')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  };

  const addContact = async () => {
    if (!newContact.full_name || !newContact.phone) return;
    setSaving(true);
    await supabase.from('contacts').insert({ ...newContact, tenant_id: tenant.id });
    setShowAdd(false);
    setNewContact({ full_name: '', phone: '', type: 'homeowner', address: '', area: '', city: '' });
    setSaving(false);
    loadContacts();
  };

  const filtered = contacts.filter(c => {
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    const matchSearch = !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    return matchType && matchSearch;
  });

  const typeIcon = { homeowner: '🏠', plumber: '🔧', contractor: '🏗️' };
  const typeColor = { homeowner: '#38bdf8', plumber: '#f97316', contractor: '#a78bfa' };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Contacts" sub={`${contacts.length} contacts`}
        action={<PrimaryBtn onClick={() => setShowAdd(v => !v)}>+ Add Contact</PrimaryBtn>} />

      {/* Add form */}
      {showAdd && (
        <Card style={{ marginBottom: 20, padding: '20px' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>New Contact</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="Full Name *" value={newContact.full_name} onChange={e => setNewContact(c => ({ ...c, full_name: e.target.value }))} />
            <input style={inputStyle} placeholder="Phone *" value={newContact.phone} onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))} />
            <input style={inputStyle} placeholder="Area / Colony" value={newContact.area} onChange={e => setNewContact(c => ({ ...c, area: e.target.value }))} />
            <input style={inputStyle} placeholder="City" value={newContact.city} onChange={e => setNewContact(c => ({ ...c, city: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input style={inputStyle} placeholder="Address" value={newContact.address} onChange={e => setNewContact(c => ({ ...c, address: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['homeowner', 'plumber', 'contractor'].map(t => (
              <button key={t} onClick={() => setNewContact(c => ({ ...c, type: t }))} style={{
                flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                border: newContact.type === t ? '2px solid #f97316' : '1px solid #1e3a5f',
                background: newContact.type === t ? 'rgba(249,115,22,0.1)' : '#080f1e',
                color: newContact.type === t ? '#f97316' : '#475569', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                fontFamily: "'DM Sans', sans-serif",
              }}>{typeIcon[t]} {t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryBtn onClick={addContact}>{saving ? 'Saving...' : 'Save Contact'}</PrimaryBtn>
            <button onClick={() => setShowAdd(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #1e3a5f', background: 'transparent', color: '#475569', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </Card>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="all">All Types</option>
          <option value="homeowner">Homeowners</option>
          <option value="plumber">Plumbers</option>
          <option value="contractor">Contractors</option>
        </select>
      </div>

      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          filtered.length === 0 ? <EmptyState icon="👥" message="No contacts found." /> :
            filtered.map(c => (
              <div key={c.id} style={{ padding: '13px 18px', borderBottom: '1px solid #080f1e', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${typeColor[c.type]}18`, border: `1px solid ${typeColor[c.type]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {typeIcon[c.type]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{c.full_name}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {c.phone}{c.area ? ` · ${c.area}` : ''}{c.city ? `, ${c.city}` : ''}
                  </div>
                  {c.contacts?.full_name && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>🔧 Via: {c.contacts.full_name}</div>}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: typeColor[c.type], textTransform: 'capitalize' }}>
                  {c.type}
                </div>
              </div>
            ))}
      </Card>
    </div>
  );
};

// ── CATALOGUE PAGE (Tenant view — filtered by assigned brands) ─
export const CataloguePage = () => {
  const { tenant } = useAuth();
  const [products, setProducts] = useState([]);
  const [customProducts, setCustomProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('master');
  const [search, setSearch] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustom, setNewCustom] = useState({ name: '', category_name: '', unit: 'pcs', mrp: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProducts(); }, [tenant]);

  const loadProducts = async () => {
    setLoading(true);
    const { data: brands } = await supabase.from('brands').select('id, name').in('name', tenant?.assigned_brands || []);
    const brandIds = (brands || []).map(b => b.id);

    const { data: prods } = await supabase.from('products')
      .select(`*, brands(name), categories(name)`)
      .in('brand_id', brandIds.length ? brandIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('is_active', true).order('name');

    const { data: custom } = await supabase.from('custom_products')
      .select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('name');

    setProducts(prods || []);
    setCustomProducts(custom || []);
    setLoading(false);
  };

  const addCustomProduct = async () => {
    if (!newCustom.name || !newCustom.mrp) return;
    setSaving(true);
    await supabase.from('custom_products').insert({ ...newCustom, mrp: parseFloat(newCustom.mrp), tenant_id: tenant.id });
    setShowAddCustom(false);
    setNewCustom({ name: '', category_name: '', unit: 'pcs', mrp: '' });
    setSaving(false);
    loadProducts();
  };

  const allProds = tab === 'master' ? products : customProducts;
  const filtered = allProds.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="My Catalogue" sub={`${products.length} master + ${customProducts.length} custom products`}
        action={tab === 'custom' && <PrimaryBtn onClick={() => setShowAddCustom(v => !v)}>+ Add Custom Product</PrimaryBtn>} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['master', 'Brand Products'], ['custom', 'My Custom Products']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
            border: tab === key ? '1px solid #f97316' : '1px solid #1e3a5f',
            background: tab === key ? 'rgba(249,115,22,0.1)' : '#0d1422',
            color: tab === key ? '#f97316' : '#475569', fontSize: 12, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>{label}</button>
        ))}
      </div>

      {showAddCustom && tab === 'custom' && (
        <Card style={{ marginBottom: 20, padding: '20px' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Add Custom Product</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="Product Name *" value={newCustom.name} onChange={e => setNewCustom(c => ({ ...c, name: e.target.value }))} />
            <input style={inputStyle} placeholder="Category" value={newCustom.category_name} onChange={e => setNewCustom(c => ({ ...c, category_name: e.target.value }))} />
            <input style={inputStyle} placeholder="MRP (₹) *" type="number" value={newCustom.mrp} onChange={e => setNewCustom(c => ({ ...c, mrp: e.target.value }))} />
            <select style={inputStyle} value={newCustom.unit} onChange={e => setNewCustom(c => ({ ...c, unit: e.target.value }))}>
              {['pcs', 'length', 'kg', 'set', 'box', 'roll', 'bundle', 'litre'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryBtn onClick={addCustomProduct}>{saving ? 'Saving...' : 'Add Product'}</PrimaryBtn>
            <button onClick={() => setShowAddCustom(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #1e3a5f', background: 'transparent', color: '#475569', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </Card>
      )}

      <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />

      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          filtered.length === 0 ? <EmptyState icon="📦" message="No products found." /> :
            filtered.map(p => (
              <div key={p.id} style={{ padding: '12px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {p.brands?.name || p.category_name || 'Custom'} · {p.categories?.name || p.category_name || ''} · {p.unit}
                    {p.sku_code && ` · SKU: ${p.sku_code}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>₹{p.mrp}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>MRP</div>
                </div>
              </div>
            ))}
      </Card>
    </div>
  );
};

// ── COMMISSION PAGE (Owner only) ──────────────────────────────
export const CommissionPage = () => {
  const { tenant } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => { loadData(); }, [tenant, period]);

  const loadData = async () => {
    setLoading(true);
    const from = new Date();
    if (period === 'week') from.setDate(from.getDate() - 7);
    else if (period === 'month') from.setMonth(from.getMonth() - 1);
    else from.setFullYear(from.getFullYear() - 1);

    const { data } = await supabase.from('quotes')
      .select(`*, contacts!quotes_customer_id_fkey(full_name)`)
      .eq('tenant_id', tenant.id)
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  };

  const totalCommission = quotes.reduce((s, q) => s + (q.commission_total || 0), 0);
  const earnedCommission = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + (q.commission_total || 0), 0);

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Commission" sub="Owner access only — not visible to staff" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['week', 'month', 'year'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
            border: period === p ? '1px solid #f97316' : '1px solid #1e3a5f',
            background: period === p ? 'rgba(249,115,22,0.1)' : '#0d1422',
            color: period === p ? '#f97316' : '#475569', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
            fontFamily: "'DM Sans', sans-serif",
          }}>{p}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <div style={{ flex: 1, background: 'linear-gradient(135deg, #0f2a0f, #0a1e0a)', borderRadius: 14, padding: '20px', border: '1px solid #166534' }}>
          <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Confirmed Commission</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#4ade80' }}>
            ₹{Math.round(earnedCommission).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 11, color: '#166534', marginTop: 6 }}>From accepted quotes only</div>
        </div>
        <div style={{ flex: 1, background: '#0d1422', borderRadius: 14, padding: '20px', border: '1px solid #1a2540' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Pipeline Commission</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#94a3b8' }}>
            ₹{Math.round(totalCommission).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>All quotes incl. pending</div>
        </div>
      </div>

      <Card>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #0f1e38' }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>Quote-wise Commission</span>
        </div>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          quotes.length === 0 ? <EmptyState icon="💰" message="No commission data for this period." /> :
            quotes.map(q => (
              <div key={q.id} style={{ padding: '12px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>{q.contacts?.full_name || '—'} · {q.quote_number}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{new Date(q.created_at).toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: q.status === 'accepted' ? '#4ade80' : '#64748b' }}>
                    ₹{Math.round(q.commission_total || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 10, color: statusColor[q.status], textTransform: 'capitalize' }}>● {q.status}</div>
                </div>
              </div>
            ))}
      </Card>
    </div>
  );
};

// ── PRICING TIERS (Owner only) ─────────────────────────────────
export const PricingTiersPage = () => {
  const { tenant } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTier, setEditTier] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [tenant]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: tierData }, { data: catData }] = await Promise.all([
      supabase.from('discount_tiers').select('*').eq('tenant_id', tenant.id),
      supabase.from('categories').select('id, name').order('name'),
    ]);
    setTiers(tierData || []);
    setCategories(catData || []);
    setLoading(false);
  };

  const saveTierRow = async (tierName, categoryName, discount, commission) => {
    setSaving(true);
    const existing = tiers.find(t => t.tier_name === tierName && t.category_name === categoryName);
    if (existing) {
      await supabase.from('discount_tiers').update({ discount_percent: discount, commission_percent: commission, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('discount_tiers').insert({ tenant_id: tenant.id, tier_name: tierName, category_name: categoryName, discount_percent: discount, commission_percent: commission });
    }
    setSaving(false);
    loadData();
  };

  const getTierValue = (tierName, categoryName, field) => {
    const row = tiers.find(t => t.tier_name === tierName && t.category_name === categoryName);
    return row ? row[field] : 0;
  };

  const tierMeta = { bronze: { icon: '🥉', color: '#cd7f32' }, silver: { icon: '🥈', color: '#94a3b8' }, gold: { icon: '🥇', color: '#fbbf24' } };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Pricing Tiers" sub="Configure discount & commission % per tier per category" />

      {loading ? <EmptyState icon="⟳" message="Loading..." /> : (
        ['bronze', 'silver', 'gold'].map(tierName => (
          <Card key={tierName} style={{ marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #0f1e38', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{tierMeta[tierName].icon}</span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: tierMeta[tierName].color, textTransform: 'capitalize' }}>{tierName} Tier</span>
            </div>
            <div style={{ padding: '14px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Category</div>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Discount %</div>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Commission %</div>
              </div>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>{cat.name}</div>
                  <input type="number" min="0" max="50" step="0.5"
                    defaultValue={getTierValue(tierName, cat.name, 'discount_percent')}
                    onBlur={e => saveTierRow(tierName, cat.name, parseFloat(e.target.value) || 0, getTierValue(tierName, cat.name, 'commission_percent'))}
                    style={{ ...inputStyle, padding: '7px 10px', textAlign: 'center' }}
                  />
                  <input type="number" min="0" max="30" step="0.5"
                    defaultValue={getTierValue(tierName, cat.name, 'commission_percent')}
                    onBlur={e => saveTierRow(tierName, cat.name, getTierValue(tierName, cat.name, 'discount_percent'), parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, padding: '7px 10px', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
      {saving && <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 8 }}>Saving...</div>}
    </div>
  );
};

// ── STAFF MANAGEMENT (Owner only) ─────────────────────────────
export const StaffPage = () => {
  const { tenant } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStaff(); }, [tenant]);

  const loadStaff = async () => {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').eq('tenant_id', tenant.id).order('created_at');
    setStaff(data || []);
    setLoading(false);
  };

  const roleColor = { owner: '#38bdf8', staff: '#a3e635' };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Staff" sub="Contact admin to add or remove staff accounts" />
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          staff.length === 0 ? <EmptyState icon="👤" message="No staff accounts found." /> :
            staff.map(s => (
              <div key={s.id} style={{ padding: '14px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#0f1e38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{s.full_name}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{s.phone || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: roleColor[s.role], textTransform: 'capitalize', padding: '2px 8px', borderRadius: 20, background: `${roleColor[s.role]}18` }}>{s.role}</span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.is_active ? '#4ade80' : '#475569' }} />
                </div>
              </div>
            ))}
      </Card>
    </div>
  );
};

// ── TENANTS PAGE (SuperAdmin) ──────────────────────────────────
export const TenantsPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadTenants(); }, []);

  const loadTenants = async () => {
    setLoading(true);
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants(data || []);
    setLoading(false);
  };

  const toggleActive = async (id, current) => {
    await supabase.from('tenants').update({ is_active: !current }).eq('id', id);
    loadTenants();
  };

  const filtered = tenants.filter(t => !search || t.shop_name.toLowerCase().includes(search.toLowerCase()) || t.city?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Tenants" sub={`${tenants.length} shops registered`} />
      <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Search tenants..." value={search} onChange={e => setSearch(e.target.value)} />
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          filtered.map(t => (
            <div key={t.id} style={{ padding: '14px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0f1e38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏪</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{t.shop_name}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {t.owner_name} · {t.phone} · {t.city}
                </div>
                <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                  Brands: {t.assigned_brands?.join(', ') || 'None assigned'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: t.is_active ? '#4ade80' : '#475569' }}>
                  {t.is_active ? '● Active' : '● Inactive'}
                </span>
                <button onClick={() => toggleActive(t.id, t.is_active)} style={{
                  padding: '6px 12px', borderRadius: 8, border: '1px solid #1e3a5f',
                  background: '#0d1422', color: '#64748b', cursor: 'pointer', fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                }}>{t.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
};

// ── MASTER CATALOGUE (SuperAdmin) ─────────────────────────────
export const MasterCataloguePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku_code: '', unit: 'pcs', mrp: '', brand_id: '', category_id: '' });
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: prods }, { data: b }, { data: c }] = await Promise.all([
      supabase.from('products').select(`*, brands(name), categories(name)`).eq('is_active', true).order('name').limit(200),
      supabase.from('brands').select('id, name').eq('is_active', true),
      supabase.from('categories').select('id, name').order('name'),
    ]);
    setProducts(prods || []);
    setBrands(b || []);
    setCategories(c || []);
    setLoading(false);
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.mrp || !newProduct.brand_id) return;
    setSaving(true);
    await supabase.from('products').insert({ ...newProduct, mrp: parseFloat(newProduct.mrp) });
    setShowAdd(false);
    setNewProduct({ name: '', sku_code: '', unit: 'pcs', mrp: '', brand_id: '', category_id: '' });
    setSaving(false);
    loadData();
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brands?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Master Catalogue" sub={`${products.length} products`}
        action={<PrimaryBtn onClick={() => setShowAdd(v => !v)}>+ Add Product</PrimaryBtn>} />

      {showAdd && (
        <Card style={{ marginBottom: 20, padding: '20px' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>New Master Product</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input style={inputStyle} placeholder="Product Name *" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
            <input style={inputStyle} placeholder="SKU Code" value={newProduct.sku_code} onChange={e => setNewProduct(p => ({ ...p, sku_code: e.target.value }))} />
            <select style={inputStyle} value={newProduct.brand_id} onChange={e => setNewProduct(p => ({ ...p, brand_id: e.target.value }))}>
              <option value="">Select Brand *</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select style={inputStyle} value={newProduct.category_id} onChange={e => setNewProduct(p => ({ ...p, category_id: e.target.value }))}>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input style={inputStyle} placeholder="MRP (₹) *" type="number" value={newProduct.mrp} onChange={e => setNewProduct(p => ({ ...p, mrp: e.target.value }))} />
            <select style={inputStyle} value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}>
              {['pcs', 'length', 'kg', 'set', 'box', 'roll', 'bundle', 'litre', 'metre'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryBtn onClick={addProduct}>{saving ? 'Saving...' : 'Add to Catalogue'}</PrimaryBtn>
            <button onClick={() => setShowAdd(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #1e3a5f', background: 'transparent', color: '#475569', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </Card>
      )}

      <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Search products or brands..." value={search} onChange={e => setSearch(e.target.value)} />
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          filtered.map(p => (
            <div key={p.id} style={{ padding: '11px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {p.brands?.name} · {p.categories?.name} · {p.unit}{p.sku_code ? ` · ${p.sku_code}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>₹{p.mrp}</div>
            </div>
          ))}
      </Card>
    </div>
  );
};

// ── BRANDS (SuperAdmin) ────────────────────────────────────────
export const BrandsPage = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBrand, setNewBrand] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBrands(); }, []);

  const loadBrands = async () => {
    setLoading(true);
    const { data } = await supabase.from('brands').select('*').order('name');
    setBrands(data || []);
    setLoading(false);
  };

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    setSaving(true);
    await supabase.from('brands').insert({ name: newBrand.trim() });
    setNewBrand('');
    setSaving(false);
    loadBrands();
  };

  const toggleBrand = async (id, current) => {
    await supabase.from('brands').update({ is_active: !current }).eq('id', id);
    loadBrands();
  };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Brands" sub="Manage which brands exist in the master catalogue" />
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="New brand name (e.g. Astral, Supreme, Finolex)..." value={newBrand} onChange={e => setNewBrand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBrand()} />
        <PrimaryBtn onClick={addBrand}>{saving ? '...' : 'Add Brand'}</PrimaryBtn>
      </div>
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          brands.map(b => (
            <div key={b.id} style={{ padding: '13px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0f1e38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏷️</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{b.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: b.is_active ? '#4ade80' : '#475569' }}>{b.is_active ? '● Active' : '● Inactive'}</span>
                <button onClick={() => toggleBrand(b.id, b.is_active)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #1e3a5f', background: '#0d1422', color: '#64748b', cursor: 'pointer', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                  {b.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
};

// ── ALL QUOTES (SuperAdmin) ────────────────────────────────────
export const AllQuotesPage = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('quotes')
      .select(`*, tenants(shop_name), contacts!quotes_customer_id_fkey(full_name)`)
      .order('created_at', { ascending: false }).limit(100);
    setQuotes(data || []);
    setLoading(false);
  };

  const filtered = quotes.filter(q => !search || q.quote_number?.includes(search) || q.contacts?.full_name?.toLowerCase().includes(search.toLowerCase()) || q.tenants?.shop_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="All Quotes" sub={`${quotes.length} quotes across all tenants`} />
      <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Search by quote number, customer, or shop..." value={search} onChange={e => setSearch(e.target.value)} />
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          filtered.map(q => (
            <div key={q.id} style={{ padding: '13px 18px', borderBottom: '1px solid #080f1e', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{q.quote_number}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  <span style={{ color: '#64748b' }}>{q.tenants?.shop_name}</span> · {q.contacts?.full_name} · {new Date(q.created_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>₹{Math.round(q.total_amount || 0).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 10, color: statusColor[q.status], marginTop: 2, textTransform: 'capitalize' }}>● {q.status}</div>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
};

// ── ALL CONTACTS (SuperAdmin) ──────────────────────────────────
export const AllContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('contacts')
      .select(`*, tenants(shop_name)`)
      .order('created_at', { ascending: false }).limit(200);
    setContacts(data || []);
    setLoading(false);
  };

  const typeIcon = { homeowner: '🏠', plumber: '🔧', contractor: '🏗️' };
  const filtered = contacts.filter(c => !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.tenants?.shop_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="All Contacts" sub={`${contacts.length} contacts across all tenants`} />
      <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Search by name, phone, or shop..." value={search} onChange={e => setSearch(e.target.value)} />
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          filtered.map(c => (
            <div key={c.id} style={{ padding: '12px 18px', borderBottom: '1px solid #080f1e', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 18 }}>{typeIcon[c.type] || '👤'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{c.full_name}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {c.phone}{c.area ? ` · ${c.area}` : ''} · <span style={{ color: '#64748b' }}>{c.tenants?.shop_name}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'capitalize' }}>{c.type}</div>
            </div>
          ))}
      </Card>
    </div>
  );
};

// ── ANALYTICS (SuperAdmin) ─────────────────────────────────────
export const AnalyticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    const [{ data: quotes }, { data: contacts }, { data: tenants }] = await Promise.all([
      supabase.from('quotes').select('status, total_amount, tier_applied, created_at, rejection_reason, tenants(city)'),
      supabase.from('contacts').select('type, area, city, tenant_id'),
      supabase.from('tenants').select('city, is_active'),
    ]);

    const accepted = (quotes || []).filter(q => q.status === 'accepted');
    const rejected = (quotes || []).filter(q => q.status === 'rejected');

    // Rejection reasons
    const rejectionReasons = {};
    rejected.forEach(q => { const r = q.rejection_reason || 'unspecified'; rejectionReasons[r] = (rejectionReasons[r] || 0) + 1; });

    // Tier performance
    const tierStats = {};
    ;['bronze', 'silver', 'gold'].forEach(t => {
      const tierQuotes = (quotes || []).filter(q => q.tier_applied === t);
      const tierAccepted = tierQuotes.filter(q => q.status === 'accepted');
      tierStats[t] = { total: tierQuotes.length, accepted: tierAccepted.length, rate: tierQuotes.length > 0 ? Math.round(tierAccepted.length / tierQuotes.length * 100) : 0 };
    });

    // Cities
    const cityStats = {};
    (contacts || []).forEach(c => { const city = c.city || 'Unknown'; cityStats[city] = (cityStats[city] || 0) + 1; });

    setStats({ quotes: quotes?.length || 0, accepted: accepted.length, rejected: rejected.length, rejectionReasons, tierStats, cityStats });
    setLoading(false);
  };

  if (loading) return <div style={{ padding: '28px' }}><EmptyState icon="⟳" message="Loading analytics..." /></div>;

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Analytics" sub="Platform-wide insights" />

      {/* Tier Performance */}
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Tier Conversion Rates</div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        {Object.entries(stats?.tierStats || {}).map(([tier, data]) => {
          const colors = { bronze: '#cd7f32', silver: '#94a3b8', gold: '#fbbf24' };
          const icons = { bronze: '🥉', silver: '🥈', gold: '🥇' };
          return (
            <div key={tier} style={{ flex: 1, background: '#0d1422', borderRadius: 14, padding: '18px', border: '1px solid #1a2540' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icons[tier]}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: colors[tier] }}>{data.rate}%</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, textTransform: 'capitalize' }}>{tier} conversion</div>
              <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>{data.accepted}/{data.total} quotes</div>
            </div>
          );
        })}
      </div>

      {/* Rejection Reasons */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #0f1e38' }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>Rejection Reasons</span>
        </div>
        {Object.entries(stats?.rejectionReasons || {}).length === 0
          ? <EmptyState icon="✅" message="No rejections recorded yet." />
          : Object.entries(stats?.rejectionReasons || {}).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
            <div key={reason} style={{ padding: '12px 18px', borderBottom: '1px solid #080f1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#94a3b8', textTransform: 'capitalize' }}>{reason}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>{count} quote{count > 1 ? 's' : ''}</span>
            </div>
          ))}
      </Card>

      {/* City Distribution */}
      <Card>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #0f1e38' }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>Contacts by City</span>
        </div>
        {Object.entries(stats?.cityStats || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([city, count]) => (
          <div key={city} style={{ padding: '11px 18px', borderBottom: '1px solid #080f1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{city}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>{count} contacts</span>
          </div>
        ))}
      </Card>
    </div>
  );
};

// ── ACTIVITY LOG (SuperAdmin) ──────────────────────────────────
export const ActivityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from('activity_log')
      .select(`*, users(full_name), tenants(shop_name)`)
      .order('created_at', { ascending: false }).limit(200);
    setLogs(data || []);
    setLoading(false);
  };

  const actionIcon = { image_processed: '📷', quote_created: '📋', whatsapp_sent: '💬', quote_status_updated: '🔄', contact_created: '👤' };

  return (
    <div style={{ padding: '28px', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <PageHeader title="Activity Log" sub="Every action across all tenants" />
      <Card>
        {loading ? <EmptyState icon="⟳" message="Loading..." /> :
          logs.map(l => (
            <div key={l.id} style={{ padding: '12px 18px', borderBottom: '1px solid #080f1e', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{actionIcon[l.action] || '📌'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ color: '#f97316' }}>{l.tenants?.shop_name || 'System'}</span> · {l.users?.full_name}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{l.action.replace(/_/g, ' ')}</div>
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                    {JSON.stringify(l.metadata)}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>
                {new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
};
