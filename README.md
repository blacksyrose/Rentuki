# Rentuki — Rental Management System

A production-oriented React + Vite + Supabase rental management application based on the supplied requirements.

## Included

- Supabase Auth
- Multi-property-ready PostgreSQL schema
- RLS policies
- Tenant and historical tenant records
- Separate tenant / unit / tenancy models
- Month-to-month billing
- Independent payment due day
- Partial payments
- Payment history
- Maintenance and expenses
- Monthly financial summary
- PDF receipts
- CSV reports
- CSV/XLSX spreadsheet preview import
- Audit log triggers
- Private Supabase Storage bucket
- Unit-specific default rents
- Historical rent preservation
- Tenancy-overlap database protection
- Optional transactional tenant-transfer function

## 1. Requirements

- Node.js 20+
- A Supabase project
- npm

## 2. Supabase setup

1. Open Supabase Dashboard.
2. Create a new project.
3. Open SQL Editor.
4. Paste and run `supabase/schema.sql`.
5. Paste and run `supabase/migration_add_transfer_function.sql`.
6. In Authentication > Providers, enable Email.
7. Create your first account through the app.
8. Open the app and go to Settings.
9. Add your property.
10. Add units.
11. Add tenants.
12. Add tenancies using the database editor initially, or extend the tenant modal to include tenancy creation.

Important: never put a Supabase service-role key in Vite frontend environment variables.

## 3. Local setup

```bash
npm install
cp .env.example .env
```

Set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then:

```bash
npm run dev
```

Open the URL shown by Vite.

## 4. Production build

```bash
npm run build
npm run preview
```

The `dist/` folder can be deployed to Vercel, Netlify, Cloudflare Pages, or another static host.

For Vercel, the framework preset can be Vite. Add the same environment variables in Project Settings.

## 5. Recommended first real-data workflow

1. Create your Supabase project.
2. Run the SQL schema.
3. Create your Rentuki account.
4. Configure the property.
5. Add every unit and its current default rent.
6. Add active tenants.
7. Add a tenancy record for each active tenant.
8. Add historical tenants with ended tenancy records.
9. Generate billing for the current month.
10. Record payments as they arrive.
11. Use Monthly Summary and Reports for reconciliation.

## 6. Critical data model

Tenant and Unit are NOT directly tied together.

Tenant -> Tenancy -> Unit -> Billing Record -> Payment

A transfer therefore ends the old tenancy and creates a new tenancy. The old rent and unit remain in history.

## 7. Due-date rule

The due day lives on `tenancies.payment_due_day`.

Move-in date is never used as the due date automatically.

Example:
- move-in: 2026-03-17
- due day: 25
- March billing due date: 2026-03-25

## 8. Partial payment

Multiple payment rows may point to one billing record.

Example:
- amount due: 15,000
- payment #1: 10,000
- balance: 5,000
- payment #2: 5,000
- balance: 0
- status: Paid

The database trigger recalculates the billing status.

## 9. Historical rent

`units.default_rent` is only the current/default rate.

`tenancies.monthly_rent` is the authoritative historical rate.

Changing a unit's default rent does not modify old tenancies or billing records.

## 10. Transfer

The optional SQL function `transfer_tenant(...)` performs the critical operation transactionally:

- closes old tenancy
- makes old unit available
- creates new tenancy
- applies new rent
- applies new due day
- makes new unit occupied
- records an audit event

A UI transfer modal can call this RPC directly.

## 11. Spreadsheet migration

The Reports page accepts CSV/XLSX and creates a preview in local storage. For a real migration, use a mapping/validation screen before inserting records.

Suggested mapping:

Tenant Name -> tenants
Unit -> units
Rent -> tenancies.monthly_rent
Move In -> tenancies.start_date
Move Out -> tenancies.end_date
Due Date -> tenancies.payment_due_day
Status -> tenants.status

Do not blindly import spreadsheet rows.

## 12. Important production hardening before launch

- Add a proper tenant profile page with full rental history.
- Add a dedicated transfer modal calling `transfer_tenant`.
- Add tenancy creation to the Add Tenant flow.
- Add signed document uploads/downloads.
- Add XLSX column mapping and validation before import.
- Add server-side RPCs for sensitive financial workflows.
- Add role-aware RLS for owner/manager/staff permissions if multiple staff users are introduced.
- Add automated billing generation via a scheduled Edge Function/cron.
- Add backups and a staging Supabase project before importing real data.
- Test all Scenario A–G cases from the supplied specification.

This project is deliberately structured so these additions do not require replacing the core database model.


## Tenant Portal Access

The tenant portal is read-only and does not require a tenant Supabase account.

1. Run `supabase/tenant_portal.sql` once in the Supabase SQL Editor.
2. In **Tenant Directory**, open a tenant profile.
3. Under **Tenant Portal Access**, choose **Generate key**.
4. Copy the key and privately give it to the tenant.
5. The tenant opens `/tenant-portal` and enters the key.
6. Regenerating a key immediately invalidates the previous key.
7. Revoking access disables the key without deleting the tenant's rental history.

The portal uses a server-side `SECURITY DEFINER` RPC and a SHA-256 hash of the access key. The anonymous client is not granted direct read access to tenant, tenancy, billing, payment, or receipt tables.
