SET local check_function_bodies = off;

CREATE SEQUENCE "public"."receipt_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1 NO CYCLE;

CREATE TABLE "public"."audit_logs" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid,
  "action"     text                     NOT NULL,
  "entity"     text                     NOT NULL,
  "entity_id"  uuid,
  "metadata"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."billing_records" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenancy_id"    uuid                     NOT NULL,
  "billing_month" date                     NOT NULL,
  "due_date"      date                     NOT NULL,
  "amount_due"    numeric(12,2)            NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_records_amount_due_check" CHECK ((amount_due >= (0)::numeric)),
  CONSTRAINT "billing_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "billing_records_tenancy_id_billing_month_key" UNIQUE (tenancy_id, billing_month)
);

ALTER TABLE "public"."billing_records"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."documents" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              uuid,
  "tenancy_id"             uuid,
  "payment_id"             uuid,
  "expense_id"             uuid,
  "maintenance_request_id" uuid,
  "file_name"              text                     NOT NULL,
  "file_path"              text                     NOT NULL,
  "file_type"              text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "documents_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."documents"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."expenses" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "property_id"    uuid                     NOT NULL,
  "unit_id"        uuid,
  "category"       text                     NOT NULL,
  "description"    text                     NOT NULL,
  "amount"         numeric(12,2)            NOT NULL,
  "expense_date"   date                     NOT NULL DEFAULT CURRENT_DATE,
  "vendor"         text,
  "payment_method" text,
  "reference"      text,
  "notes"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "expenses_amount_check" CHECK ((amount >= (0)::numeric)),
  CONSTRAINT "expenses_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."expenses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."maintenance_requests" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "property_id"     uuid                     NOT NULL,
  "unit_id"         uuid,
  "tenant_id"       uuid,
  "title"           text                     NOT NULL,
  "description"     text,
  "assigned_person" text,
  "estimated_cost"  numeric(12,2)            NOT NULL DEFAULT 0,
  "actual_cost"     numeric(12,2)            NOT NULL DEFAULT 0,
  "reported_date"   date                     NOT NULL DEFAULT CURRENT_DATE,
  "completed_date"  date,
  "notes"           text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "maintenance_requests_actual_cost_check" CHECK ((actual_cost >= (0)::numeric)),
  CONSTRAINT "maintenance_requests_estimated_cost_check" CHECK ((estimated_cost >= (0)::numeric)),
  CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."maintenance_requests"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."payments" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "billing_record_id" uuid,
  "tenant_id"         uuid                     NOT NULL,
  "tenancy_id"        uuid                     NOT NULL,
  "amount"            numeric(12,2)            NOT NULL,
  "payment_date"      date                     DEFAULT CURRENT_DATE,
  "payment_method"    text                     NOT NULL DEFAULT 'Cash'::text,
  "reference_number"  text,
  "notes"             text,
  "receipt_number"    text,
  "created_by"        uuid,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "payment_type"      text                     NOT NULL DEFAULT 'rent'::text,
  CONSTRAINT "payments_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "payments_payment_type_check" CHECK ((payment_type = ANY (ARRAY['rent'::text, 'advance'::text, 'deposit'::text]))),
  CONSTRAINT "payments_pkey" PRIMARY KEY (id),
  CONSTRAINT "payments_receipt_number_key" UNIQUE (receipt_number)
);

ALTER TABLE "public"."payments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "full_name"  text,
  "role"       text                     NOT NULL DEFAULT 'owner'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."properties" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "address"    text,
  "phone"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "properties_pkey" PRIMARY KEY (id),
  "owner_id"   uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."properties"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."receipts" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "payment_id"     uuid                     NOT NULL,
  "receipt_number" text                     NOT NULL,
  "generated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "file_path"      text,
  CONSTRAINT "receipts_payment_id_key" UNIQUE (payment_id),
  CONSTRAINT "receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "receipts_receipt_number_key" UNIQUE (receipt_number)
);

