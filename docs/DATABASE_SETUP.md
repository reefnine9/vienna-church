# Cloudflare D1 setup (step 3)

The public bulletin is currently an example stored in the frontend. This step adds a **read-only** API and database schema, but does not enable publishing.

1. In Cloudflare dashboard, open **Storage & databases > D1 SQL database** and create a database named `vienna-church-db`.
2. Open the new database's **Console**, paste the contents of `schema.sql` from GitHub, and execute it. The schema is idempotent.
3. In **Workers & Pages > vienna-church > Settings > Bindings**, add a **D1 database** binding with variable name **DB**, selecting `vienna-church-db`. Add it for Production. Redeploy after updating bindings.
4. Visit `https://vienna-church.pages.dev/api/bulletins`. With an empty database, the expected response is `{"bulletin":null}`. A 503 means the binding is missing.

## Security
- The API exposes **only published** bulletins and matching public announcements.
- There are **no write endpoints** and no credentials in the repository.
- The `/admin` page is currently a local-only prototype, **not** an authenticated admin console.
- Do not put private personal data in D1 until authentication, authorization, and publishing workflows are completed.
- Do not publish a draft by changing its status manually unless you have reviewed all its content.

## Next step
Add protected server-side administration (authentication + authorization), create/update drafts, and publish transactionally. Then replace the frontend sample with database reads and preserve a clear missing-bulletin state.
