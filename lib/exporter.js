'use client';
// rows: array of objects; cols: [{key, label}] (optional — defaults to object keys)
function normalise(rows, cols) {
  const c = cols || (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  return { c, data: rows.map((r) => c.map(({ key }) => {
    const v = typeof key === 'function' ? key(r) : r[key];
    return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
  })) };
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function exportCSV(filename, rows, cols) {
  const { c, data } = normalise(rows, cols);
  const esc = (v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [c.map((x) => esc(x.label)).join(','), ...data.map((r) => r.map(esc).join(','))].join('\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}

// sheets: [{name, rows, cols}]
export async function exportXLSX(filename, sheets) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const { c, data } = normalise(s.rows, s.cols);
    const ws = XLSX.utils.aoa_to_sheet([c.map((x) => x.label), ...data]);
    ws['!cols'] = c.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export function exportJSON(filename, obj) {
  download(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}
