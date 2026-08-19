
-- Rentuki tenant portal access
-- Run once in Supabase SQL Editor after the current production schema is in place.

create extension if not exists pgcrypto;

create table if not exists public.tenant_portal_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  key_hash text not null unique,
  key_preview text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists tenant_portal_access_active_tenant_key
  on public.tenant_portal_access (tenant_id)
  where revoked_at is null;

create index if not exists tenant_portal_access_owner_idx
  on public.tenant_portal_access (owner_id);

alter table public.tenant_portal_access enable row level security;

drop policy if exists "tenant portal owner read" on public.tenant_portal_access;
create policy "tenant portal owner read"
on public.tenant_portal_access
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "tenant portal owner delete" on public.tenant_portal_access;
create policy "tenant portal owner delete"
on public.tenant_portal_access
for delete
to authenticated
using (owner_id = auth.uid());

create or replace function public.generate_tenant_portal_key(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
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

create or replace function public.revoke_tenant_portal_key(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $function$
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

create or replace function public.list_tenant_portal_keys()
returns table (
  tenant_id uuid,
  key_preview text,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $function$
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

create or replace function public.get_tenant_monthly_summary(
  p_access_key text,
  p_month date default date_trunc('month', current_date)::date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
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

revoke all on public.tenant_portal_access from anon;
revoke all on public.tenant_portal_access from authenticated;

grant select on public.tenant_portal_access to authenticated;

revoke all on function public.generate_tenant_portal_key(uuid) from public, anon;
grant execute on function public.generate_tenant_portal_key(uuid) to authenticated;

revoke all on function public.revoke_tenant_portal_key(uuid) from public, anon;
grant execute on function public.revoke_tenant_portal_key(uuid) to authenticated;

revoke all on function public.list_tenant_portal_keys() from public, anon;
grant execute on function public.list_tenant_portal_keys() to authenticated;

revoke all on function public.get_tenant_monthly_summary(text, date) from public, authenticated;
grant execute on function public.get_tenant_monthly_summary(text, date) to anon;