ALTER TABLE "public"."receipts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tenancies" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       uuid                     NOT NULL,
  "unit_id"         uuid                     NOT NULL,
  "start_date"      date                     NOT NULL,
  "end_date"        date,
  "monthly_rent"    numeric(12,2)            NOT NULL,
  "payment_due_day" integer                  NOT NULL,
  "deposit_amount"  numeric(12,2)            NOT NULL DEFAULT 0,
  "notes"           text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tenancies_check" CHECK (((end_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT "tenancies_deposit_amount_check" CHECK ((deposit_amount >= (0)::numeric)),
  CONSTRAINT "tenancies_monthly_rent_check" CHECK ((monthly_rent >= (0)::numeric)),
  CONSTRAINT "tenancies_payment_due_day_check" CHECK (((payment_due_day >= 1) AND (payment_due_day <= 31))),
  CONSTRAINT "tenancies_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tenancies"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tenant_portal_access" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    uuid                     NOT NULL,
  "owner_id"     uuid                     NOT NULL,
  "key_hash"     text                     NOT NULL,
  "key_preview"  text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "tenant_portal_access_key_hash_key" UNIQUE (key_hash),
  CONSTRAINT "tenant_portal_access_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tenant_portal_access"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tenants" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "first_name"        text                     NOT NULL,
  "last_name"         text,
  "phone"             text,
  "email"             text,
  "address"           text,
  "emergency_contact" text,
  "notes"             text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "tenant_access_key" text,
  CONSTRAINT "tenants_pkey" PRIMARY KEY (id),
  "owner_id"          uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."tenants"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."units" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "property_id"            uuid                     NOT NULL,
  "unit_number"            text                     NOT NULL,
  "floor"                  text,
  "unit_type"              text,
  "default_rent"           numeric(12,2)            NOT NULL DEFAULT 0,
  "notes"                  text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "electricity_meter_type" text                     NOT NULL DEFAULT 'direct'::text,
  "electricity_can"        text,
  "electricity_bill_name"  text,
  "water_can"              text,
  "water_bill_name"        text,
  CONSTRAINT "units_default_rent_check" CHECK ((default_rent >= (0)::numeric)),
  CONSTRAINT "units_electricity_meter_type_check" CHECK ((electricity_meter_type = ANY (ARRAY['direct'::text, 'submeter'::text]))),
  CONSTRAINT "units_pkey" PRIMARY KEY (id),
  CONSTRAINT "units_property_id_unit_number_key" UNIQUE (property_id, unit_number)
);

ALTER TABLE "public"."units"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."billing_status" AS ENUM (
  'upcoming',
  'due',
  'partially_paid',
  'paid',
  'overdue',
  'waived'
);

ALTER TABLE "public"."billing_records"
  ADD COLUMN "status" public.billing_status NOT NULL DEFAULT 'upcoming'::public.billing_status;

CREATE TYPE "public"."maintenance_status" AS ENUM (
  'open',
  'in_progress',
  'completed',
  'cancelled'
);

ALTER TABLE "public"."maintenance_requests"
  ADD COLUMN "status" public.maintenance_status NOT NULL DEFAULT 'open'::public.maintenance_status;

CREATE TYPE "public"."priority_level" AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

ALTER TABLE "public"."maintenance_requests"
  ADD COLUMN "priority" public.priority_level NOT NULL DEFAULT 'medium'::public.priority_level;

CREATE TYPE "public"."tenancy_status" AS ENUM (
  'active',
  'ended'
);

ALTER TABLE "public"."tenancies"
  ADD COLUMN "status" public.tenancy_status NOT NULL DEFAULT 'active'::public.tenancy_status;

CREATE TYPE "public"."tenant_status" AS ENUM (
  'active',
  'moving',
  'moved_out',
  'historical'
);

ALTER TABLE "public"."tenants"
  ADD COLUMN "status" public.tenant_status NOT NULL DEFAULT 'active'::public.tenant_status;

CREATE TYPE "public"."unit_status" AS ENUM (
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'unavailable'
);

ALTER TABLE "public"."units"
  ADD COLUMN "status" public.unit_status NOT NULL DEFAULT 'available'::public.unit_status;

CREATE OR REPLACE FUNCTION public.assign_receipt_number()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.receipt_number is null or new.receipt_number = '' then
    new.receipt_number :=
      'RCPT-' ||
      to_char(coalesce(new.payment_date, current_date), 'YYYYMM') ||
      '-' ||
      nextval('public.receipt_seq');
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.audit_row()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.audit_logs(user_id, action, entity, entity_id, metadata)
  values(auth.uid(), tg_op, tg_table_name, coalesce(new.id,old.id), jsonb_build_object('new',to_jsonb(new),'old',to_jsonb(old)));
  return coalesce(new,old);
end $function$;

