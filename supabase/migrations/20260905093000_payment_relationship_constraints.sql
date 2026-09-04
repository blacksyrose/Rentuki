ALTER TABLE public.tenancies
  ADD CONSTRAINT tenancies_id_tenant_id_key
  UNIQUE (id, tenant_id);

ALTER TABLE public.billing_records
  ADD CONSTRAINT billing_records_id_tenancy_id_key
  UNIQUE (id, tenancy_id);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_billing_record_check
  CHECK (
    (
      payment_type = 'rent'
      AND billing_record_id IS NOT NULL
    )
    OR (
      payment_type IN ('deposit', 'advance')
      AND billing_record_id IS NULL
    )
  );

ALTER TABLE public.payments
  ADD CONSTRAINT payments_tenancy_tenant_id_fkey
  FOREIGN KEY (tenancy_id, tenant_id)
  REFERENCES public.tenancies (id, tenant_id);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_billing_tenancy_id_fkey
  FOREIGN KEY (billing_record_id, tenancy_id)
  REFERENCES public.billing_records (id, tenancy_id);
