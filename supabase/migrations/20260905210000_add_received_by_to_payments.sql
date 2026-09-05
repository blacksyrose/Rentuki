-- Rentuki: separate manual "Received By" from created_by.
-- created_by remains the authenticated user who created the record.
-- received_by is the name manually entered for the person who received the payment.

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS received_by text;

-- Tenant Portal uses a public access-key RPC. Keep the existing
-- tenant_portal_summary logic untouched and expose received_by through
-- a small wrapper instead of replacing the existing RPC.
CREATE OR REPLACE FUNCTION public.tenant_portal_summary_with_received_by(
  p_access_key text,
  p_billing_month date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_summary jsonb;
  v_payments jsonb;
BEGIN
  -- Existing RPC remains responsible for validating the tenant access key
  -- and enforcing tenant isolation.
  v_summary := public.tenant_portal_summary(
    p_access_key,
    p_billing_month
  );

  SELECT COALESCE(
    jsonb_agg(
      payment_json || jsonb_build_object(
        'received_by', pay.received_by
      )
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  INTO v_payments
  FROM jsonb_array_elements(
    COALESCE(v_summary->'payments', '[]'::jsonb)
  ) WITH ORDINALITY AS items(payment_json, ord)
  LEFT JOIN public.payments pay
    ON pay.id = NULLIF(payment_json->>'id', '')::uuid;

  RETURN jsonb_set(
    v_summary,
    '{payments}',
    v_payments,
    true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_portal_summary_with_received_by(text, date)
TO anon, authenticated;
