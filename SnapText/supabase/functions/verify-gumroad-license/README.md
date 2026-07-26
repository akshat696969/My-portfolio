This function verifies a Gumroad license key and enforces one SnapText account per key.

Required environment variables:

- `GUMROAD_PRODUCT_MONTHLY_ID`
- `GUMROAD_PRODUCT_QUARTERLY_ID`
- `GUMROAD_PRODUCT_YEARLY_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Behavior:

- Accepts `licenseKey` / `license_key`
- Accepts `userId` / `user_id`
- Verifies the key against Gumroad
- Checks `user_subscriptions` with service-role access
- Rejects activation if the same `license_key` is already claimed by a different `user_id`
