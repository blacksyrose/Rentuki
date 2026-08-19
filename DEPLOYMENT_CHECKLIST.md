# Rentuki deployment checklist

## 1. Supabase

For a brand-new Supabase project:

1. Open **SQL Editor**.
2. Run `supabase/schema.sql` once.
3. Run `supabase/migration_add_transfer_function.sql` once.
4. Create/confirm the Auth user you will use as the property owner.
5. Log into Rentuki with that same Auth account.
6. Open **Settings** and save the property first.

For an existing Rentuki database that already contains real data, do **not** delete or recreate the tables. Run the migration file only and verify the functions before continuing.

## 2. Local environment

Create `.env` from `.env.example`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never commit the real `.env` file.

## 3. Install and build

```bash
npm install
npm run dev
```

Before deployment:

```bash
npm run build
npm run preview
```

The production build must finish without errors.

## 4. Recommended first-time setup

1. Save the property in **Settings**.
2. Add all units.
3. Add/import tenants.
4. Create each active tenancy.
5. Verify each tenant's rent and payment due day.
6. Generate billing for the required month.
7. Record a small test payment.
8. Confirm the payment appears in **Receipts**.
9. Generate a receipt and confirm the tenant-facing PDF contains **Remarks**, not Reference.
10. Test a partial payment.
11. Test editing a payment.
12. Test a tenant transfer from one available unit to another.
13. Confirm the old tenancy remains in Rental History and old payments still show the old unit.
14. Test CSV import with test data before importing real financial records.

## 5. Import formats

### Tenants

```csv
name,phone,email,status
Jane Doe,09999999999,jane@example.com,active
```

### Units

```csv
unit,type,rent,status
101,Apartment,12000,available
102,Apartment,4500,available
```

### Payments

```csv
date,tenant,amount,method,reference,remarks
2026-08-18,Jane Doe,5000,GCash,TEST-001,August rent partial payment
```

The importer also accepts common spreadsheet date formats such as `8/18/2026` and normalizes them before writing to Supabase.

### Expenses

```csv
date,category,description,amount,unit,vendor
2026-08-18,Maintenance,Electricity repair,1500,101,Vendor Name
```

## 6. Transfer behavior

A transfer does **not** rewrite payment history.

- The old tenancy is ended the day before the transfer.
- A new tenancy starts on the transfer date.
- Existing billing/payment rows remain linked to the old tenancy.
- The destination unit becomes occupied.
- The old unit becomes available.
- Rental History shows both tenancy periods.

## 7. Production verification

- [ ] Auth login works.
- [ ] Property settings save.
- [ ] Unit creation works.
- [ ] Tenant creation works.
- [ ] Tenancy creation works.
- [ ] Billing generation works.
- [ ] Partial payments work.
- [ ] Payment editing works.
- [ ] Receipts generate correctly.
- [ ] Tenant transfer works.
- [ ] CSV/XLSX preview works.
- [ ] Tenant import works.
- [ ] Unit import works.
- [ ] Payment import works.
- [ ] Expense import works.
- [ ] Monthly Summary totals are correct.
- [ ] Reports export works.
- [ ] RLS prevents one account from seeing another account's data.
