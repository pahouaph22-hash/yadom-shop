'use client';
import Link from 'next/link';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { PageHead, Alert, Stat, useLoad, STATUS_TH, PM_TH, EXP_TH, CHANNEL_TH } from '@/components/admin/ui';
import { kip, dt, errMsg, todayLocal } from '@/lib/format';
import { exportCSV, exportXLSX } from '@/lib/exporter';

function periodRange(p, grain) {
  const [y, m] = p.split('-').map(Number);
  if (grain === 'day') return [p, p];
  if (grain === 'month') return [p, new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)];
  return [`${y}-01-01`, `${y}-12-31`];
}

export default function ReportsPage() {
  const { can } = useShop();
  const isAdmin = can('finance');
  const today = todayLocal();
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [grain, setGrain] = useState('day');
  const [msg, setMsg] = useState('');
  const [series, , error] = useLoad((sb) => sb.rpc('report_series', { p_from: from, p_to: to, p_grain: grain }), [from, to, grain]);
  const [prods] = useLoad((sb) => sb.rpc('report_products', { p_from: from, p_to: to }), [from, to]);

  const sum = (k) => (series || []).reduce((s, r) => s + Number(r[k] || 0), 0);
  const preset = (kind) => {
    const y = today.slice(0, 4);
    if (kind === 'today') { setFrom(today); setTo(today); setGrain('day'); }
    if (kind === 'month') { setFrom(today.slice(0, 8) + '01'); setTo(today); setGrain('day'); }
    if (kind === 'year') { setFrom(`${y}-01-01`); setTo(today); setGrain('month'); }
    if (kind === 'years') { setFrom(`${Number(y) - 4}-01-01`); setTo(today); setGrain('year'); }
  };

  const SERIES_COLS = [
    { key: 'period', label: 'ช่วงเวลา' }, { key: 'orders_count', label: 'คำสั่งซื้อ' }, { key: 'gross_sales', label: 'ยอดขาย' },
    { key: 'items_sold', label: 'ชิ้นที่ขาย' }, { key: 'received', label: 'รับเงิน' }, { key: 'refunds', label: 'คืนเงิน' },
    { key: 'cogs', label: 'ต้นทุนสินค้า' }, ...(isAdmin ? [{ key: 'op_expenses', label: 'ค่าใช้จ่ายดำเนินงาน' }, { key: 'inventory_purchases', label: 'ซื้อสต็อก' }, { key: 'profit', label: 'กำไร' }] : []),
  ];
  const PROD_COLS = [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'สินค้า' }, { key: 'qty_sold', label: 'ขายได้ (ชิ้น)' }, { key: 'sales', label: 'ยอดขาย' }, { key: 'cogs', label: 'ต้นทุน' }, { key: 'stock', label: 'คงเหลือปัจจุบัน' }];

  async function exportFull() {
    setMsg('');
    const sb = getSupabase();
    const s = `${from}T00:00:00+07:00`; const e = `${to}T23:59:59+07:00`;
    const [orders, items, pays, exps] = await Promise.all([
      sb.from('orders').select('*, customers(name)').gte('created_at', s).lte('created_at', e).order('created_at').limit(20000),
      sb.from('order_items').select('*, orders!inner(order_no,created_at,status)').gte('orders.created_at', s).lte('orders.created_at', e).gt('qty', 0).limit(50000),
      sb.from('payments').select('*, orders(order_no)').gte('paid_at', s).lte('paid_at', e).order('paid_at').limit(20000),
      isAdmin ? sb.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date') : Promise.resolve({ data: [] }),
    ]);
    const err = orders.error || items.error || pays.error || exps.error;
    if (err) return setMsg(errMsg(err));
    await exportXLSX(`report-${from}_${to}.xlsx`, [
      { name: 'สรุป', rows: series || [], cols: SERIES_COLS },
      { name: 'สินค้า', rows: prods || [], cols: PROD_COLS },
      { name: 'คำสั่งซื้อ', rows: orders.data, cols: [
        { key: 'order_no', label: 'เลขที่' }, { key: (o) => dt(o.created_at), label: 'วันที่' }, { key: (o) => o.customers?.name, label: 'ลูกค้า' },
        { key: (o) => CHANNEL_TH[o.channel], label: 'ช่องทาง' }, { key: (o) => STATUS_TH[o.status], label: 'สถานะ' },
        { key: 'subtotal', label: 'ค่าสินค้า' }, { key: 'discount', label: 'ส่วนลด' }, { key: 'shipping_fee', label: 'ค่าส่ง' }, { key: 'total', label: 'ยอดรวม' },
        { key: 'paid_amount', label: 'ชำระ' }, { key: 'refunded_amount', label: 'คืนเงิน' }] },
      { name: 'รายการสินค้า', rows: items.data, cols: [
        { key: (i) => i.orders.order_no, label: 'เลขคำสั่งซื้อ' }, { key: (i) => STATUS_TH[i.orders.status], label: 'สถานะ' }, { key: 'sku', label: 'SKU' },
        { key: 'product_name', label: 'สินค้า' }, { key: 'qty', label: 'จำนวน' }, { key: 'unit_price', label: 'ราคา/หน่วย' }, { key: 'line_total', label: 'รวม' }, { key: 'unit_cost', label: 'ต้นทุน/หน่วย' }] },
      { name: 'การชำระเงิน', rows: pays.data, cols: [
        { key: (p) => dt(p.paid_at), label: 'วันที่' }, { key: (p) => p.orders?.order_no, label: 'เลขคำสั่งซื้อ' }, { key: (p) => (p.kind === 'refund' ? 'คืนเงิน' : 'รับชำระ'), label: 'ประเภท' },
        { key: (p) => PM_TH[p.method], label: 'วิธี' }, { key: 'reference', label: 'อ้างอิง' }, { key: 'amount', label: 'จำนวน' }] },
      ...(isAdmin ? [{ name: 'ค่าใช้จ่าย', rows: exps.data, cols: [
        { key: 'expense_date', label: 'วันที่' }, { key: (r) => EXP_TH[r.category], label: 'หมวด' }, { key: 'description', label: 'รายละเอียด' }, { key: 'amount', label: 'จำนวน' }, { key: 'reference', label: 'อ้างอิง' }] }] : []),
    ]);
  }

  return (
    <>
      <PageHead title="รายงานยอดขาย" sub="ทุกตัวเลขกดย้อนไปดูคำสั่งซื้อต้นทางได้">
        <button className="btn-ghost" onClick={() => exportCSV(`summary-${from}_${to}.csv`, series || [], SERIES_COLS)}>CSV (สรุป)</button>
        <button className="btn-primary" onClick={exportFull}>Excel (ครบทุกแผ่นงาน)</button>
      </PageHead>
      <Alert error={error || msg} />
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label><span className="label">จาก</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">ถึง</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label><span className="label">สรุปเป็นราย</span>
          <select className="input" value={grain} onChange={(e) => setGrain(e.target.value)}><option value="day">วัน</option><option value="month">เดือน</option><option value="year">ปี</option></select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={() => preset('today')}>วันนี้</button>
          <button className="btn-ghost btn-sm" onClick={() => preset('month')}>เดือนนี้</button>
          <button className="btn-ghost btn-sm" onClick={() => preset('year')}>ปีนี้ (รายเดือน)</button>
          <button className="btn-ghost btn-sm" onClick={() => preset('years')}>5 ปี (รายปี)</button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ยอดขาย (ไม่รวมที่ยกเลิก/คืนเงิน)" value={kip(sum('gross_sales'))} href={`/admin/orders?from=${from}&to=${to}`} />
        <Stat label="รับเงินจริงสุทธิ" value={kip(sum('received') - sum('refunds'))} tone="gold" />
        <Stat label="ต้นทุนสินค้าที่ขาย" value={kip(sum('cogs'))} tone="ink" />
        {isAdmin ? <Stat label="กำไรสุทธิ" value={kip(sum('profit'))} tone={sum('profit') < 0 ? 'red' : 'jade'} /> : <Stat label="จำนวนชิ้นที่ขาย" value={sum('items_sold')} tone="ink" />}
      </div>
      {isAdmin && <p className="mb-4 text-xs text-ink-faint">กำไรสุทธิ = เงินที่ได้รับจริง − เงินที่คืนลูกค้า − ต้นทุนสินค้า (ต้นทุน+บรรจุภัณฑ์ของคำสั่งซื้อที่ชำระ/จัดส่ง/ส่งมอบแล้ว) − ค่าใช้จ่ายดำเนินงาน (ไม่รวมการซื้อสต็อก)</p>}

      <div className="card mb-6 overflow-x-auto">
        <table className="tbl">
          <thead><tr>{SERIES_COLS.map((c) => <th key={c.label} className={c.key === 'period' ? '' : 'text-right'}>{c.label}</th>)}</tr></thead>
          <tbody>
            {(series || []).map((r) => {
              const [a, b] = periodRange(r.period, grain);
              return (
                <tr key={r.period}>
                  <td><Link className="font-semibold text-jade hover:underline" href={`/admin/orders?from=${a}&to=${b}`}>{grain === 'year' ? r.period.slice(0, 4) : grain === 'month' ? r.period.slice(0, 7) : r.period}</Link></td>
                  {SERIES_COLS.slice(1).map((c) => <td key={c.label} className={`text-right ${c.key === 'profit' && Number(r.profit) < 0 ? 'text-red-700' : ''}`}>{['orders_count', 'items_sold'].includes(c.key) ? r[c.key] : kip(r[c.key])}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="card overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">สินค้าที่ขายได้และสินค้าคงเหลือ</h2>
          <button className="btn-ghost btn-sm" onClick={() => exportCSV(`products-${from}_${to}.csv`, prods || [], PROD_COLS)}>CSV</button>
        </div>
        <table className="tbl">
          <thead><tr><th>สินค้า</th><th className="text-right">ขายได้ (ชิ้น)</th><th className="text-right">ยอดขาย</th><th className="text-right">ต้นทุน</th><th className="text-right">คงเหลือ</th></tr></thead>
          <tbody>
            {(prods || []).map((p) => (
              <tr key={p.product_id}>
                <td><Link href={`/admin/products/edit?id=${p.product_id}`} className="text-jade hover:underline">{p.name}</Link> <span className="text-xs text-ink-faint">{p.sku}</span></td>
                <td className="text-right">{p.qty_sold}</td><td className="text-right">{kip(p.sales)}</td><td className="text-right">{kip(p.cogs)}</td><td className="text-right font-semibold">{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