CREATE OR REPLACE FUNCTION public.can_access_property (
  p_property_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists(select 1 from public.properties where id=p_property_id and owner_id=auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.create_tenancy (
  p_tenant_id       uuid,
  p_unit_id         uuid,
  p_start_date      date,
  p_monthly_rent    numeric,
  p_payment_due_day integer,
  p_deposit_amount  numeric DEFAULT 0,
  p_notes           text    DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_tenancy_id uuid;
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
  from public.tenants
  where id = p_tenant_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Unauthorized tenant.';
  end if;

  if not exists (
    select 1
    from public.units u
    join public.properties p on p.id = u.property_id
    where u.id = p_unit_id
      and p.owner_id = auth.uid()
      and u.status = 'available'
  ) then
    raise exception 'The selected unit is not available.';
  end if;

  if p_monthly_rent < 0 then
    raise exception 'Rent cannot be negative.';
  end if;

  if p_payment_due_day not between 1 and 31 then
    raise exception 'Payment due day must be between 1 and 31.';
  end if;

  if p_deposit_amount < 0 then
    raise exception 'Deposit cannot be negative.';
  end if;

  if exists (
    select 1 from public.tenancies
    where tenant_id = p_tenant_id and status = 'active'
  ) then
    raise exception 'This tenant already has an active tenancy.';
  end if;

  insert into public.tenancies(
    tenant_id,
    unit_id,
    start_date,
    monthly_rent,
    payment_due_day,
    deposit_amount,
    status,
    notes
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_start_date,
    p_monthly_rent,
    p_payment_due_day,
    coalesce(p_deposit_amount, 0),
    'active',
    p_notes
  )
  returning id into v_tenancy_id;

  update public.units
  set status = 'occupied'
  where id = p_unit_id;

  update public.tenants
  set status = 'active'
  where id = p_tenant_id;

  insert into public.audit_logs(user_id, action, entity, entity_id, metadata)
  values (
    auth.uid(),
    'CREATE',
    'tenancies',
    v_tenancy_id,
    jsonb_build_object(
      'tenant_id', p_tenant_id,
      'unit_id', p_unit_id,
      'start_date', p_start_date,
      'monthly_rent', p_monthly_rent
    )
  );

  return v_tenancy_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_tenant_portal_key (
  p_tenant_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
declare
  v_owner_id uuid;
  v_key text;
  v_hash text;
begin
  select owner_id
    into v_owner_id
  from public.tenants
  where id = p_tenant_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Unauthorized tenant.';
  end if;

  -- Regeneration immediately invalidates the previous key.
  update public.tenant_portal_access
  set revoked_at = now()
  where tenant_id = p_tenant_id
    and revoked_at is null;

  v_key :=
    'TENANT-' ||
    upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 4)) || '-' ||
    upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 4)) || '-' ||
    upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 4)) || '-' ||
    upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 4));

  v_hash := encode(digest(v_key, 'sha256'), 'hex');

  insert into public.tenant_portal_access (
    tenant_id,
    owner_id,
    key_hash,
    key_preview
  )
  values (
    p_tenant_id,
    auth.uid(),
    v_hash,
    left(v_key, 15) || '••••'
  );

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'access_key', v_key,
    'key_preview', left(v_key, 15) || '••••'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_monthly_summary (
  p_access_key text,
  p_month      date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp WITH time zone))::date
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
declare
  v_hash text;
  v_access public.tenant_portal_access;
  v_tenant public.tenants;
  v_property_name text;
  v_current_tenancy jsonb;
  v_billing jsonb;
  v_payments jsonb;
  v_history jsonb;
  v_month date := date_trunc('month', coalesce(p_month, current_date))::date;
