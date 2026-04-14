import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
=============================================================
QUOTEKARO — SUPABASE DATABASE SCHEMA
Run this SQL in your Supabase SQL editor to set up the database.
=============================================================

-- 1. TENANTS (each shop is a tenant)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  gst_number TEXT,
  assigned_brands TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (staff + owners + superadmin)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'owner', 'staff')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BRANDS
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCT CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MASTER PRODUCTS (superadmin controlled)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  sku_code TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  mrp NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CUSTOM PRODUCTS (tenant-specific, visible to superadmin)
CREATE TABLE custom_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  name TEXT NOT NULL,
  category_name TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  mrp NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DISCOUNT TIERS (per tenant)
CREATE TABLE discount_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('bronze', 'silver', 'gold')),
  category_id UUID REFERENCES categories(id),
  category_name TEXT,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CONTACTS (customers + plumbers — ALL visible to superadmin)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('homeowner', 'plumber', 'contractor')),
  address TEXT,
  area TEXT,
  city TEXT,
  referred_by UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. QUOTES
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  quote_number TEXT NOT NULL,
  customer_id UUID REFERENCES contacts(id),
  plumber_id UUID REFERENCES contacts(id),
  tier_applied TEXT CHECK (tier_applied IN ('bronze', 'silver', 'gold')),
  subtotal NUMERIC(10,2),
  gst_amount NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  mrp_total NUMERIC(10,2),
  commission_total NUMERIC(10,2),
  expiry_days INTEGER DEFAULT 15,
  expiry_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  rejection_reason TEXT,
  pdf_customer_url TEXT,
  pdf_internal_url TEXT,
  whatsapp_sent BOOLEAN DEFAULT false,
  whatsapp_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. QUOTE ITEMS
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  custom_product_id UUID REFERENCES custom_products(id),
  product_name TEXT NOT NULL,
  brand_name TEXT,
  category_name TEXT,
  unit TEXT,
  qty NUMERIC(10,2) NOT NULL,
  mrp NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  net_rate NUMERIC(10,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  commission_percent NUMERIC(5,2) DEFAULT 0,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ACTIVITY LOG (everything a tenant does — visible to superadmin)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY POLICIES
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tenant data
CREATE POLICY "tenant_isolation_users" ON users
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin');

CREATE POLICY "tenant_isolation_contacts" ON contacts
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin');

CREATE POLICY "tenant_isolation_quotes" ON quotes
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin');

CREATE POLICY "tenant_isolation_custom_products" ON custom_products
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin');

CREATE POLICY "tenant_isolation_discount_tiers" ON discount_tiers
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin');

-- All users can read master products (filtered by assigned brands in app layer)
CREATE POLICY "products_readable" ON products
  FOR SELECT USING (true);

-- Activity log: tenants see own, superadmin sees all
CREATE POLICY "activity_log_policy" ON activity_log
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin');
*/
