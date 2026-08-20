import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns'

export const money = (value = 0) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value) || 0)

export const dateLabel = (value) => {
  if (!value) return '—'
  try { return format(parseISO(value), 'MMM d, yyyy') } catch { return value }
}

export const monthLabel = (value) => {
  if (!value) return '—'
  try { return format(parseISO(value + '-01'), 'MMMM yyyy') } catch { return value }
}

export const currentMonth = () => format(new Date(), 'yyyy-MM')

export const compareUnitNumbers = (left, right) => {
  const leftText = String(left?.unit_number ?? left ?? '').trim()
  const rightText = String(right?.unit_number ?? right ?? '').trim()
  const leftNumber = Number(leftText)
  const rightNumber = Number(rightText)
  const leftIsNumeric = leftText !== '' && Number.isFinite(leftNumber)
  const rightIsNumeric = rightText !== '' && Number.isFinite(rightNumber)

  if (leftIsNumeric && rightIsNumeric) return leftNumber - rightNumber
  if (leftIsNumeric) return -1
  if (rightIsNumeric) return 1

  return leftText.localeCompare(rightText, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

export const billingDueDate = (billingMonth, dueDay) => {
  const [year, month] = billingMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), lastDay)
  return `${billingMonth}-${String(day).padStart(2, '0')}`
}

export const statusFromBilling = (record, today = new Date()) => {
  const due = parseISO(record.due_date)
  const dueAmount = Number(record.amount_due || 0)
  const paid = Number(record.amount_paid || 0)
  if (record.status === 'waived') return 'Waived'
  if (paid >= dueAmount && dueAmount > 0) return 'Paid'
  if (paid > 0) return 'Partially Paid'
  if (isBefore(due, today)) return 'Overdue'
  if (due.toDateString() === today.toDateString()) return 'Due'
  return 'Upcoming'
}

export const monthRange = (month) => {
  const d = parseISO(month + '-01')
  return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') }
}

export const csvDownload = (rows, filename) => {
  const keys = Object.keys(rows[0] || {})
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = [keys.map(esc).join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
