import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── EXCEL PARSER ─────────────────────────────────────────────
// Reads the QuoteKaro product upload template
// Uses SheetJS (xlsx) loaded from CDN via script tag

const loadSheetJS = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(script);
  });
};

const parseExcel = async (file) => {
  const XLSX = await loadSheetJS();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Row 3 is headers, data starts row 5 (skip title, subtitle, headers, guide)
        const data = XLSX.utils.sheet_to_json(ws, { range: 3, defval: '' });
        resolve(data);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Normalize column names — handle variations
const getVal = (row, ...keys) => {
  for (const key of keys) {
    const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
    if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
  }
  return '';
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
const ExcelUpload = ({ mode = 'tenant', onUploadComplete }) => {
  const { tenant, logActivity } = useAuth();
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) {
      setError('Please upload a .xlsx file only.');
      return;
    }
    setFile(f);
    setError('');
    setResults(null);
    try {
      const rows = await parseExcel(f);
      // Filter out empty rows and the guide row
      const valid = rows.filter(r => getVal(r, 'Product Name *', 'Product Name') && getVal(r, 'MRP (₹) *', 'MRP'));
      setPreview(valid.slice(0, 5));
      setProgress({ current: 0, total: valid.length, status: `${valid.length} products found in file` });
    } catch (err) {
      setError('Could not read file. Make sure you are using the QuoteKaro template.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResults(null);

    try {
      const rows = await parseExcel(file);
      const validRows = rows.filter(r => getVal(r, 'Product Name *', 'Product Name') && getVal(r, 'MRP (₹) *', 'MRP'));

      let added = 0;
      let skipped = 0;
      let errors = 0;

      if (mode === 'superadmin') {
        // ── SUPER ADMIN: Insert into master products table ──
        // Cache brands and categories to avoid repeated DB calls
        const brandCache = {};
        const categoryCache = {};

        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          setProgress({ current: i + 1, total: validRows.length, status: `Processing ${i + 1} of ${validRows.length}...` });

          const brandName = getVal(row, 'Brand *', 'Brand');
          const categoryName = getVal(row, 'Category *', 'Category');
          const productName = getVal(row, 'Product Name *', 'Product Name');
          const size = getVal(row, 'Size');
          const alias = getVal(row, 'Alias');
          const fuzzyNames = getVal(row, 'Fuzzy Names\n(Regional/Hindi/Marathi)', 'Fuzzy Names', 'Fuzzy Names (Regional/Hindi/Marathi)');
          const skuCode = getVal(row, 'SKU Code');
          const unit = getVal(row, 'Unit *', 'Unit') || 'pcs';
          const mrp = parseFloat(getVal(row, 'MRP (₹) *', 'MRP') || '0');
          const gst = parseFloat(getVal(row, 'GST %', 'GST') || '18');
          const hsn = getVal(row, 'HSN Code', 'HSN');
          const description = getVal(row, 'Description');

          if (!productName || !mrp) { skipped++; continue; }

          try {
            // Get or create brand
            if (brandName && !brandCache[brandName]) {
              let { data: existingBrand } = await supabase.from('brands').select('id').eq('name', brandName).single();
              if (!existingBrand) {
                const { data: newBrand } = await supabase.from('brands').insert({ name: brandName, is_active: true }).select().single();
                existingBrand = newBrand;
              }
              if (existingBrand) brandCache[brandName] = existingBrand.id;
            }

            // Get or create category
            const catKey = `${brandName}_${categoryName}`;
            if (categoryName && !categoryCache[catKey]) {
              let { data: existingCat } = await supabase.from('categories').select('id').eq('name', categoryName).single();
              if (!existingCat) {
                const { data: newCat } = await supabase.from('categories').insert({ name: categoryName, brand_id: brandCache[brandName] || null }).select().single();
                existingCat = newCat;
              }
              if (existingCat) categoryCache[catKey] = existingCat.id;
            }

            const fullName = size ? `${productName} ${size}` : productName;

            // Check for duplicate
            const { data: existing } = await supabase.from('products')
              .select('id').eq('name', fullName)
              .eq('brand_id', brandCache[brandName] || null)
              .single();

            if (existing) { skipped++; continue; }

            // Insert product
            await supabase.from('products').insert({
              name: fullName,
              sku_code: skuCode || null,
              brand_id: brandCache[brandName] || null,
              category_id: categoryCache[catKey] || null,
              unit,
              mrp,
              alias: alias || null,
              fuzzy_names: fuzzyNames || null,
              gst_percent: gst || 18,
              hsn_code: hsn || null,
              description: description || null,
              is_active: true,
            });
            added++;
          } catch (err) {
            console.error('Row error:', err, row);
            errors++;
          }
        }

      } else {
        // ── TENANT: Insert into custom_products table ──
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          setProgress({ current: i + 1, total: validRows.length, status: `Processing ${i + 1} of ${validRows.length}...` });

          const brandName = getVal(row, 'Brand *', 'Brand');
          const categoryName = getVal(row, 'Category *', 'Category');
          const productName = getVal(row, 'Product Name *', 'Product Name');
          const size = getVal(row, 'Size');
          const alias = getVal(row, 'Alias');
          const fuzzyNames = getVal(row, 'Fuzzy Names\n(Regional/Hindi/Marathi)', 'Fuzzy Names', 'Fuzzy Names (Regional/Hindi/Marathi)');
          const skuCode = getVal(row, 'SKU Code');
          const unit = getVal(row, 'Unit *', 'Unit') || 'pcs';
          const mrp = parseFloat(getVal(row, 'MRP (₹) *', 'MRP') || '0');
          const gst = parseFloat(getVal(row, 'GST %', 'GST') || '18');
          const hsn = getVal(row, 'HSN Code', 'HSN');
          const description = getVal(row, 'Description');

          if (!productName || !mrp) { skipped++; continue; }

          try {
            const fullName = size ? `${productName} ${size}` : productName;

            // Check for duplicate in this tenant's custom products
            const { data: existing } = await supabase.from('custom_products')
              .select('id').eq('name', fullName).eq('tenant_id', tenant.id).single();

            if (existing) { skipped++; continue; }

            await supabase.from('custom_products').insert({
              tenant_id: tenant.id,
              name: fullName,
              brand_name: brandName || null,
              category_name: categoryName || null,
              unit,
              mrp,
              alias: alias || null,
              fuzzy_names: fuzzyNames || null,
              gst_percent: gst || 18,
              hsn_code: hsn || null,
              description: description || null,
              is_active: true,
            });
            added++;
          } catch (err) {
            console.error('Row error:', err, row);
            errors++;
          }
        }
      }

      await logActivity('excel_upload', 'products', null, { mode, added, skipped, errors, filename: file.name });

      setResults({ added, skipped, errors, total: validRows.length });
      setProgress({ current: validRows.length, total: validRows.length, status: 'Upload complete' });

      if (added > 0 && onUploadComplete) {
        setTimeout(onUploadComplete, 2000);
      }

    } catch (err) {
      setError('Upload failed: ' + err.message);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* File drop zone */}
      {!results && (
        <>
          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${file ? '#f97316' : '#1e3a5f'}`,
              borderRadius: 12, padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', background: '#080f1e', marginBottom: 14,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.borderColor = file ? '#f97316' : '#1e3a5f'}
          >
            {file ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f97316' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{progress.status}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Click to select Excel file</div>
                <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>.xlsx format only — use the QuoteKaro template</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileSelect} />

          {/* Preview */}
          {preview.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Preview — first {preview.length} rows:</div>
              <div style={{ background: '#080f1e', borderRadius: 10, border: '1px solid #1e3a5f', overflow: 'hidden' }}>
                {preview.map((row, i) => {
                  const name = getVal(row, 'Product Name *', 'Product Name');
                  const size = getVal(row, 'Size');
                  const brand = getVal(row, 'Brand *', 'Brand');
                  const mrp = getVal(row, 'MRP (₹) *', 'MRP');
                  return (
                    <div key={i} style={{ padding: '9px 14px', borderBottom: '1px solid #0f1e38', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#e2e8f0' }}>{name}{size ? ` ${size}` : ''}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{brand}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>₹{mrp}</div>
                    </div>
                  );
                })}
                {progress.total > 5 && (
                  <div style={{ padding: '9px 14px', fontSize: 12, color: '#475569', textAlign: 'center' }}>
                    ...and {progress.total - 5} more products
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#2a0f0f', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#fca5a5' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Upload button */}
          {file && !uploading && (
            <button
              onClick={handleUpload}
              style={{
                width: '100%', padding: '13px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none', borderRadius: 10, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Upload {progress.total} Products →
            </button>
          )}

          {/* Progress bar */}
          {uploading && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{progress.status}</span>
                <span style={{ fontSize: 12, color: '#f97316' }}>{progressPercent}%</span>
              </div>
              <div style={{ height: 8, background: '#0f1e38', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #f97316, #ea580c)',
                  width: `${progressPercent}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 6, textAlign: 'center' }}>
                Please do not close this window
              </div>
            </div>
          )}
        </>
      )}

      {/* Results */}
      {results && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 8 }}>
              Upload Complete
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Added', value: results.added, color: '#4ade80', bg: '#0f3025' },
              { label: 'Skipped (duplicates)', value: results.skipped, color: '#fbbf24', bg: '#2a1f0a' },
              { label: 'Errors', value: results.errors, color: '#f87171', bg: '#2a1215' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setFile(null); setPreview([]); setResults(null); setProgress({ current: 0, total: 0, status: '' }); }}
            style={{
              width: '100%', padding: '11px', borderRadius: 10,
              border: '1px solid #1e3a5f', background: '#0d1422',
              color: '#64748b', cursor: 'pointer', fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
};

export default ExcelUpload;
