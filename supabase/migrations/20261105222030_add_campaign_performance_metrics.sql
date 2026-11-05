ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS currency_label text NOT NULL DEFAULT '' CHECK (char_length(currency_label) <= 20),
  ADD COLUMN IF NOT EXISTS budget_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  ADD COLUMN IF NOT EXISTS spend_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (spend_amount >= 0),
  ADD COLUMN IF NOT EXISTS impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  ADD COLUMN IF NOT EXISTS clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  ADD COLUMN IF NOT EXISTS leads bigint NOT NULL DEFAULT 0 CHECK (leads >= 0),
  ADD COLUMN IF NOT EXISTS conversions bigint NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  ADD COLUMN IF NOT EXISTS revenue_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (revenue_amount >= 0);
