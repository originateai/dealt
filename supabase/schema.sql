-- ============================================
-- DEALT.COM.AU — Supabase Schema
-- Run this in your new Supabase SQL Editor
-- ============================================

-- DEALS table
CREATE TABLE IF NOT EXISTS deals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  address         TEXT NOT NULL,
  finance_type    TEXT NOT NULL,
  loan_amount     NUMERIC(15,2),
  security_value  NUMERIC(15,2),
  rate_from       NUMERIC(5,2),
  max_lvr         NUMERIC(5,2),
  loan_term_months INT DEFAULT 12,
  establishment_fee_pct NUMERIC(5,4) DEFAULT 0.01,
  line_fee_pct    NUMERIC(5,4) DEFAULT 0,
  context_note    TEXT,
  broker_name     TEXT DEFAULT 'James Storey',
  broker_phone    TEXT,
  broker_email    TEXT DEFAULT 'info@dealt.com.au',
  hero_image_url  TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- LEADS table
CREATE TABLE IF NOT EXISTS leads (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id               UUID REFERENCES deals(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  mobile                TEXT NOT NULL,
  email                 TEXT NOT NULL,
  funding_table_requested BOOLEAN DEFAULT false,
  doc_urls              JSONB DEFAULT '[]',
  hubspot_synced        BOOLEAN DEFAULT false,
  hubspot_contact_id    TEXT,
  hubspot_deal_id       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- DEAL VIEWS table (analytics)
CREATE TABLE IF NOT EXISTS deal_views (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id    UUID REFERENCES deals(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_hash    TEXT
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_deals_slug ON deals(slug);
CREATE INDEX IF NOT EXISTS idx_leads_deal_id ON leads(deal_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_deal_views_deal_id ON deal_views(deal_id);

-- ROW LEVEL SECURITY
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_views ENABLE ROW LEVEL SECURITY;

-- Public can read active deals (for flyer page)
CREATE POLICY "Public read active deals"
  ON deals FOR SELECT
  USING (is_active = true);

-- Service key can do everything (Netlify functions use service key)
-- leads + deal_views are insert-only for anon, read for service key
CREATE POLICY "Anyone can insert leads"
  ON leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert views"
  ON deal_views FOR INSERT
  WITH CHECK (true);

-- SUPABASE STORAGE — create bucket for documents
-- Run this after creating the bucket named 'deal-documents' in the Supabase dashboard:
-- Storage > New Bucket > Name: "deal-documents" > Public: true (or private + signed URLs)

-- ============================================
-- ENV VARS needed in Netlify:
-- SUPABASE_URL=https://your-project.supabase.co
-- SUPABASE_SERVICE_KEY=your-service-role-key
-- HUBSPOT_PRIVATE_APP_TOKEN=your-hubspot-token
-- GOOGLE_MAPS_API_KEY=your-google-maps-key
-- ============================================
