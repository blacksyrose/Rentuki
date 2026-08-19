# Rentuki — Rental Management System

Rentuki is a React + Vite + Supabase rental management application.

## Final source structure

- `src/styles.css` — shared/global styles
- `src/styles/*.css` — page-specific styles
- `src/services/db.js` — Supabase data access layer
- `src/lib/supabase.js` — Supabase client
- `src/pages/` — application pages
- `src/components/` — shared UI components

The CSS was reorganized without changing the existing React/database behavior. The previous duplicated CSS layer was removed; page-specific styles were separated into their target files.

## Requirements

- Node.js 20+
- npm
- An existing Supabase project containing the Rentuki database schema/RPCs

## Local setup

1. Copy `.env.example` to `.env`.
2. Set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to Vercel, Netlify, Cloudflare Pages, or another static host.

For Vercel, use the Vite preset and add the same two `VITE_SUPABASE_*` environment variables in the project settings.

## Supabase

This final source package does not include a replacement database schema because the application is intended to use the existing Supabase database that has already been smoke-tested.

Before cleaning production data, verify the existing database contains the tables/RPCs used by the application, including the tenant portal and tenancy/payment workflows.

Never put a Supabase service-role key in frontend environment variables.

## Important application rules

- Move-in date and payment due day are separate.
- `tenancies.payment_due_day` controls the recurring rent due date.
- Rent is stored on each tenancy so historical rent rates are preserved.
- Monthly rent payments use a billing record.
- Advance rent and security deposits are standalone payment records.
- Tenant transfers end the old tenancy and create a new tenancy.
- Historical billing/payment/receipt records are retained.
- Tenant portal access uses a private access key and is read-only.
- Monthly Summary separates rent from advance rent and security deposits.
- Unit ordering in the Monthly Summary is ascending by unit number.

## Final deployment workflow

1. Run the final smoke tests against the existing Supabase project.
2. Back up/export the production data before deleting smoke-test records.
3. Remove only test records; do not remove production records.
4. Run `npm install` on the deployment machine.
5. Run `npm run build`.
6. Deploy the resulting `dist/`.
7. Configure the production `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
8. Sign in and verify Dashboard, Tenants, Units, Payments, Maintenance & Expenses, Monthly Summary, Receipts, Reports, Submeter Calculator, Settings, and Tenant Portal.
