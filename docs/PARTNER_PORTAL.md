# Restaurant Partner Portal

A configuration website where restaurants set up their profile (claim their
Google listing, add a description, and upload photos).
Those photos + a `featured` flag flow back into the app's Explore feed.

- **Portal URL:** `https://<your-worker-domain>/partners`
- **Served by:** the existing `sushi-party-api` Worker (`api/src/index.ts`), so
  there is no separate site to host.

## One-time setup (Cloudflare)

The portal needs an R2 bucket for photo storage and the new D1 tables.

```bash
cd api

# 1. Create the R2 bucket (binding is already declared in wrangler.jsonc as PHOTOS).
npx wrangler r2 bucket create sushi-party-photos

# 2. Apply the partner schema migration to the production D1 database.
npx wrangler d1 migrations apply sushi-party --remote

# 3. Deploy the Worker (also activates the Google ratings field-mask + /partners).
npx wrangler deploy
```

No public-bucket configuration is required: photos are streamed back through the
Worker at `/partners/photos/<id>`, so nothing in R2 is exposed directly.

## How it fits together

- **Partners** sign up / log in on the portal (`partner_accounts`, password-hashed
  like app users, tokens namespaced `partner:<id>`).
- They **claim their restaurant** via Google Places search; the chosen place id is
  stored on `partner_profiles.place_id`.
- **Photos** upload to R2 (`partner_photos`), max 8, ≤5 MB each.
- The feed handler (`/places/nearby`, `/places/search`) calls `enrichWithPartners`,
  which merges a partner's `photos[]` and `featured` onto the matching Google
  result by place id. The app's `RestaurantCard` then renders the DoorDash-style
  photo carousel; restaurants without a profile render without images.

## Billing — featured placement subscription (Stripe)

Featured placement is a paid subscription, sold on the **web portal** (not in the
native app), so it's outside Apple's IAP rules. It uses Stripe Checkout +
Customer Portal; `featured` is kept in sync by a Stripe webhook.

Setup:

```bash
cd api

# In the Stripe Dashboard: create a recurring Product/Price, then note the price id.
npx wrangler secret put STRIPE_SECRET_KEY        # sk_live_... (or sk_test_...)
npx wrangler secret put STRIPE_PRICE_ID          # price_...  (the recurring price)
npx wrangler secret put STRIPE_WEBHOOK_SECRET     # whsec_...  (from the webhook, below)

npx wrangler deploy
```

Then in the Stripe Dashboard add a webhook endpoint:

- **URL:** `https://<your-worker-domain>/partners/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copy its signing secret into `STRIPE_WEBHOOK_SECRET` (above) and redeploy.

Flow: partner taps **Get featured** in the portal → Stripe Checkout (subscription)
→ webhook fires `checkout.session.completed` → `featured = 1`. Cancels/lapses via
`customer.subscription.deleted/updated` flip it back to `0`. Partners manage or
cancel through the **Manage subscription** button (Stripe Customer Portal).

### Featured placement is capped + rotated

`featured = 1` means "in the sponsored pool", **not** "always #1". Top placement
is finite inventory, so `enrichWithPartners` features **at most `FEATURED_SLOTS`**
sponsors per feed response (default **2**, set via the `FEATURED_SLOTS` var in
`wrangler.jsonc`) and **rotates** which sponsors fill those slots on a 15-minute
window. So a busy area with many payers doesn't put everyone on top at once —
each sponsor gets a fair share of the top slots over time. Sponsorship is also
naturally geo-scoped: a restaurant is only ever featured to users whose nearby
results already include it. (Free-tier photos always show, regardless of slot.)

### Manual override

You can still force `featured` without Stripe (e.g. a comp):

```bash
npx wrangler d1 execute sushi-party --remote \
  --command "UPDATE partner_profiles SET featured = 1 WHERE place_id = 'google-XXXX'"
```

## Endpoints (all under `/partners`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/partners` | – | Portal website |
| POST | `/partners` | – | App "feature your restaurant" lead |
| POST | `/partners/signup` \| `/login` | – | Partner auth |
| GET | `/partners/me` | partner | Profile + photos |
| PUT | `/partners/profile` | partner | Save name/address/description/place |
| GET | `/partners/places/search?q=` | partner | Claim-listing search |
| POST | `/partners/photos` | partner | Upload one image (raw body) |
| GET | `/partners/photos/:id` | – | Serve a photo |
| DELETE | `/partners/photos/:id` | partner | Remove a photo |
| POST | `/partners/billing/checkout` | partner | Start a featured subscription (Stripe Checkout) |
| POST | `/partners/billing/portal` | partner | Manage/cancel subscription (Stripe Customer Portal) |
| POST | `/partners/billing/webhook` | Stripe sig | Subscription lifecycle → sync `featured` |