begin
  if nullif(trim(p_access_key), '') is null then
    raise exception 'Access key is required.';
  end if;

  v_hash := encode(
    digest(upper(trim(p_access_key)), 'sha256'),
    'hex'
  );

  select *
    into v_access
  from public.tenant_portal_access
  where key_hash = v_hash
    and revoked_at is null
  limit 1;

  if v_access.id is null then
    raise exception 'Invalid or revoked access key.';
  end if;

  select *
    into v_tenant
  from public.tenants
  where id = v_access.tenant_id;

  if v_tenant.id is null then
    raise exception 'Tenant record not found.';
  end if;

  select p.name
    into v_property_name
  from public.tenancies te
  join public.units u on u.id = te.unit_id
  join public.properties p on p.id = u.property_id
  where te.tenant_id = v_tenant.id
  order by
    case when te.status = 'active' then 0 else 1 end,
    te.start_date desc
  limit 1;

  select jsonb_build_object(
    'unit_number', u.unit_number,
    'start_date', te.start_date,
    'end_date', te.end_date,
    'monthly_rent', te.monthly_rent,
    'payment_due_day', te.payment_due_day,
    'deposit_amount', te.deposit_amount,
    'status', te.status
  )
  into v_current_tenancy
  from public.tenancies te
  join public.units u on u.id = te.unit_id
  where te.tenant_id = v_tenant.id
    and te.status = 'active'
  order by te.start_date desc
  limit 1;

  select jsonb_build_object(
    'billing_month', br.billing_month,
    'due_date', br.due_date,
    'amount_due', br.amount_due,
    'status', br.status
  )
  into v_billing
  from public.billing_records br
  join public.tenancies te on te.id = br.tenancy_id
  where te.tenant_id = v_tenant.id
    and br.billing_month = v_month
  order by br.due_date
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'payment_date', pay.payment_date,
        'amount', pay.amount,
        'payment_method', pay.payment_method,
        'reference_number', pay.reference_number,
        'notes', pay.notes,
        'receipt_number', pay.receipt_number,
        'billing_month', br.billing_month
      )
      order by pay.payment_date desc, pay.created_at desc
    ),
    '[]'::jsonb
  )
  into v_payments
  from public.payments pay
  left join public.billing_records br on br.id = pay.billing_record_id
  where pay.tenant_id = v_tenant.id
    and pay.payment_date >= v_month
    and pay.payment_date < (v_month + interval '1 month')::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'unit_number', u.unit_number,
        'start_date', te.start_date,
        'end_date', te.end_date,
        'monthly_rent', te.monthly_rent,
        'status', te.status
      )
      order by te.start_date desc
    ),
    '[]'::jsonb
  )
  into v_history
  from public.tenancies te
  join public.units u on u.id = te.unit_id
  where te.tenant_id = v_tenant.id;

  update public.tenant_portal_access
  set last_used_at = now()
  where id = v_access.id;

  return jsonb_build_object(
    'tenant', jsonb_build_object(
      'first_name', v_tenant.first_name,
      'last_name', v_tenant.last_name
    ),
    'property_name', coalesce(v_property_name, 'Rental Property'),
    'month', v_month,
    'current_tenancy', coalesce(v_current_tenancy, '{}'::jsonb),
    'billing', coalesce(v_billing, '{}'::jsonb),
    'payments', v_payments,
    'unit_history', v_history
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.list_tenant_portal_keys()
  RETURNS TABLE (
    tenant_id    uuid,
    key_preview  text,
    created_at   timestamp with time zone,
    last_used_at timestamp with time zone,
    revoked_at   timestamp with time zone
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
  select
    tpa.tenant_id,
    tpa.key_preview,
    tpa.created_at,
    tpa.last_used_at,
    tpa.revoked_at
  from public.tenant_portal_access tpa
  where tpa.owner_id = auth.uid()
    and tpa.revoked_at is null
  order by tpa.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.move_out_tenant (
  p_move_out_date date,
  p_notes         text,
  p_tenancy_id    uuid,
  p_tenant_id     uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
    v_unit_id uuid;
    v_result_tenancy_id uuid;
BEGIN
    /*
      1. Verify that the tenant belongs to the
         currently authenticated owner.
    */
    IF NOT EXISTS (
        SELECT 1
        FROM public.tenants
        WHERE id = p_tenant_id
          AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized tenant.';
    END IF;


    /*
      2. Find the active tenancy belonging to
         that tenant.
    */
    SELECT unit_id
    INTO v_unit_id
    FROM public.tenancies
    WHERE id = p_tenancy_id
      AND tenant_id = p_tenant_id
      AND status = 'active'::public.tenancy_status;

    IF v_unit_id IS NULL THEN
        RAISE EXCEPTION
            'Active tenancy not found for tenant % and tenancy %',
            p_tenant_id,
            p_tenancy_id;
    END IF;


    /*
      3. End the current tenancy.
         Keep the record so rental history is preserved.
    */
    UPDATE public.tenancies
    SET
        end_date = p_move_out_date,
        status = 'ended'::public.tenancy_status,
        notes = CASE
            WHEN NULLIF(TRIM(p_notes), '') IS NULL
                THEN notes
            WHEN NULLIF(TRIM(notes), '') IS NULL
                THEN TRIM(p_notes)
            ELSE
                notes || E'\nMove-out notes: ' || TRIM(p_notes)
        END
    WHERE id = p_tenancy_id
      AND tenant_id = p_tenant_id
      AND status = 'active'::public.tenancy_status
    RETURNING id INTO v_result_tenancy_id;


    IF v_result_tenancy_id IS NULL THEN
        RAISE EXCEPTION
            'Unable to end tenancy %. ',
            p_tenancy_id;
    END IF;


    /*
      4. Make the unit available again.
    */
    UPDATE public.units
    SET status = 'available'::public.unit_status
    WHERE id = v_unit_id;


    /*
      5. Mark the tenant as moved out.
         Do NOT delete the tenant record.
         Historical records must remain.
    */
    UPDATE public.tenants
    SET status = 'moved_out'::public.tenant_status
    WHERE id = p_tenant_id;


    /*
      6. Return the tenancy ID.
    */
    RETURN v_result_tenancy_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payments_status_trigger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
DECLARE
  billing_id uuid;
BEGIN
  billing_id := COALESCE(
    new.billing_record_id,
    old.billing_record_id
  );

  -- Only refresh monthly billing when this payment
  -- is actually attached to a billing record.
  IF billing_id IS NOT NULL THEN
    PERFORM public.refresh_billing_status(billing_id);
  END IF;

  RETURN COALESCE(new, old);
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_tenancy_overlap()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if exists (
    select 1 from public.tenancies t
    where t.unit_id = new.unit_id
      and t.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
      and daterange(t.start_date, coalesce(t.end_date + 1, 'infinity'::date), '[)')
          && daterange(new.start_date, coalesce(new.end_date + 1, 'infinity'::date), '[)')
  ) then
    raise exception 'This unit already has an overlapping tenancy period.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.refresh_billing_status (
  p_billing_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  due numeric;
  paid numeric;
  d date;
BEGIN
  /*
   * Only allow the owner of the billing record's tenancy
   * to refresh its status.
   */
  IF NOT EXISTS (
    SELECT 1
    FROM public.billing_records br
    JOIN public.tenancies te
      ON te.id = br.tenancy_id
    JOIN public.tenants tn
      ON tn.id = te.tenant_id
    WHERE br.id = p_billing_id
      AND tn.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Billing record not found or access denied';
  END IF;

  SELECT amount_due, due_date
  INTO due, d
  FROM public.billing_records
  WHERE id = p_billing_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO paid
  FROM public.payments
  WHERE billing_record_id = p_billing_id;

  UPDATE public.billing_records
  SET status = CASE
    WHEN status = 'waived' THEN 'waived'::public.billing_status
    WHEN paid >= due THEN 'paid'::public.billing_status
    WHEN paid > 0 THEN 'partially_paid'::public.billing_status
    WHEN d < current_date THEN 'overdue'::public.billing_status
    WHEN d = current_date THEN 'due'::public.billing_status
    ELSE 'upcoming'::public.billing_status
  END
  WHERE id = p_billing_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_tenant_portal_key (
  p_tenant_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
  AS $function$
declare
  v_updated integer;
begin
  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
      and owner_id = auth.uid()
  ) then
    raise exception 'Unauthorized tenant.';
  end if;

  update public.tenant_portal_access
  set revoked_at = now()
  where tenant_id = p_tenant_id
    and owner_id = auth.uid()
    and revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_expense_property_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if new.property_id is null and new.unit_id is not null then
    select u.property_id
      into new.property_id
    from public.units u
    where u.id = new.unit_id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tenant_portal_summary (
  p_access_key    text,
  p_billing_month date
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.transfer_tenant (
  p_tenancy_id    uuid,
  p_tenant_id     uuid,
  p_new_unit_id   uuid,
  p_transfer_date date,
  p_new_rent      numeric,
  p_new_due_day   integer,
  p_new_deposit   numeric DEFAULT 0,
  p_notes         text    DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_old public.tenancies;
  v_new_id uuid;
  v_owner_id uuid;
begin
  select * into v_old
  from public.tenancies
  where id = p_tenancy_id
  for update;

  if v_old.id is null then
    raise exception 'Tenancy not found.';
  end if;

  select owner_id into v_owner_id
  from public.tenants
  where id = v_old.tenant_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Unauthorized tenancy.';
  end if;

  if v_old.tenant_id <> p_tenant_id then
    raise exception 'Tenant does not match the current tenancy.';
  end if;

  if v_old.status <> 'active' then
    raise exception 'Only an active tenancy can be transferred.';
  end if;

  if p_transfer_date <= v_old.start_date then
    raise exception 'Transfer date must be after the current tenancy start date.';
  end if;

  if p_new_rent < 0 then
    raise exception 'Rent cannot be negative.';
  end if;

  if p_new_due_day not between 1 and 31 then
    raise exception 'Payment due day must be between 1 and 31.';
  end if;

  if p_new_deposit < 0 then
    raise exception 'Deposit cannot be negative.';
  end if;

  if not exists (
    select 1
    from public.units u
    join public.properties p on p.id = u.property_id
    where u.id = p_new_unit_id
      and p.owner_id = auth.uid()
      and u.status = 'available'
  ) then
    raise exception 'The destination unit is not available.';
  end if;

  update public.tenancies
  set
    end_date = p_transfer_date - 1,
    status = 'ended',
    notes = concat_ws(E'\n', nullif(notes, ''), nullif('Transfer to another unit on ' || p_transfer_date, ''), p_notes)
  where id = v_old.id;

  update public.units
  set status = 'available'
  where id = v_old.unit_id;

  insert into public.tenancies(
    tenant_id,
    unit_id,
    start_date,
    monthly_rent,
    payment_due_day,
    deposit_amount,
    status,
    notes
  )
  values (
    v_old.tenant_id,
    p_new_unit_id,
    p_transfer_date,
    p_new_rent,
    p_new_due_day,
    coalesce(p_new_deposit, 0),
    'active',
    p_notes
  )
  returning id into v_new_id;

  update public.units
  set status = 'occupied'
  where id = p_new_unit_id;

  update public.tenants
  set status = 'active'
  where id = v_old.tenant_id;

  insert into public.audit_logs(user_id, action, entity, entity_id, metadata)
  values (
    auth.uid(),
    'TRANSFER',
    'tenancies',
    v_new_id,
    jsonb_build_object(
      'old_tenancy_id', v_old.id,
      'old_unit_id', v_old.unit_id,
      'new_unit_id', p_new_unit_id,
      'transfer_date', p_transfer_date,
      'new_rent', p_new_rent
    )
  );

  return v_new_id;
end;
$function$;

ALTER TABLE "public"."audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_expense_id_fkey" FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_maintenance_request_id_fkey" FOREIGN KEY (maintenance_request_id) REFERENCES public.maintenance_requests(id) ON DELETE CASCADE;

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_billing_record_id_fkey" FOREIGN KEY (billing_record_id) REFERENCES public.billing_records(id) ON DELETE RESTRICT;

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."expenses"
  ADD CONSTRAINT "expenses_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;

ALTER TABLE "public"."maintenance_requests"
  ADD CONSTRAINT "maintenance_requests_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;

ALTER TABLE "public"."receipts"
  ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."billing_records"
  ADD CONSTRAINT "billing_records_tenancy_id_fkey" FOREIGN KEY (tenancy_id) REFERENCES public.tenancies(id) ON DELETE RESTRICT;

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_tenancy_id_fkey" FOREIGN KEY (tenancy_id) REFERENCES public.tenancies(id) ON DELETE CASCADE;

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_tenancy_id_fkey" FOREIGN KEY (tenancy_id) REFERENCES public.tenancies(id) ON DELETE RESTRICT;

ALTER TABLE "public"."tenant_portal_access"
  ADD CONSTRAINT "tenant_portal_access_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE "public"."maintenance_requests"
  ADD CONSTRAINT "maintenance_requests_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE "public"."tenancies"
  ADD CONSTRAINT "tenancies_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE "public"."tenant_portal_access"
  ADD CONSTRAINT "tenant_portal_access_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE "public"."expenses"
  ADD CONSTRAINT "expenses_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

ALTER TABLE "public"."maintenance_requests"
  ADD CONSTRAINT "maintenance_requests_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;

ALTER TABLE "public"."tenancies"
  ADD CONSTRAINT "tenancies_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;

ALTER TABLE "public"."units"
  ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_billing_month ON public.billing_records USING btree (billing_month);

CREATE INDEX idx_billing_tenancy ON public.billing_records USING btree (tenancy_id);

CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date);

CREATE INDEX idx_maintenance_unit ON public.maintenance_requests USING btree (unit_id);

CREATE INDEX idx_payments_date ON public.payments USING btree (payment_date);

CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id);

CREATE INDEX idx_tenancies_tenant ON public.tenancies USING btree (tenant_id);

CREATE INDEX idx_tenancies_unit ON public.tenancies USING btree (unit_id);

CREATE INDEX idx_units_property ON public.units USING btree (property_id);

CREATE UNIQUE INDEX tenant_portal_access_active_tenant_key ON public.tenant_portal_access USING btree (tenant_id)
  WHERE (revoked_at IS NULL);

CREATE INDEX tenant_portal_access_owner_idx ON public.tenant_portal_access USING btree (owner_id);

CREATE UNIQUE INDEX tenants_tenant_access_key_unique ON public.tenants USING btree (tenant_access_key)
  WHERE (tenant_access_key IS NOT NULL);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row();

CREATE TRIGGER set_expense_property_id_trigger
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_property_id();

CREATE TRIGGER audit_maintenance
  AFTER INSERT OR UPDATE ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row();

CREATE TRIGGER payment_receipt_number
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_receipt_number();

CREATE TRIGGER payment_status_refresh
  AFTER INSERT OR DELETE OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_status_trigger();

CREATE TRIGGER audit_tenancies
  AFTER INSERT OR UPDATE ON public.tenancies
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row();

CREATE TRIGGER tenancy_overlap_guard
  BEFORE INSERT OR UPDATE ON public.tenancies
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenancy_overlap();

CREATE TRIGGER audit_tenants
  AFTER INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row();

CREATE POLICY "audit_owner" ON "public"."audit_logs"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "expenses_owner" ON "public"."expenses"
  FOR ALL
  TO PUBLIC
  USING (public.can_access_property(property_id))
  WITH CHECK (public.can_access_property(property_id));

CREATE POLICY "maintenance_owner" ON "public"."maintenance_requests"
  FOR ALL
  TO PUBLIC
  USING (public.can_access_property(property_id))
  WITH CHECK (public.can_access_property(property_id));

CREATE POLICY "profiles_self" ON "public"."profiles"
  FOR ALL
  TO PUBLIC
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE POLICY "tenant portal owner delete" ON "public"."tenant_portal_access"
  FOR DELETE
  TO "authenticated"
  USING ((owner_id = auth.uid()));

CREATE POLICY "tenant portal owner read" ON "public"."tenant_portal_access"
  FOR SELECT
  TO "authenticated"
  USING ((owner_id = auth.uid()));

CREATE POLICY "units_owner" ON "public"."units"
  FOR ALL
  TO PUBLIC
  USING (public.can_access_property(property_id))
  WITH CHECK (public.can_access_property(property_id));

CREATE POLICY "rental docs delete own" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'rental-documents'::text) AND (OWNER = auth.uid())));

CREATE POLICY "rental docs insert own" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'rental-documents'::text) AND (owner = auth.uid())));

