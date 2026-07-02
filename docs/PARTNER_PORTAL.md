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

## Making a restaurant "featured"

`featured` is not partner-editable (it's the paid placement). Set it manually once
a partner pays:

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
