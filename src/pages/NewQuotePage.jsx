import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── CONSTANTS ────────────────────────────────────────────────
const STEPS = [
  { key: 'customer', label: 'Customer', icon: '👤' },
  { key: 'upload',   label: 'Upload',   icon: '📷' },
  { key: 'review',   label: 'Review',   icon: '✏️' },
  { key: 'pricing',  label: 'Pricing',  icon: '🎚️' },
  { key: 'finalise', label: 'Finalise', icon: '✅' },
  { key: 'output',   label: 'Output',   icon: '📤' },
];

const GST_RATE = 0.18;

// ─── HELPERS ──────────────────────────────────────────────────
const generateQuoteNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `QK-${y}${m}-${rand}`;
};

const callClaudeVision = async (base64Image, productList) => {
  const productNames = productList.map(p => `${p.id}|${p.name}|${p.brand_name}|${p.category_name}|${p.unit}`).join('\n');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
          },
          {
            type: 'text',
            text: `You are a plumbing product identification assistant. Analyze this handwritten list image and extract all plumbing products mentioned with their quantities.

Match each item to the closest product from this catalogue (format: id|name|brand|category|unit):
${productNames}

Return ONLY valid JSON, no other text. Format:
{
  "items": [
    {
      "productId": "product id from catalogue or null if no match",
      "productName": "name as written in image",
      "matchedName": "matched catalogue product name or null",
      "qty": number,
      "unit": "unit",
      "confidence": 0.0-1.0,
      "rawText": "exact text from image for this item"
    }
  ]
}

If a product doesn't match the catalogue, set productId to null and fill productName with what you read.
Be conservative with confidence scores. Only give >0.9 if the match is very clear.`,
          },
        ],
      }],
    }),
  });
  const data = await response.json();
  const text = data.content?.map(c => c.text || '').join('') || '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

