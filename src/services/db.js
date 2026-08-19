import { supabase } from "../lib/supabase";
import { billingDueDate, currentMonth } from "../lib/utils";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function unwrap(request) {
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toNumber(value, label = "Value") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return number;
}

function monthKey(value) {
  const valueString = String(value ?? "");

  return /^\d{4}-\d{2}$/.test(valueString) ? valueString : currentMonth();
}

/*
 * The Payments page uses YYYY-MM.
 *
 * Supabase billing_records.billing_month is a DATE,
 * therefore the database value must be YYYY-MM-01.
 *
 * Example:
 * UI:       2026-08
 * Supabase: 2026-08-01
 */
function monthStartDate(value) {
  return `${monthKey(value)}-01`;
}

function monthEndDate(value) {
  const key = monthKey(value);

  const [year, month] = key.split("-").map(Number);

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

async function getDefaultPropertyId() {
  const property = await unwrap(
    supabase
      .from("properties")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  );

  if (!property?.id) {
    throw new Error(
      "No property is configured yet. Open Settings and save your property first.",
    );
  }

  return property.id;
}

async function resolvePropertyId(payload = {}) {
  if (payload.property_id) {
    return payload.property_id;
  }

  if (payload.unit_id) {
    const unit = await unwrap(
      supabase
        .from("units")
        .select("property_id")
        .eq("id", payload.unit_id)
        .maybeSingle(),
    );

    if (unit?.property_id) {
      return unit.property_id;
    }
  }

  return getDefaultPropertyId();
}

/* -------------------------------------------------------------------------- */
/* Main database API                                                          */
/* -------------------------------------------------------------------------- */

export const db = {
  /* ------------------------------------------------------------------------ */
  /* Properties                                                               */
  /* ------------------------------------------------------------------------ */

  properties: {
    list: () => unwrap(supabase.from("properties").select("*").order("name")),

    create: (payload) =>
      unwrap(supabase.from("properties").insert(payload).select().single()),

    update: (id, payload) =>
      unwrap(
        supabase
          .from("properties")
          .update(payload)
          .eq("id", id)
          .select()
          .single(),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Units                                                                    */
  /* ------------------------------------------------------------------------ */

  units: {
    list: (propertyId) => {
      let query = supabase.from("units").select("*").order("unit_number");

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      return unwrap(query);
    },

    create: async (payload) => {
      const property_id = await resolvePropertyId(payload);

      return unwrap(
        supabase
          .from("units")
          .insert({
            ...payload,
            property_id,
          })
          .select()
          .single(),
      );
    },

    update: (id, payload) =>
      unwrap(
        supabase.from("units").update(payload).eq("id", id).select().single(),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Tenants                                                                  */
  /* ------------------------------------------------------------------------ */

  tenants: {
    list: () =>
      unwrap(
        supabase
          .from("tenants")
          .select("*, tenancies(*, units(unit_number, property_id))")
          .order("last_name")
          .order("first_name"),
      ),

    get: (id) =>
      unwrap(
        supabase
          .from("tenants")
          .select(
            "*, tenancies(*, units(unit_number, property_id)), payments(*)",
          )
          .eq("id", id)
          .single(),
      ),

    create: (payload) =>
      unwrap(supabase.from("tenants").insert(payload).select().single()),

    update: (id, payload) =>
      unwrap(
        supabase.from("tenants").update(payload).eq("id", id).select().single(),
      ),

    moveOut: ({ tenantId, tenancyId, moveOutDate, notes }) =>
      unwrap(
        supabase.rpc("move_out_tenant", {
          p_tenancy_id: tenancyId,
          p_tenant_id: tenantId,
          p_move_out_date: moveOutDate,
          p_notes: cleanText(notes),
        }),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Tenant Portal                                                            */
  /* ------------------------------------------------------------------------ */

  tenantPortal: {
    list: () =>
      unwrap(
        supabase.rpc("list_tenant_portal_keys"),
      ),

    generate: (tenantId) =>
      unwrap(
        supabase.rpc("generate_tenant_portal_key", {
          p_tenant_id: tenantId,
        }),
      ),

    revoke: (tenantId) =>
      unwrap(
        supabase.rpc("revoke_tenant_portal_key", {
          p_tenant_id: tenantId,
        }),
      ),

    summary: (accessKey, month) =>
      unwrap(
        supabase.rpc("get_tenant_monthly_summary", {
          p_access_key: accessKey,
          p_month: month ? `${month}-01` : undefined,
        }),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Tenancies                                                                */
  /* ------------------------------------------------------------------------ */

  tenancies: {
    list: () =>
      unwrap(
        supabase
          .from("tenancies")
          .select(
            "*, tenants(first_name,last_name), units(unit_number,property_id,default_rent,status)",
          )
          .order("start_date", {
            ascending: false,
          }),
      ),

    create: (payload) =>
      unwrap(supabase.from("tenancies").insert(payload).select().single()),

    createActive: ({
      tenantId,
      unitId,
      startDate,
      monthlyRent,
      paymentDueDay,
      depositAmount,
      notes,
    }) =>
      unwrap(
        supabase.rpc("create_tenancy", {
          p_tenant_id: tenantId,
          p_unit_id: unitId,
          p_start_date: startDate,
          p_monthly_rent: toNumber(monthlyRent, "Monthly rent"),
          p_payment_due_day: Number(paymentDueDay),
          p_deposit_amount: toNumber(depositAmount || 0, "Deposit"),
          p_notes: cleanText(notes),
        }),
      ),

    update: (id, payload) =>
      unwrap(
        supabase
          .from("tenancies")
          .update(payload)
          .eq("id", id)
          .select()
          .single(),
      ),

    transfer: ({
      tenantId,
      currentTenancyId,
      newUnitId,
      transferDate,
      monthlyRent,
      paymentDueDay,
      depositAmount,
      notes,
    }) =>
      unwrap(
        supabase.rpc("transfer_tenant", {
          p_tenancy_id: currentTenancyId,
          p_tenant_id: tenantId,
          p_new_unit_id: newUnitId,
          p_transfer_date: transferDate,
          p_new_rent: toNumber(monthlyRent, "Monthly rent"),
          p_new_due_day: Number(paymentDueDay),
          p_new_deposit: toNumber(depositAmount || 0, "Deposit"),
          p_notes: cleanText(notes),
        }),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Billing                                                                  */
  /* ------------------------------------------------------------------------ */

  billing: {
    /*
     * Get billing records for the selected month.
     *
     * IMPORTANT:
     * A billing record is only displayed when the tenancy actually
     * overlaps the selected month.
     *
     * This prevents an old tenancy from appearing in future months
     * after a tenant has been transferred.
     *
     * Existing billing/payment records are NOT deleted.
     */
    list: async (month = currentMonth()) => {
      const billingMonth = monthKey(month);
      const monthStart = monthStartDate(billingMonth);
      const monthEnd = monthEndDate(billingMonth);

      const records = await unwrap(
        supabase
          .from("billing_records")
          .select(
            "*, tenancies(tenant_id,unit_id,start_date,end_date,monthly_rent,payment_due_day,tenants(first_name,last_name),units(unit_number,property_id)), payments(*)",
          )
          .eq("billing_month", monthStart)
          .order("due_date"),
      );

      /*
       * Example:
       *
       * Old tenancy:
       *   Aug 20, 2026 -> Aug 31, 2026
       *
       * New tenancy:
       *   Sep 1, 2026 -> NULL
       *
       * September should NOT display the old tenancy.
       *
       * But the old billing/payment records remain in Supabase
       * for historical records.
       */
      return (records || []).filter((record) => {
        const tenancy = record.tenancies;

        if (!tenancy?.start_date) {
          return true;
        }

        // Do not display rent billing for the tenant's
        // move-in month.
        //
        // Example:
        // Move-in: August 1, 2026
        // August billing: NO
        // September billing: YES
        const moveInMonth = String(tenancy.start_date).slice(0, 7);

        if (moveInMonth === billingMonth) {
          return false;
        }

        /*
         * IMPORTANT:
         *
         * Once a billing record exists, keep it visible even
         * when the tenancy has already ended.
         *
         * Historical billing, payments, and receipts must remain
         * accessible after move-out.
         */
        return true;
      });
    },

    create: (payload) =>
      unwrap(
        supabase.from("billing_records").insert(payload).select().single(),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Payments                                                                 */
  /* ------------------------------------------------------------------------ */

  payments: {
    list: () =>
      unwrap(
        supabase
          .from("payments")
          .select(
            "*, billing_records(billing_month,amount_due,tenancy_id), tenants(first_name,last_name), tenancies(units(unit_number),start_date,end_date)",
          )
          .order("payment_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),
      ),

    create: (payload) =>
      unwrap(supabase.from("payments").insert(payload).select().single()),

    update: (id, payload) =>
      unwrap(
        supabase
          .from("payments")
          .update(payload)
          .eq("id", id)
          .select()
          .single(),
      ),

    /*
     * Permanently delete a payment.
     */
    delete: (id) =>
      unwrap(supabase.from("payments").delete().eq("id", id).select().single()),
  },

  /* ------------------------------------------------------------------------ */
  /* Maintenance                                                              */
  /* ------------------------------------------------------------------------ */

  maintenance: {
    list: () =>
      unwrap(
        supabase
          .from("maintenance_requests")
          .select("*, units(unit_number), tenants(first_name,last_name)")
          .order("reported_date", {
            ascending: false,
          }),
      ),

    create: async (payload) => {
      const property_id = await resolvePropertyId(payload);

      return unwrap(
        supabase
          .from("maintenance_requests")
          .insert({
            ...payload,
            property_id,
          })
          .select()
          .single(),
      );
    },

    update: (id, payload) =>
      unwrap(
        supabase
          .from("maintenance_requests")
          .update(payload)
          .eq("id", id)
          .select()
          .single(),
      ),

    delete: (id) =>
      unwrap(
        supabase
          .from("maintenance_requests")
          .delete()
          .eq("id", id)
          .select()
          .single(),
      ),
  },

  /* ------------------------------------------------------------------------ */
  /* Expenses                                                                 */
  /* ------------------------------------------------------------------------ */

  expenses: {
    list: () =>
      unwrap(
        supabase
          .from("expenses")
          .select("*, units(unit_number)")
          .order("expense_date", {
            ascending: false,
          }),
      ),

    create: async (payload) => {
      const property_id = await resolvePropertyId(payload);

      return unwrap(
        supabase
          .from("expenses")
          .insert({
            ...payload,
            property_id,
          })
          .select()
          .single(),
      );
    },

    update: (id, payload) =>
      unwrap(
        supabase
          .from("expenses")
          .update(payload)
          .eq("id", id)
          .select()
          .single(),
      ),

    delete: (id) =>
      unwrap(supabase.from("expenses").delete().eq("id", id).select().single()),
  },

  /* ------------------------------------------------------------------------ */
  /* Audit                                                                    */
  /* ------------------------------------------------------------------------ */

  audit: {
    list: () =>
      unwrap(
        supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", {
            ascending: false,
          })
          .limit(100),
      ),
  },
};

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

export async function recordPayment({
  billingRecord,
  tenantId,
  tenancyId,
  amount,
  paymentDate,
  paymentMethod,
  referenceNumber,
  notes,
}) {
  if (!billingRecord?.id) {
    throw new Error("Billing record is required.");
  }

  const paymentAmount = toNumber(amount, "Payment amount");

  if (paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return db.payments.create({
    billing_record_id: billingRecord.id,
    tenant_id: tenantId,
    tenancy_id: tenancyId || billingRecord.tenancy_id,
    amount: paymentAmount,
    payment_date: paymentDate,
    payment_method: cleanText(paymentMethod) || "Cash",
    reference_number: cleanText(referenceNumber),
    notes: cleanText(notes),
  });
}

/*
 * Permanently delete a payment.
 *
 * The Payments page refreshes billing after this function completes,
 * so the paid amount, balance, and billing status are recalculated.
 */
export async function deletePayment(id) {
  if (!id) {
    throw new Error("Payment ID is required.");
  }

  return db.payments.delete(id);
}

export async function updatePayment(idOrOptions, maybePayload) {
  let id = idOrOptions;
  let payload = maybePayload || {};

  /*
   * Backward-compatible support for the
   * previous object-shaped call.
   */
  if (idOrOptions && typeof idOrOptions === "object") {
    id = idOrOptions.payment?.id;

    payload = {
      amount: idOrOptions.amount,
      payment_date: idOrOptions.paymentDate,
      payment_method: idOrOptions.paymentMethod,
      reference_number: idOrOptions.referenceNumber,
      notes: idOrOptions.notes,
    };
  }

  if (!id) {
    throw new Error("Payment ID is required.");
  }

  const cleaned = {};

  if (payload.amount !== undefined) {
    const amount = toNumber(payload.amount, "Payment amount");

    if (amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    cleaned.amount = amount;
  }

  if (payload.payment_date !== undefined) {
    cleaned.payment_date = payload.payment_date;
  }

  if (payload.payment_method !== undefined) {
    cleaned.payment_method = cleanText(payload.payment_method) || "Cash";
  }

  if (payload.reference_number !== undefined) {
    cleaned.reference_number = cleanText(payload.reference_number);
  }

  if (payload.notes !== undefined) {
    cleaned.notes = cleanText(payload.notes);
  }

  return db.payments.update(id, cleaned);
}

/* -------------------------------------------------------------------------- */
/* Billing                                                                    */
/* -------------------------------------------------------------------------- */

export async function generateBillingForActiveTenancies(
  month = currentMonth(),
) {
  const billingMonth = monthKey(month);

  /*
   * billing_records.billing_month is DATE.
   *
   * Example:
   * 2026-08 -> 2026-08-01
   */
  const monthStart = monthStartDate(billingMonth);

  const monthEnd = monthEndDate(billingMonth);

  const tenancies = await db.tenancies.list();

  /*
   * A tenancy is billable for a month when
   * its rental period overlaps that month.
   *
   * Do NOT rely only on status === "active".
   *
   * Example:
   *
   * Sep 1 - Sep 15
   * -> September is billable
   *
   * Aug 20 - Aug 31
   * -> September is NOT billable
   */
  const eligible = (tenancies || []).filter((tenancy) => {
    if (!tenancy.start_date) {
      return false;
    }

    // Rent billing starts the month AFTER move-in.
    // Example:
    // Move-in: 2026-08-01
    // August:  NO billing
    // September: YES billing
    const moveInMonth = String(tenancy.start_date).slice(0, 7);

    if (moveInMonth === billingMonth) {
      return false;
    }

    // The tenancy must overlap the selected billing month.
    const startsBeforeMonthEnds = tenancy.start_date <= monthEnd;

    const endsAfterMonthStarts =
      !tenancy.end_date || tenancy.end_date >= monthStart;

    return startsBeforeMonthEnds && endsAfterMonthStarts;
  });

  const existing = await db.billing.list(billingMonth);

  const existingIds = new Set(
    (existing || []).map((record) => record.tenancy_id),
  );

  const payloads = eligible
    .filter((tenancy) => !existingIds.has(tenancy.id))
    .map((tenancy) => ({
      tenancy_id: tenancy.id,

      /*
       * IMPORTANT:
       * billing_month is DATE.
       */
      billing_month: monthStartDate(billingMonth),

      due_date: billingDueDate(billingMonth, tenancy.payment_due_day),

      amount_due: Number(tenancy.monthly_rent || 0),

      status: "upcoming",
    }));

  if (!payloads.length) {
    return [];
  }

  return unwrap(supabase.from("billing_records").insert(payloads).select());
}

export async function syncBillingStatuses(month = currentMonth()) {
  const billingRecords = Array.isArray(month)
    ? month
    : await db.billing.list(monthKey(month));

  const today = new Date().toISOString().slice(0, 10);

  const updates = [];

  for (const billing of billingRecords || []) {
    if (billing.status === "waived") {
      updates.push(billing);
      continue;
    }

    const paid = (billing.payments || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    const amountDue = Number(billing.amount_due || 0);

    const balance = Math.max(amountDue - paid, 0);

    let status = "upcoming";

    if (amountDue > 0 && balance <= 0) {
      status = "paid";
    } else if (paid > 0) {
      status = "partially_paid";
    } else if (billing.due_date < today) {
      status = "overdue";
    } else if (billing.due_date === today) {
      status = "due";
    }

    if (billing.status === status) {
      updates.push({
        ...billing,
        _paid: paid,
        _balance: balance,
      });

      continue;
    }

    const updated = await unwrap(
      supabase
        .from("billing_records")
        .update({
          status,
        })
        .eq("id", billing.id)
        .select()
        .single(),
    );

    updates.push({
      ...updated,
      _paid: paid,
      _balance: balance,
    });
  }

  return updates;
}

export async function syncBillingStatusesForMonths(months = []) {
  const uniqueMonths = [...new Set(months.filter(Boolean).map(monthKey))];

  const results = [];

  for (const month of uniqueMonths) {
    results.push(...(await syncBillingStatuses(month)));
  }

  return results;
}

/* -------------------------------------------------------------------------- */
/* CSV/XLSX imports                                                           */
/* -------------------------------------------------------------------------- */

export async function importExpenses(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      importedCount: 0,
      errorCount: 0,
      skippedCount: 0,
      errors: [],
      imported: [],
    };
  }

  const imported = [];
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      const amount = toNumber(row.amount, `Row ${index + 2} amount`);

      if (amount < 0) {
        throw new Error("Amount cannot be negative.");
      }

      let unit_id = row.unit_id || null;

      if (!unit_id && row.unit) {
        const unit = await unwrap(
          supabase
            .from("units")
            .select("id")
            .eq("unit_number", String(row.unit).trim())
            .limit(1)
            .maybeSingle(),
        );

        if (!unit?.id) {
          throw new Error(
            `Unit "${String(row.unit).trim()}" could not be found.`,
          );
        }

        unit_id = unit.id;
      }

      const property_id = await resolvePropertyId({
        property_id: row.property_id,
        unit_id,
      });

      const expense = await unwrap(
        supabase
          .from("expenses")
          .insert({
            property_id,
            unit_id,
            expense_date: row.date || row.expense_date,
            category: cleanText(row.category) || "Other",
            description: cleanText(row.description) || "Imported expense",
            amount,
            vendor: cleanText(row.vendor),
            payment_method: cleanText(row.payment_method || row.method),
            reference: cleanText(row.reference),
            notes: cleanText(row.notes || row.remark),
          })
          .select()
          .single(),
      );

      imported.push(expense);
    } catch (error) {
      errors.push({
        row: index + 2,
        error: error.message || "Import failed.",
      });
    }
  }

  return {
    importedCount: imported.length,
    errorCount: errors.length,
    errors,
    imported,
  };
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function findTenantForImport(row) {
  if (row.tenant_id) {
    return unwrap(
      supabase
        .from("tenants")
        .select("id,first_name,last_name")
        .eq("id", row.tenant_id)
        .maybeSingle(),
    );
  }

  const tenantName = String(row.tenant || row.tenant_name || "").trim();

  if (!tenantName) {
    return null;
  }

  const tenants = await unwrap(
    supabase
      .from("tenants")
      .select("id,first_name,last_name")
      .order("last_name")
      .order("first_name"),
  );

  return (
    (tenants || []).find(
      (tenant) =>
        normalizeName(
          `${tenant.first_name || ""} ${tenant.last_name || ""}`,
        ) === normalizeName(tenantName),
    ) || null
  );
}

async function findTenancyForPayment(tenantId, paymentDate, row) {
  if (row.tenancy_id) {
    const explicit = await unwrap(
      supabase
        .from("tenancies")
        .select("*")
        .eq("id", row.tenancy_id)
        .maybeSingle(),
    );

    if (explicit) {
      return explicit;
    }
  }

  const tenancies = await unwrap(
    supabase
      .from("tenancies")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("start_date", {
        ascending: false,
      }),
  );

  const matching = (tenancies || []).find(
    (tenancy) =>
      tenancy.start_date <= paymentDate &&
      (!tenancy.end_date || tenancy.end_date >= paymentDate),
  );

  if (matching) {
    return matching;
  }

  return (
    (tenancies || []).find((tenancy) => tenancy.status === "active") || null
  );
}

export async function importPayments(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      importedCount: 0,
      errorCount: 0,
      skippedCount: 0,
      errors: [],
      imported: [],
    };
  }

  const imported = [];
  const errors = [];

  let skippedCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      const tenant = await findTenantForImport(row);

      if (!tenant) {
        throw new Error(
          `Tenant "${row.tenant || row.tenant_name || ""}" could not be found.`,
        );
      }

      const paymentDate = String(row.date || row.payment_date || "").slice(
        0,
        10,
      );

      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        throw new Error("Payment date must use YYYY-MM-DD format.");
      }

      const amount = toNumber(row.amount, `Row ${index + 2} amount`);

      if (amount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }

      const tenancy = await findTenancyForPayment(tenant.id, paymentDate, row);

      if (!tenancy) {
        throw new Error(
          `No tenancy could be matched for ${tenant.first_name} ${tenant.last_name}.`,
        );
      }

      const billingMonth = paymentDate.slice(0, 7);

      /*
       * billing_month is a DATE.
       * Convert YYYY-MM to YYYY-MM-01
       * before querying Supabase.
       */
      let billing = await unwrap(
        supabase
          .from("billing_records")
          .select("*")
          .eq("tenancy_id", tenancy.id)
          .eq("billing_month", monthStartDate(billingMonth))
          .maybeSingle(),
      );

      const moveInMonth = String(tenancy.start_date || "").slice(0, 7);

      if (!billing && moveInMonth === billingMonth) {
        throw new Error(
          `Cannot create rent billing for ${tenancy.first_name || "tenant"} during the move-in month (${billingMonth}).`,
        );
      }

      if (!billing) {
        billing = await unwrap(
          supabase
            .from("billing_records")
            .insert({
              tenancy_id: tenancy.id,
              billing_month: monthStartDate(billingMonth),
              due_date: billingDueDate(billingMonth, tenancy.payment_due_day),
              amount_due: Number(tenancy.monthly_rent || 0),
              status: "upcoming",
            })
            .select()
            .single(),
        );
      }

      const paymentMethod =
        cleanText(row.method || row.payment_method) || "Cash";

      const reference = cleanText(row.reference || row.reference_number);

      const notes =
        cleanText(row.notes || row.remark || row.remarks) ||
        "Imported from spreadsheet";

      /*
       * Skip an exact duplicate
       * instead of creating the same
       * payment twice.
       */
      const existing = await unwrap(
        supabase
          .from("payments")
          .select("*")
          .eq("billing_record_id", billing.id)
          .eq("payment_date", paymentDate)
          .eq("amount", amount)
          .eq("payment_method", paymentMethod)
          .limit(20),
      );

      const duplicate = (existing || []).find(
        (payment) =>
          (payment.reference_number || null) === reference &&
          (payment.notes || null) === notes,
      );

      if (duplicate) {
        skippedCount += 1;
        continue;
      }

      const payment = await unwrap(
        supabase
          .from("payments")
          .insert({
            billing_record_id: billing.id,

            tenant_id: tenant.id,

            tenancy_id: tenancy.id,

            amount,

            payment_date: paymentDate,

            payment_method: paymentMethod,

            reference_number: reference,

            notes,
          })
          .select()
          .single(),
      );

      imported.push(payment);
    } catch (error) {
      errors.push({
        row: index + 2,
        error: error.message || "Import failed.",
      });
    }
  }

  await syncBillingStatusesForMonths([
    ...new Set(
      rows
        .map((row) => String(row.date || row.payment_date || "").slice(0, 7))
        .filter(Boolean),
    ),
  ]);

  return {
    importedCount: imported.length,
    errorCount: errors.length,
    skippedCount,
    errors,
    imported,
  };
}