CREATE POLICY "rental docs read own" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'rental-documents'::text) AND (OWNER = auth.uid())));

CREATE POLICY "rental docs update own" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'rental-documents'::text) AND (OWNER = auth.uid())))
  WITH CHECK (((bucket_id = 'rental-documents'::text) AND (owner = auth.uid())));

GRANT EXECUTE ON FUNCTION "public"."assign_receipt_number"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."audit_row"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."audit_row"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."can_access_property"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."can_access_property"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."create_tenancy"(uuid, uuid, date, numeric, integer, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_tenancy"(uuid, uuid, date, numeric, integer, numeric, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."generate_tenant_portal_key"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."generate_tenant_portal_key"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_tenant_monthly_summary"(text, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_tenant_monthly_summary"(text, date) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."list_tenant_portal_keys"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."list_tenant_portal_keys"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."move_out_tenant"(date, text, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."move_out_tenant"(date, text, uuid, uuid) TO "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."payments_status_trigger"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."prevent_tenancy_overlap"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."refresh_billing_status"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."refresh_billing_status"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."revoke_tenant_portal_key"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."revoke_tenant_portal_key"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."set_expense_property_id"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."set_expense_property_id"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."tenant_portal_summary"(text, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."tenant_portal_summary"(text, date) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."transfer_tenant"(uuid, uuid, uuid, date, numeric, integer, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."transfer_tenant"(uuid, uuid, uuid, date, numeric, integer, numeric, text) TO "authenticated", "postgres", "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."receipt_seq" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_records" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."documents" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expenses" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."maintenance_requests" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."properties" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipts" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenancies" TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."tenant_portal_access" FROM "authenticated";

GRANT SELECT ON TABLE "public"."tenant_portal_access" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenant_portal_access" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenants" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."units" TO "anon", "authenticated", "postgres", "service_role";

GRANT USAGE ON TYPE "public"."billing_status" TO "postgres";

GRANT USAGE ON TYPE "public"."maintenance_status" TO "postgres";

GRANT USAGE ON TYPE "public"."priority_level" TO "postgres";

GRANT USAGE ON TYPE "public"."tenancy_status" TO "postgres";

GRANT USAGE ON TYPE "public"."tenant_status" TO "postgres";

GRANT USAGE ON TYPE "public"."unit_status" TO "postgres";

ALTER TABLE "public"."properties"
  ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE POLICY "properties_owner" ON "public"."properties"
  FOR ALL
  TO PUBLIC
  USING ((owner_id = auth.uid()))
  WITH CHECK ((owner_id = auth.uid()));

ALTER TABLE "public"."tenants"
  ADD CONSTRAINT "tenants_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE POLICY "billing_owner" ON "public"."billing_records"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM (public.tenancies t
     JOIN public.tenants tn ON ((tn.id = t.tenant_id)))
  WHERE ((t.id = billing_records.tenancy_id) AND (tn.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tenancies t
     JOIN public.tenants tn ON ((tn.id = t.tenant_id)))
  WHERE ((t.id = billing_records.tenancy_id) AND (tn.owner_id = auth.uid())))));

CREATE POLICY "documents_owner" ON "public"."documents"
  FOR ALL
  TO PUBLIC
  USING ((((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = documents.tenant_id) AND (t.owner_id = auth.uid()))))) OR ((tenancy_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.tenancies te
     JOIN public.tenants t ON ((t.id = te.tenant_id)))
  WHERE ((te.id = documents.tenancy_id) AND (t.owner_id = auth.uid()))))) OR ((payment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.payments p
     JOIN public.tenants t ON ((t.id = p.tenant_id)))
  WHERE ((p.id = documents.payment_id) AND (t.owner_id = auth.uid()))))) OR ((expense_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.expenses e
  WHERE ((e.id = documents.expense_id) AND public.can_access_property(e.property_id))))) OR ((maintenance_request_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.maintenance_requests m
  WHERE ((m.id = documents.maintenance_request_id) AND public.can_access_property(m.property_id)))))))
  WITH CHECK ((((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = documents.tenant_id) AND (t.owner_id = auth.uid()))))) OR ((tenancy_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.tenancies te
     JOIN public.tenants t ON ((t.id = te.tenant_id)))
  WHERE ((te.id = documents.tenancy_id) AND (t.owner_id = auth.uid()))))) OR ((payment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.payments p
     JOIN public.tenants t ON ((t.id = p.tenant_id)))
  WHERE ((p.id = documents.payment_id) AND (t.owner_id = auth.uid()))))) OR ((expense_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.expenses e
  WHERE ((e.id = documents.expense_id) AND public.can_access_property(e.property_id))))) OR ((maintenance_request_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.maintenance_requests m
  WHERE ((m.id = documents.maintenance_request_id) AND public.can_access_property(m.property_id)))))));

CREATE POLICY "payments_owner" ON "public"."payments"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = payments.tenant_id) AND (t.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = payments.tenant_id) AND (t.owner_id = auth.uid())))));

CREATE POLICY "receipts_owner" ON "public"."receipts"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM (public.payments p
     JOIN public.tenants t ON ((t.id = p.tenant_id)))
  WHERE ((p.id = receipts.payment_id) AND (t.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.payments p
     JOIN public.tenants t ON ((t.id = p.tenant_id)))
  WHERE ((p.id = receipts.payment_id) AND (t.owner_id = auth.uid())))));

CREATE POLICY "tenancies_owner" ON "public"."tenancies"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = tenancies.tenant_id) AND (t.owner_id = auth.uid())))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = tenancies.tenant_id) AND (t.owner_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.units u
  WHERE ((u.id = tenancies.unit_id) AND public.can_access_property(u.property_id))))));

CREATE POLICY "tenants_owner" ON "public"."tenants"
  FOR ALL
  TO PUBLIC
  USING ((owner_id = auth.uid()))
  WITH CHECK ((owner_id = auth.uid()));

