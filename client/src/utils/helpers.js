import dayjs from 'dayjs';

export function current() {
  const m = dayjs().month() + 1;
  const y = dayjs().year();
  if (m >= 4) return `${y}-${String(y + 1).slice(2)}`;
  return `${y - 1}-${String(y).slice(2)}`;
}

export function previous(fy) {
  if (!fy) fy = current();
  const s = parseInt(fy.split('-')[0], 10);
  return `${s - 1}-${String(s).slice(2)}`;
}

export function fromDate(date) {
  const d = dayjs(date);
  const m = d.month() + 1;
  const y = d.year();
  if (m >= 4) return `${y}-${String(y + 1).slice(2)}`;
  return `${y - 1}-${String(y).slice(2)}`;
}

export function formatDate(d, includeTime = false) {
  if (!d) return '—';
  return includeTime ? dayjs(d).format('DD-MM-YYYY HH:mm:ss') : dayjs(d).format('DD-MM-YYYY');
}

export function formatCurrency(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}
