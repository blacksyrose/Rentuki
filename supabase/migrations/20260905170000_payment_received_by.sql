-- Payment receiver names for tenant portal receipts.
-- Keeps record_payment() unchanged: it already stores auth.uid() in created_by.
-- This only exposes the stored receiver name for the tenant's own payment rows.

CREATE OR REPLACE FUNCTION public.tenant_portal_summary(p_access_key text, p_billing_month date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tenant record;
  v_current_tenancy jsonb;
  v_billing jsonb;
  v_billing_history jsonb;
  v_payments jsonb;
  v_history jsonb;
  v_property_name text;
BEGIN
  IF nullif(trim(p_access_key), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid access key.';
  END IF;

  SELECT
    t.id,
    t.first_name,
    t.last_name,
    t.status
  INTO v_tenant
  FROM public.tenants t
  WHERE upper(trim(t.tenant_access_key)) = upper(trim(p_access_key))
    AND nullif(trim(t.tenant_access_key), '') IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or disabled access key.';
  END IF;

  /*
   * Current active tenancy.
   */
  SELECT jsonb_build_object(
    'id', te.id,
    'unit_number', u.unit_number,
    'start_date', te.start_date,
    'end_date', te.end_date,
    'monthly_rent', te.monthly_rent,
    'payment_due_day', te.payment_due_day,
    'deposit_amount', te.deposit_amount,
    'status', te.status
  )
  INTO v_current_tenancy
  FROM public.tenancies te
  JOIN public.units u ON u.id = te.unit_id
  WHERE te.tenant_id = v_tenant.id
    AND te.status = 'active'
    AND te.end_date IS NULL
  ORDER BY te.start_date DESC
  LIMIT 1;

  /*
   * Current month's billing record.
   * Payment totals come directly from payments linked to this
   * billing record, so the portal does not have to guess the balance
   * from payment dates.
   */
  SELECT jsonb_build_object(
    'id', br.id,
    'tenancy_id', br.tenancy_id,
    'billing_month', br.billing_month,
    'due_date', br.due_date,
    'amount_due', br.amount_due,
    'paid_amount', COALESCE((
      SELECT SUM(pay.amount)
      FROM public.payments pay
      WHERE pay.billing_record_id = br.id
    ), 0),
    'balance', GREATEST(
      br.amount_due - COALESCE((
        SELECT SUM(pay.amount)
        FROM public.payments pay
        WHERE pay.billing_record_id = br.id
      ), 0),
      0
    ),
    'status', CASE
      WHEN br.status = 'waived' THEN 'waived'
      WHEN br.amount_due > 0
        AND COALESCE((SELECT SUM(pay.amount) FROM public.payments pay WHERE pay.billing_record_id = br.id), 0) >= br.amount_due
        THEN 'paid'
      WHEN COALESCE((SELECT SUM(pay.amount) FROM public.payments pay WHERE pay.billing_record_id = br.id), 0) > 0
        THEN 'partially_paid'
      WHEN br.due_date < CURRENT_DATE THEN 'overdue'
      WHEN br.due_date = CURRENT_DATE THEN 'due'
      ELSE 'upcoming'
    END
  )
  INTO v_billing
  FROM public.billing_records br
  JOIN public.tenancies te ON te.id = br.tenancy_id
  WHERE te.tenant_id = v_tenant.id
    AND br.billing_month = p_billing_month
    AND v_current_tenancy IS NOT NULL
    AND br.tenancy_id = (v_current_tenancy ->> 'id')::uuid
  ORDER BY br.due_date
  LIMIT 1;

  /*
   * THIS IS NOW THE SOURCE OF TRUTH FOR THE TENANT PORTAL:
   * every billing_records row belonging to the tenant is returned,
   * including historical tenancies. Each record contains the amount
   * due, total paid, remaining balance, current status, unit and
   * payment information.
   */
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'tenancy_id', x.tenancy_id,
        'billing_month', x.billing_month,
        'due_date', x.due_date,
        'amount_due', x.amount_due,
        'paid_amount', x.paid_amount,
        'balance', GREATEST(x.amount_due - x.paid_amount, 0),
        'status', CASE
          WHEN x.stored_status = 'waived' THEN 'waived'
          WHEN x.amount_due > 0 AND x.paid_amount >= x.amount_due THEN 'paid'
          WHEN x.paid_amount > 0 THEN 'partially_paid'
          WHEN x.due_date < CURRENT_DATE THEN 'overdue'
          WHEN x.due_date = CURRENT_DATE THEN 'due'
          ELSE 'upcoming'
        END,
        'unit_number', x.unit_number,
        'monthly_rent', x.monthly_rent,
        'payment_due_day', x.payment_due_day,
        'latest_payment_date', x.latest_payment_date,
        'payment_methods', COALESCE(x.payment_methods, ARRAY[]::text[])
      )
      ORDER BY x.billing_month DESC, x.due_date DESC
    ),
    '[]'::jsonb
  )
  INTO v_billing_history
  FROM (
    SELECT
      br.id,
      br.tenancy_id,
      br.billing_month,
      br.due_date,
      br.amount_due,
      br.status::text AS stored_status,
      te.monthly_rent,
      te.payment_due_day,
      u.unit_number,
      COALESCE(SUM(pay.amount), 0) AS paid_amount,
      MAX(pay.payment_date) AS latest_payment_date,
      ARRAY_AGG(DISTINCT pay.payment_method)
        FILTER (WHERE pay.payment_method IS NOT NULL) AS payment_methods
    FROM public.billing_records br
    JOIN public.tenancies te
      ON te.id = br.tenancy_id
    LEFT JOIN public.units u
      ON u.id = te.unit_id
    LEFT JOIN public.payments pay
      ON pay.billing_record_id = br.id
    WHERE te.tenant_id = v_tenant.id
    GROUP BY
      br.id,
      br.tenancy_id,
      br.billing_month,
      br.due_date,
      br.amount_due,
      br.status,
      te.monthly_rent,
      te.payment_due_day,
      u.unit_number
  ) x;

  /*
   * Complete payment transaction history is still returned.
   * Rent payments are connected to billing_records; deposits and
   * advances can remain standalone.
   */
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pay.id,
        'amount', pay.amount,
        'payment_date', pay.payment_date,
        'payment_method', pay.payment_method,
        'payment_type', COALESCE(pay.payment_type, 'rent'),
        'reference_number', pay.reference_number,
        'receipt_number', COALESCE(pay.receipt_number, pay.reference_number),
        'notes', pay.notes,
        'billing_record_id', pay.billing_record_id,
        'billing_month', br.billing_month,
        'amount_due', br.amount_due,
        'tenancy_id', pay.tenancy_id,
        'tenant_id', pay.tenant_id,
        'unit_number', u.unit_number,
        'monthly_rent', te.monthly_rent,
        'created_by', pay.created_by,
        'received_by_name', (
          SELECT NULLIF(trim(profile.full_name), '')
          FROM public.profiles profile
          WHERE profile.id = pay.created_by
          LIMIT 1
        ),
        'created_at', pay.created_at
      )
      ORDER BY pay.payment_date DESC, pay.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_payments
  FROM public.payments pay
  LEFT JOIN public.billing_records br
    ON br.id = pay.billing_record_id
  LEFT JOIN public.tenancies te
    ON te.id = pay.tenancy_id
  LEFT JOIN public.units u
    ON u.id = te.unit_id
  WHERE pay.tenant_id = v_tenant.id;

  /*
   * Full rental/unit history.
   */
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', te.id,
        'unit_id', te.unit_id,
        'unit_number', u.unit_number,
        'monthly_rent', te.monthly_rent,
        'start_date', te.start_date,
        'end_date', te.end_date,
        'status', te.status
      )
      ORDER BY te.start_date DESC
    ),
    '[]'::jsonb
  )
  INTO v_history
  FROM public.tenancies te
  LEFT JOIN public.units u
    ON u.id = te.unit_id
  WHERE te.tenant_id = v_tenant.id;

  /*
   * Property name from the active unit.
   */
  SELECT p.name
  INTO v_property_name
  FROM public.tenancies te
  JOIN public.units u ON u.id = te.unit_id
  JOIN public.properties p ON p.id = u.property_id
  WHERE te.tenant_id = v_tenant.id
    AND te.status = 'active'
    AND te.end_date IS NULL
  ORDER BY te.start_date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'first_name', v_tenant.first_name,
      'last_name', v_tenant.last_name,
      'status', v_tenant.status
    ),
    'property_name', COALESCE(v_property_name, 'Rentuki'),
    'current_tenancy', v_current_tenancy,
    'billing', v_billing,
    'billing_history', v_billing_history,
    'payments', v_payments,
    'unit_history', v_history
  );
END;
$$;
