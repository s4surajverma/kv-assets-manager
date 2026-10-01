/**
 * Financial year utility helpers.
 * KVS financial year runs April 1 – March 31.
 * Format: "2025-26"
 */

function current() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

function previous(fy) {
  if (!fy) fy = current();
  const startYear = parseInt(fy.split('-')[0], 10);
  return `${startYear - 1}-${String(startYear).slice(2)}`;
}

function fromDate(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

function startDate(fy) {
  const startYear = parseInt(fy.split('-')[0], 10);
  return new Date(startYear, 3, 1); // April 1
}

function endDate(fy) {
  const startYear = parseInt(fy.split('-')[0], 10);
  return new Date(startYear + 1, 2, 31); // March 31
}

module.exports = { current, previous, fromDate, startDate, endDate };
