-- Stripe subscription state for featured placement. `featured` (from 0008) stays
-- the effective flag the feed reads; the webhook keeps it in sync with the
-- subscription status.

ALTER TABLE partner_profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE partner_profiles ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE partner_profiles ADD COLUMN subscription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_partner_profiles_customer ON partner_profiles(stripe_customer_id);
