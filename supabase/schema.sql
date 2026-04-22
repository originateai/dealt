-- ============================================================
-- DEALT.COM.AU — Complete Supabase Schema
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ── DEALS TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                  TEXT UNIQUE NOT NULL,
  address               TEXT NOT NULL,
  finance_type          TEXT NOT NULL,
  loan_amount           NUMERIC(15,2),
  security_value        NUMERIC(15,2),
  rate_from             NUMERIC(5,2),
  max_lvr               NUMERIC(5,2),
  loan_term_months      INT DEFAULT 12,
  establishment_fee_pct NUMERIC(5,4) DEFAULT 0.01,
  line_fee_pct          NUMERIC(5,4) DEFAULT 0,
  context_note          TEXT,
  broker_name           TEXT DEFAULT 'James Storey',
  broker_phone          TEXT,
  broker_email          TEXT DEFAULT 'info@dealt.com.au',
  hero_image_url        TEXT,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── LEADS TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id                  UUID REFERENCES deals(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  mobile                   TEXT NOT NULL,
  email                    TEXT NOT NULL,
  loan_type                TEXT,
  loan_size                TEXT,
  message                  TEXT,
  source                   TEXT DEFAULT 'flyer',
  funding_table_requested  BOOLEAN DEFAULT false,
  doc_urls                 JSONB DEFAULT '[]',
  hubspot_synced           BOOLEAN DEFAULT false,
  hubspot_contact_id       TEXT,
  hubspot_deal_id          TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEAL VIEWS TABLE (analytics) ─────────────────────────────
CREATE TABLE IF NOT EXISTS deal_views (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id    UUID REFERENCES deals(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_hash    TEXT
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deals_slug        ON deals(slug);
CREATE INDEX IF NOT EXISTS idx_leads_deal_id     ON leads(deal_id);
CREATE INDEX IF NOT EXISTS idx_leads_email       ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_source      ON leads(source);
CREATE INDEX IF NOT EXISTS idx_deal_views_deal_id ON deal_views(deal_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE deals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_views ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public read active deals"  ON deals;
DROP POLICY IF EXISTS "Anyone can insert leads"   ON leads;
DROP POLICY IF EXISTS "Anyone can insert views"   ON deal_views;
DROP POLICY IF EXISTS "Auth users read leads"     ON leads;
DROP POLICY IF EXISTS "Auth users read deals"     ON deals;
DROP POLICY IF EXISTS "Auth users manage deals"   ON deals;

-- Public can read active deals (flyer page)
CREATE POLICY "Public read active deals"
  ON deals FOR SELECT
  USING (is_active = true);

-- Anyone can submit a lead (website + flyer forms)
CREATE POLICY "Anyone can insert leads"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Anyone can log a view
CREATE POLICY "Anyone can insert views"
  ON deal_views FOR INSERT
  WITH CHECK (true);

-- Authenticated users (admin) can read all leads
CREATE POLICY "Auth users read leads"
  ON leads FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can read all deals
CREATE POLICY "Auth users read deals"
  ON deals FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert/update/delete deals
CREATE POLICY "Auth users manage deals"
  ON deals FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── ADMIN USER ───────────────────────────────────────────────
-- After running this script, create your admin user in:
-- Supabase Dashboard → Authentication → Users → Add User
-- Email: info@dealt.com.au
-- Set a strong password
-- That user can then log into dealt.com.au/admin/login.html

-- ── STORAGE ──────────────────────────────────────────────────
-- Create storage bucket manually in Supabase Dashboard:
-- Storage → New Bucket → Name: "deal-documents" → Public: ON

-- ── ENV VARS FOR NETLIFY ─────────────────────────────────────
-- Site configuration → Environment variables:
-- SUPABASE_URL         = https://your-project.supabase.co
-- SUPABASE_SERVICE_KEY = your sb_secret_... key
-- GOOGLE_MAPS_API_KEY  = your google maps key (optional)
-- HUBSPOT_PRIVATE_APP_TOKEN = your hubspot token (optional)