// ─── STEP INDICATOR ───────────────────────────────────────────
const StepIndicator = ({ currentStep }) => {
  const currentIdx = STEPS.findIndex(s => s.key === currentStep);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              minWidth: 64,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: done ? '#166534' : active ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#0f1e38',
                border: `2px solid ${done ? '#4ade80' : active ? '#f97316' : '#1e3a5f'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 14 : 16,
                color: done ? '#4ade80' : '#fff',
                boxShadow: active ? '0 0 16px rgba(249,115,22,0.4)' : 'none',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : step.icon}
              </div>
              <div style={{
                fontSize: 10, color: active ? '#f97316' : done ? '#4ade80' : '#334155',
                fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap',
              }}>{step.label}</div>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 20,
                background: done ? '#166534' : '#0f1e38',
                marginBottom: 22, transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── FIELD COMPONENT ─────────────────────────────────────────
const Field = ({ label, children, style = {} }) => (
  <div style={{ marginBottom: 16, ...style }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', background: '#080f1e', border: '1px solid #1e3a5f',
  borderRadius: 10, padding: '11px 14px', color: '#e2e8f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

// ─── MAIN COMPONENT ──────────────────────────────────────────
const NewQuotePage = () => {
  const { profile, tenant, logActivity } = useAuth();
  const [step, setStep] = useState('customer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Customer data
  const [customer, setCustomer] = useState({ id: null, full_name: '', phone: '', type: 'homeowner', address: '', area: '', city: tenant?.city || '' });
  const [plumber, setPlumber] = useState({ id: null, full_name: '', phone: '', link: false });
  const [savedContacts, setSavedContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');

  // Step 2: Upload
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef();

  // Step 3: Extracted items
  const [extractedItems, setExtractedItems] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [customProducts, setCustomProducts] = useState([]);

  // Step 4: Pricing
  const [tiers, setTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState('');
  const [categoryDiscounts, setCategoryDiscounts] = useState({});
  const [expiryDays, setExpiryDays] = useState(15);

  // Step 5+: Quote
  const [quoteNumber] = useState(generateQuoteNumber());

  // Load catalogue + tiers + contacts on mount
  useEffect(() => {
    if (tenant) {
      loadCatalogue();
      loadTiers();
      loadContacts();
    }
  }, [tenant]);

  const loadCatalogue = async () => {
    const { data: products } = await supabase
      .from('products')
      .select(`*, brands(name), categories(name)`)
      .in('brand_id', await getAssignedBrandIds())
      .eq('is_active', true);

    const { data: custom } = await supabase
      .from('custom_products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);

    setCatalogue((products || []).map(p => ({
      id: p.id, name: p.name, brand_name: p.brands?.name || '',
      category_name: p.categories?.name || '', unit: p.unit, mrp: p.mrp,
      sku_code: p.sku_code, is_custom: false,
    })));
    setCustomProducts((custom || []).map(p => ({
      id: p.id, name: p.name, brand_name: 'Custom', category_name: p.category_name || 'Custom',
      unit: p.unit, mrp: p.mrp, is_custom: true,
    })));
  };

  const getAssignedBrandIds = async () => {
    if (!tenant?.assigned_brands?.length) return ['00000000-0000-0000-0000-000000000000'];
    const { data } = await supabase.from('brands').select('id').in('name', tenant.assigned_brands);
    return data?.map(b => b.id) || [];
  };

  const loadTiers = async () => {
    const { data } = await supabase
      .from('discount_tiers')
      .select('*')
      .eq('tenant_id', tenant.id);
    setTiers(data || []);
  };

  const loadContacts = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setSavedContacts(data || []);
  };

  // ── STEP 1: Save / select contact ────────────────────────────
  const saveOrGetContact = async (contactData) => {
    if (contactData.id) return contactData.id;
    const { data, error } = await supabase.from('contacts').insert({
      tenant_id: tenant.id,
      full_name: contactData.full_name,
      phone: contactData.phone,
      type: contactData.type,
      address: contactData.address,
      area: contactData.area,
      city: contactData.city,
    }).select().single();
    if (error) throw error;
    return data.id;
  };

  const handleCustomerNext = async () => {
    if (!customer.full_name || !customer.phone) { setError('Customer name and phone are required.'); return; }
    setError('');
    setStep('upload');
  };

  // ── STEP 2: Image Upload ──────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      const base64 = ev.target.result.split(',')[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessImage = async () => {
    if (!imageBase64) { setError('Please upload an image first.'); return; }
    setProcessing(true);
    setError('');
    try {
      const allProducts = [...catalogue, ...customProducts];
      const result = await callClaudeVision(imageBase64, allProducts);
      const enriched = (result.items || []).map(item => {
        const matched = allProducts.find(p => p.id === item.productId);
        return {
          ...item,
          product: matched || null,
          qty: item.qty || 1,
          discount_percent: 0,
          commission_percent: 0,
          net_rate: matched ? matched.mrp : 0,
          remarks: '',
        };
      });
      setExtractedItems(enriched);
      await logActivity('image_processed', 'quote', null, { quote_number: quoteNumber, items_count: enriched.length });
      setStep('review');
    } catch (err) {
      setError('AI extraction failed. Please try again or add items manually.');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  // ── STEP 3: Review ────────────────────────────────────────────
  const updateItem = (idx, field, value) => {
    setExtractedItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === 'discount_percent' || field === 'mrp') {
        updated.net_rate = parseFloat(updated.mrp || 0) * (1 - parseFloat(updated.discount_percent || 0) / 100);
      }
      return updated;
    }));
  };

  const removeItem = (idx) => setExtractedItems(prev => prev.filter((_, i) => i !== idx));

  const addProductManually = (productId) => {
    const allProducts = [...catalogue, ...customProducts];
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    setExtractedItems(prev => [...prev, {
      productId: product.id, productName: product.name, matchedName: product.name,
      qty: 1, unit: product.unit, confidence: 1, rawText: 'manually added',
      product, discount_percent: 0, commission_percent: 0, net_rate: product.mrp, remarks: '',
    }]);
  };

  // ── STEP 4: Apply Tier ────────────────────────────────────────
  const applyTier = (tierName) => {
    setSelectedTier(tierName);
    const tierData = tiers.filter(t => t.tier_name === tierName);
    const newDiscounts = {};
    tierData.forEach(t => { newDiscounts[t.category_name] = { discount: t.discount_percent, commission: t.commission_percent }; });
    setCategoryDiscounts(newDiscounts);

    // Apply to items
    setExtractedItems(prev => prev.map(item => {
      const cat = item.product?.category_name || 'Custom';
      const d = newDiscounts[cat] || { discount: 0, commission: 0 };
      return {
        ...item,
        discount_percent: d.discount,
        commission_percent: d.commission,
        net_rate: (item.product?.mrp || item.mrp || 0) * (1 - d.discount / 100),
      };
    }));
  };

  // ── CALCULATIONS ──────────────────────────────────────────────
  const calcTotals = () => {
    const subtotal = extractedItems.reduce((s, it) => s + (it.net_rate * it.qty), 0);
    const mrpTotal = extractedItems.reduce((s, it) => s + ((it.product?.mrp || 0) * it.qty), 0);
    const gst = subtotal * GST_RATE;
    const total = subtotal + gst;
    const commission = extractedItems.reduce((s, it) => s + (it.net_rate * it.qty * (it.commission_percent / 100)), 0);
    return { subtotal, mrpTotal, gst, total, commission };
  };

  // ── STEP 5: Save Quote ────────────────────────────────────────
  const finaliseQuote = async () => {
    setSaving(true);
    setError('');
    try {
      const totals = calcTotals();
      const customerId = await saveOrGetContact(customer);
      let plumberId = null;
      if (plumber.link && plumber.full_name && plumber.phone) {
        plumberId = await saveOrGetContact({ ...plumber, type: 'plumber' });
        // Link plumber to customer as referral
        await supabase.from('contacts').update({ referred_by: plumberId }).eq('id', customerId);
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      const { data: quote, error: qErr } = await supabase.from('quotes').insert({
        tenant_id: tenant.id,
        quote_number: quoteNumber,
        customer_id: customerId,
        plumber_id: plumberId,
        tier_applied: selectedTier || null,
        subtotal: totals.subtotal,
        gst_amount: totals.gst,
        total_amount: totals.total,
        mrp_total: totals.mrpTotal,
        commission_total: totals.commission,
        expiry_days: expiryDays,
        expiry_date: expiryDate.toISOString().split('T')[0],
        status: 'draft',
        created_by: profile.id,
      }).select().single();
      if (qErr) throw qErr;

      // Save line items
      const lineItems = extractedItems.map(item => ({
        quote_id: quote.id,
        product_id: item.product?.is_custom ? null : (item.product?.id || null),
        custom_product_id: item.product?.is_custom ? item.product?.id : null,
        product_name: item.product?.name || item.productName,
        brand_name: item.product?.brand_name || '',
        category_name: item.product?.category_name || '',
        unit: item.product?.unit || item.unit || 'pcs',
        qty: item.qty,
        mrp: item.product?.mrp || 0,
        discount_percent: item.discount_percent || 0,
        net_rate: item.net_rate,
        amount: item.net_rate * item.qty,
        commission_percent: item.commission_percent || 0,
        commission_amount: item.net_rate * item.qty * (item.commission_percent / 100),
        remarks: item.remarks || '',
      }));

      const { error: liErr } = await supabase.from('quote_items').insert(lineItems);
      if (liErr) throw liErr;

      await logActivity('quote_created', 'quote', quote.id, { quote_number: quoteNumber, total: totals.total });
      setStep('output');
    } catch (err) {
      setError('Failed to save quote: ' + err.message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totals = calcTotals();

  // ── MARGIN CHECK ──────────────────────────────────────────────
  const hasMarginWarning = extractedItems.some(it => it.discount_percent > 30);

  // ── RENDER ────────────────────────────────────────────────────
  const allProducts = [...catalogue, ...customProducts];

  return (
    <div style={{ padding: '28px', maxWidth: 800, margin: '0 auto', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          New Quotation
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>#{quoteNumber}</div>
      </div>

      {/* Step Indicator */}
      <div style={{ marginBottom: 32 }}>
        <StepIndicator currentStep={step} />
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: '#2a0f0f', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>⚠️</span>
          <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ── STEP 1: CUSTOMER ── */}
      {step === 'customer' && (
        <div>
          <SectionCard title="Customer Details" icon="🏠">
            {/* Customer type */}
            <Field label="Customer Type">
              <div style={{ display: 'flex', gap: 8 }}>
                {['homeowner', 'contractor'].map(t => (
                  <button key={t} onClick={() => setCustomer(c => ({ ...c, type: t }))} style={{
                    flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                    border: customer.type === t ? '2px solid #f97316' : '1px solid #1e3a5f',
                    background: customer.type === t ? 'rgba(249,115,22,0.1)' : '#080f1e',
                    color: customer.type === t ? '#f97316' : '#475569',
                    fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>{t === 'homeowner' ? '🏠' : '🏗️'} {t}</button>
                ))}
              </div>
            </Field>

            {/* Search saved contacts */}
            <Field label="Search Saved Contacts">
              <input
                style={inputStyle} placeholder="Search by name or phone..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
              />
              {contactSearch && (
                <div style={{ marginTop: 6, background: '#080f1e', border: '1px solid #1e3a5f', borderRadius: 8, overflow: 'hidden' }}>
                  {savedContacts.filter(c => c.type !== 'plumber' && (c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch))).slice(0, 5).map(c => (
                    <div key={c.id} onClick={() => { setCustomer({ ...c }); setContactSearch(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #0f1e38', fontSize: 13, color: '#94a3b8' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#0d1422'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {c.full_name} — {c.phone}
                    </div>
                  ))}
                </div>
              )}
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Full Name *">
                <input style={inputStyle} value={customer.full_name} onChange={e => setCustomer(c => ({ ...c, full_name: e.target.value }))} placeholder="e.g. Ramesh Sharma" />
              </Field>
              <Field label="Phone *">
                <input style={inputStyle} value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} placeholder="9876543210" type="tel" />
              </Field>
            </div>
            <Field label="Site Address">
              <input style={inputStyle} value={customer.address} onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))} placeholder="Flat / House / Plot no., Street" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Area / Colony">
                <input style={inputStyle} value={customer.area} onChange={e => setCustomer(c => ({ ...c, area: e.target.value }))} placeholder="e.g. Dharampeth" />
              </Field>
              <Field label="City">
                <input style={inputStyle} value={customer.city} onChange={e => setCustomer(c => ({ ...c, city: e.target.value }))} placeholder="e.g. Nagpur" />
              </Field>
            </div>
          </SectionCard>

          {/* Plumber linkage */}
          <SectionCard title="Link Plumber (Optional)" icon="🔧" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input type="checkbox" id="linkPlumber" checked={plumber.link} onChange={e => setPlumber(p => ({ ...p, link: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#f97316' }} />
              <label htmlFor="linkPlumber" style={{ fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                This quote was referred by a plumber
              </label>
            </div>
            {plumber.link && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Plumber Name">
                  <input style={inputStyle} value={plumber.full_name} onChange={e => setPlumber(p => ({ ...p, full_name: e.target.value }))} placeholder="Plumber's name" />
                </Field>
                <Field label="Plumber Phone">
                  <input style={inputStyle} value={plumber.phone} onChange={e => setPlumber(p => ({ ...p, phone: e.target.value }))} placeholder="Plumber's phone" type="tel" />
                </Field>
              </div>
            )}
          </SectionCard>

          <NavButtons onNext={handleCustomerNext} nextLabel="Next: Upload Image →" />
        </div>
      )}

      {/* ── STEP 2: UPLOAD ── */}
      {step === 'upload' && (
        <div>
          <SectionCard title="Upload Handwritten List" icon="📷">
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: '2px dashed #1e3a5f', borderRadius: 14,
                padding: imagePreview ? '12px' : '48px 24px',
                textAlign: 'center', cursor: 'pointer',
                background: '#080f1e',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e3a5f'}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Uploaded list" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 10, objectFit: 'contain' }} />
                  <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>Tap to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 14 }}>📷</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Tap to upload image</div>
                  <div style={{ fontSize: 12, color: '#334155' }}>Photo of handwritten list, notebook page, or whiteboard</div>
                  <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>JPG, PNG, HEIC supported</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

            <div style={{ marginTop: 14, padding: '12px 14px', background: '#0a1628', borderRadius: 10, border: '1px solid #1e3a5f' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                <strong style={{ color: '#94a3b8' }}>Tips for best results:</strong> Good lighting · Keep image flat · Ensure text is clearly visible · Avoid blur
              </div>
            </div>
          </SectionCard>

          <NavButtons
            onBack={() => setStep('customer')}
            onNext={handleProcessImage}
            nextLabel={processing ? 'AI is reading...' : 'Extract Items with AI →'}
            nextDisabled={!imageBase64 || processing}
            nextLoading={processing}
          />
        </div>
      )}

      {/* ── STEP 3: REVIEW ── */}
      {step === 'review' && (
        <div>
          <SectionCard title={`Review Extracted Items (${extractedItems.length})`} icon="✏️">
            {extractedItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#475569', fontSize: 14 }}>
                No items extracted. Add products manually below.
              </div>
            )}
            {extractedItems.map((item, idx) => (
              <div key={idx} style={{
                background: '#080f1e', borderRadius: 12, padding: '14px',
                border: `1px solid ${item.confidence < 0.8 ? '#7f3a1a' : '#0f1e38'}`,
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Confidence badge */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                    background: item.confidence >= 0.9 ? '#0f3025' : item.confidence >= 0.8 ? '#2a1f0a' : '#2a1215',
                    border: `1px solid ${item.confidence >= 0.9 ? '#166534' : item.confidence >= 0.8 ? '#854d0e' : '#7f1d1d'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: item.confidence >= 0.9 ? '#4ade80' : item.confidence >= 0.8 ? '#fbbf24' : '#f87171',
                  }}>
                    {Math.round(item.confidence * 100)}%
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Product select */}
                    <select
                      value={item.product?.id || ''}
                      onChange={e => {
                        const p = allProducts.find(pr => pr.id === e.target.value);
                        updateItem(idx, 'product', p || null);
                        if (p) updateItem(idx, 'net_rate', p.mrp);
                      }}
                      style={{ ...selectStyle, marginBottom: 8 }}
                    >
                      <option value="">— Select product —</option>
                      {allProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.brand_name}) — ₹{p.mrp}</option>)}
                    </select>

                    {item.rawText && (
                      <div style={{ fontSize: 11, color: '#334155', marginBottom: 8, fontStyle: 'italic' }}>Read: "{item.rawText}"</div>
                    )}

                    {/* Qty + Remarks */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ width: 100 }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>QTY</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => updateItem(idx, 'qty', Math.max(1, item.qty - 1))} style={{ width: 28, height: 32, background: '#0d1422', border: '1px solid #1e3a5f', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>−</button>
                          <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 1)}
                            style={{ ...inputStyle, width: 44, padding: '4px 6px', textAlign: 'center' }} />
                          <button onClick={() => updateItem(idx, 'qty', item.qty + 1)} style={{ width: 28, height: 32, background: '#0d1422', border: '1px solid #1e3a5f', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>+</button>
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>REMARKS / NOTES</div>
                        <input value={item.remarks} onChange={e => updateItem(idx, 'remarks', e.target.value)}
                          placeholder="Substitution note, alternative, etc." style={{ ...inputStyle, padding: '6px 10px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>
                      ₹{((item.product?.mrp || 0) * item.qty).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155' }}>MRP</div>
                    <button onClick={() => removeItem(idx)} style={{ marginTop: 8, width: 28, height: 28, borderRadius: 6, border: 'none', background: '#2a1215', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add product manually */}
            <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
              <select defaultValue="" onChange={e => { if (e.target.value) { addProductManually(e.target.value); e.target.value = ''; } }} style={selectStyle}>
                <option value="">+ Add product manually...</option>
                {allProducts.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.mrp} ({p.brand_name})</option>)}
              </select>
            </div>
          </SectionCard>

          <NavButtons onBack={() => setStep('upload')} onNext={() => setStep('pricing')} nextLabel="Next: Set Pricing →" nextDisabled={extractedItems.length === 0} />
        </div>
      )}

      {/* ── STEP 4: PRICING ── */}
      {step === 'pricing' && (
        <div>
          <SectionCard title="Pricing Configuration" icon="🎚️">
            {/* Tier selection */}
            <Field label="Select Discount Tier">
              <div style={{ display: 'flex', gap: 10 }}>
                {['bronze', 'silver', 'gold'].map(tier => (
                  <button key={tier} onClick={() => applyTier(tier)} style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: selectedTier === tier ? `2px solid ${tier === 'gold' ? '#fbbf24' : tier === 'silver' ? '#94a3b8' : '#cd7f32'}` : '1px solid #1e3a5f',
                    background: selectedTier === tier ? `${tier === 'gold' ? 'rgba(251,191,36,0.1)' : tier === 'silver' ? 'rgba(148,163,184,0.1)' : 'rgba(205,127,50,0.1)'}` : '#080f1e',
                    color: selectedTier === tier ? (tier === 'gold' ? '#fbbf24' : tier === 'silver' ? '#94a3b8' : '#cd7f32') : '#475569',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : '🥉'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{tier}</div>
                    <div style={{ fontSize: 10, marginTop: 3, color: '#475569' }}>
                      {tiers.filter(t => t.tier_name === tier).length} categories
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            {/* Category discounts — editable override */}
            {extractedItems.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Discount Override Per Category
                </div>
                {[...new Set(extractedItems.map(it => it.product?.category_name || 'Custom'))].map(cat => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 160, fontSize: 13, color: '#94a3b8' }}>{cat}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="0" max="50" value={categoryDiscounts[cat]?.discount || 0}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setCategoryDiscounts(prev => ({ ...prev, [cat]: { ...prev[cat], discount: val } }));
                          setExtractedItems(prev => prev.map(it => {
                            if ((it.product?.category_name || 'Custom') !== cat) return it;
                            return { ...it, discount_percent: val, net_rate: (it.product?.mrp || 0) * (1 - val / 100) };
                          }));
                        }}
                        style={{ ...inputStyle, width: 70, padding: '7px 10px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 12, color: '#475569' }}>% disc</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="0" max="30" value={categoryDiscounts[cat]?.commission || 0}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setCategoryDiscounts(prev => ({ ...prev, [cat]: { ...prev[cat], commission: val } }));
                          setExtractedItems(prev => prev.map(it => {
                            if ((it.product?.category_name || 'Custom') !== cat) return it;
                            return { ...it, commission_percent: val };
                          }));
                        }}
                        style={{ ...inputStyle, width: 70, padding: '7px 10px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 12, color: '#475569' }}>% comm</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Margin warning */}
            {hasMarginWarning && (
              <div style={{ background: '#2a1f0a', border: '1px solid #854d0e', borderRadius: 10, padding: '12px 14px', marginTop: 8 }}>
                <div style={{ fontSize: 13, color: '#fbbf24', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>⚠️</span> High discount warning — one or more items exceed 30% discount.
                </div>
              </div>
            )}

            {/* Expiry */}
            <Field label="Quote Validity" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[7, 15, 30].map(d => (
                  <button key={d} onClick={() => setExpiryDays(d)} style={{
                    flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                    border: expiryDays === d ? '2px solid #f97316' : '1px solid #1e3a5f',
                    background: expiryDays === d ? 'rgba(249,115,22,0.1)' : '#080f1e',
                    color: expiryDays === d ? '#f97316' : '#475569',
                    fontSize: 13, fontWeight: expiryDays === d ? 600 : 400,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>{d} Days</button>
                ))}
              </div>
            </Field>

            {/* Summary */}
            <div style={{ marginTop: 16, background: '#080f1e', borderRadius: 12, padding: '16px', border: '1px solid #0f1e38' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#475569' }}>Subtotal (Net)</span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>₹{totals.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#475569' }}>GST (18%)</span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>₹{totals.gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #0f1e38' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Syne', sans-serif" }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#f97316', fontFamily: "'Syne', sans-serif" }}>
                  ₹{totals.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </SectionCard>

          <NavButtons onBack={() => setStep('review')} onNext={() => setStep('finalise')} nextLabel="Review & Finalise →" />
        </div>
      )}

      {/* ── STEP 5: FINALISE ── */}
      {step === 'finalise' && (
        <div>
          <SectionCard title="Final Review" icon="✅">
            {/* Customer summary */}
            <div style={{ background: '#080f1e', borderRadius: 10, padding: '14px', border: '1px solid #0f1e38', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{customer.full_name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{customer.phone} · {customer.area}, {customer.city}</div>
              {plumber.link && plumber.full_name && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>🔧 Via: {plumber.full_name} ({plumber.phone})</div>}
            </div>

            {/* Items summary */}
            <div style={{ border: '1px solid #0f1e38', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ background: '#080f1e', padding: '10px 14px', borderBottom: '1px solid #0f1e38' }}>
                <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{extractedItems.length} Items</span>
                {selectedTier && <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: '#f97316', textTransform: 'capitalize' }}>· {selectedTier} Tier</span>}
              </div>
              {extractedItems.map((item, idx) => (
                <div key={idx} style={{ padding: '10px 14px', borderBottom: '1px solid #080f1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{item.product?.name || item.productName}</div>
                    <div style={{ fontSize: 11, color: '#334155' }}>
                      {item.qty} {item.product?.unit || 'pcs'} · MRP ₹{item.product?.mrp} · {item.discount_percent}% off
                      {item.remarks && <span style={{ color: '#475569' }}> · {item.remarks}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>₹{(item.net_rate * item.qty).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ background: '#080f1e', borderRadius: 10, padding: '14px', border: '1px solid #0f1e38', marginBottom: 14 }}>
              {[
                { label: 'Subtotal', value: `₹${totals.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                { label: 'GST (18%)', value: `₹${totals.gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                { label: `Valid for ${expiryDays} days`, value: '', muted: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: row.muted ? '#334155' : '#64748b' }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #0f1e38' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'Syne', sans-serif" }}>Total (incl. GST)</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#f97316', fontFamily: "'Syne', sans-serif" }}>
                  ₹{totals.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: '#0a1628', borderRadius: 8, border: '1px solid #1e3a5f', fontSize: 12, color: '#475569' }}>
              ⚠️ Once confirmed, pricing cannot be edited. Go back to make changes.
            </div>
          </SectionCard>

          <NavButtons
            onBack={() => setStep('pricing')}
            onNext={finaliseQuote}
            nextLabel={saving ? 'Saving...' : 'Confirm & Generate Quote ✓'}
            nextLoading={saving}
            nextDisabled={saving}
            nextColor="linear-gradient(135deg, #166534, #15803d)"
          />
        </div>
      )}

      {/* ── STEP 6: OUTPUT ── */}
      {step === 'output' && (
        <div>
          <div style={{ textAlign: 'center', padding: '24px 0 32px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Quote Generated!
            </div>
            <div style={{ fontSize: 14, color: '#475569' }}>#{quoteNumber} · ₹{totals.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>

          <SectionCard title="Send to Customer" icon="📤">
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <ActionButton icon="💬" label="Send via WhatsApp" color="#25D366" onClick={() => {
                const msg = encodeURIComponent(`Dear ${customer.full_name}, please find your quotation #${quoteNumber} from ${tenant?.shop_name || 'our shop'} for ₹${Math.round(totals.total).toLocaleString('en-IN')}. Valid for ${expiryDays} days. Subject to stock availability.`);
                window.open(`https://wa.me/91${customer.phone}?text=${msg}`, '_blank');
                logActivity('whatsapp_sent', 'quote', null, { quote_number: quoteNumber });
              }} />
              <ActionButton icon="📄" label="Download PDF" color="#38bdf8" onClick={() => window.print()} />
            </div>
            <div style={{ background: '#0a1628', borderRadius: 10, padding: '12px 14px', border: '1px solid #1e3a5f', fontSize: 12, color: '#64748b' }}>
              Customer receives: itemised list with amounts, GST, total, expiry date.<br />
              Commission and margin details are on the internal copy only (owner access).
            </div>
          </SectionCard>

          <SectionCard title="Quote Status" icon="📊" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {['accepted', 'rejected'].map(status => (
                <button key={status} onClick={async () => {
                  let reason = null;
                  if (status === 'rejected') reason = window.prompt('Rejection reason (price / competitor / delay / other):');
                  await supabase.from('quotes').update({ status, rejection_reason: reason }).eq('quote_number', quoteNumber);
                  await logActivity('quote_status_updated', 'quote', null, { quote_number: quoteNumber, status });
                  alert(`Quote marked as ${status}`);
                }} style={{
                  flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${status === 'accepted' ? '#166534' : '#7f1d1d'}`,
                  background: status === 'accepted' ? 'rgba(22,101,52,0.15)' : 'rgba(127,29,29,0.15)',
                  color: status === 'accepted' ? '#4ade80' : '#f87171',
                  fontSize: 13, fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {status === 'accepted' ? '✅ Mark Accepted' : '❌ Mark Rejected'}
                </button>
              ))}
            </div>
          </SectionCard>

          <button onClick={() => window.location.reload()} style={{
            marginTop: 20, width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            border: 'none', borderRadius: 12, color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            + Create Another Quote
          </button>
        </div>
      )}
    </div>
  );
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────
const SectionCard = ({ title, icon, children, style = {} }) => (
  <div style={{ background: '#0d1422', borderRadius: 16, padding: '20px', border: '1px solid #1a2540', ...style }}>
    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{icon}</span>{title}
    </div>
    {children}
  </div>
);

const NavButtons = ({ onBack, onNext, nextLabel, nextDisabled, nextLoading, nextColor }) => (
  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
    {onBack && (
      <button onClick={onBack} style={{
        padding: '14px 20px', borderRadius: 12, border: '1px solid #1e3a5f',
        background: '#0d1422', color: '#64748b', fontSize: 14, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}>← Back</button>
    )}
    <button
      onClick={onNext}
      disabled={nextDisabled}
      style={{
        flex: 1, padding: '14px',
        background: nextDisabled ? '#1e2d52' : nextColor || 'linear-gradient(135deg, #f97316, #ea580c)',
        border: 'none', borderRadius: 12, color: '#fff',
        fontSize: 15, fontWeight: 600, cursor: nextDisabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: nextDisabled ? 'none' : '0 4px 16px rgba(249,115,22,0.25)',
      }}
    >
      {nextLoading && <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>}
      {nextLabel}
    </button>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ActionButton = ({ icon, label, color, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: '14px', borderRadius: 12, cursor: 'pointer',
    border: `1px solid ${color}40`,
    background: `${color}15`,
    color, fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.15s',
  }}
    onMouseEnter={e => e.currentTarget.style.background = `${color}25`}
    onMouseLeave={e => e.currentTarget.style.background = `${color}15`}
  >
    {icon} {label}
  </button>
);

export default NewQuotePage;
