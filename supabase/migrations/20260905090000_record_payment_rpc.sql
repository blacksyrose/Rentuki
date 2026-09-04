CREATE OR REPLACE FUNCTION public.record_payment(
  p_tenant_id uuid,
  p_tenancy_id uuid,
  p_amount numeric,
  p_payment_type text DEFAULT 'rent',
  p_billing_record_id uuid DEFAULT NULL,
  p_payment_date date DEFAULT NULL,
  p_payment_method text DEFAULT 'Cash',
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_tenancy public.tenancies%ROWTYPE;
  v_billing_record public.billing_records%ROWTYPE;
  v_payment_type text;
  v_payment_method text;
  v_amount numeric(12, 2);
  v_existing_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants AS t
    WHERE t.id = p_tenant_id
      AND t.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Tenant does not belong to the authenticated owner.';
  END IF;

  SELECT t.*
  INTO v_tenancy
  FROM public.tenancies AS t
  WHERE t.id = p_tenancy_id
    AND t.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The tenancy does not belong to the supplied tenant.';
  END IF;

  v_payment_type := lower(trim(coalesce(p_payment_type, '')));

  IF v_payment_type NOT IN ('rent', 'advance', 'deposit') THEN
    RAISE EXCEPTION 'Payment type must be rent, advance, or deposit.';
  END IF;

  IF p_amount IS NULL THEN
    RAISE EXCEPTION 'Payment amount is required.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  v_amount := p_amount::numeric(12, 2);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  v_payment_method := CASE lower(trim(coalesce(p_payment_method, 'Cash')))
    WHEN 'cash' THEN 'Cash'
    WHEN 'gcash' THEN 'G-Cash'
    WHEN 'g-cash' THEN 'G-Cash'
    WHEN 'maribank' THEN 'Maribank'
    WHEN 'bank transfer' THEN 'Maribank'
    WHEN 'bank_transfer' THEN 'Maribank'
    WHEN 'maya' THEN 'Maribank'
    WHEN 'other' THEN 'Maribank'
    ELSE NULL
  END;

  IF v_payment_method IS NULL THEN
    RAISE EXCEPTION 'Payment method must be Cash, G-Cash, or Maribank.';
  END IF;

  IF v_payment_type = 'rent' THEN
    IF p_billing_record_id IS NULL THEN
      RAISE EXCEPTION 'Rent payments require a billing record.';
    END IF;

    SELECT b.*
    INTO v_billing_record
    FROM public.billing_records AS b
    WHERE b.id = p_billing_record_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The billing record does not exist.';
    END IF;

    IF v_billing_record.tenancy_id <> p_tenancy_id THEN
      RAISE EXCEPTION 'The billing record does not belong to the supplied tenancy.';
    END IF;

    SELECT coalesce(sum(p.amount), 0)
    INTO v_existing_total
    FROM public.payments AS p
    WHERE p.billing_record_id = p_billing_record_id;

    IF v_existing_total + v_amount > v_billing_record.amount_due THEN
      RAISE EXCEPTION 'Payment exceeds the remaining billing balance.';
    END IF;
  ELSE
    IF p_billing_record_id IS NOT NULL THEN
      RAISE EXCEPTION 'Deposit and advance payments cannot be linked to a billing record.';
    END IF;

    SELECT coalesce(sum(p.amount), 0)
    INTO v_existing_total
    FROM public.payments AS p
    WHERE p.tenancy_id = p_tenancy_id
      AND p.payment_type = v_payment_type;

    IF v_existing_total + v_amount > v_tenancy.monthly_rent THEN
      IF v_payment_type = 'deposit' THEN
        RAISE EXCEPTION 'Deposit payments cannot exceed one month''s rent for this tenancy.';
      ELSE
        RAISE EXCEPTION 'Advance payments cannot exceed one month''s rent for this tenancy.';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.payments (
    billing_record_id,
    tenant_id,
    tenancy_id,
    amount,
    payment_date,
    payment_method,
    reference_number,
    notes,
    payment_type,
    created_by
  )
  VALUES (
    p_billing_record_id,
    p_tenant_id,
    p_tenancy_id,
    v_amount,
    coalesce(p_payment_date, current_date),
    v_payment_method,
    p_reference_number,
    p_notes,
    v_payment_type,
    auth.uid()
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment(
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date,
  text,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.record_payment(
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date,
  text,
  text,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.record_payment(
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date,
  text,
  text,
  text
) TO authenticated;