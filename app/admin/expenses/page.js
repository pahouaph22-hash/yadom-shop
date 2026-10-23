'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { PageHead, Alert, Empty, Modal, useLoad, EXP_TH } from '@/components/admin/ui';
import { kip, d, errMsg, todayLocal } from '@/lib/format';
import { exportCSV } from '@/lib/exporter';

const BLANK = { expense_date: '', category: 'packaging', amount: '', description: '', supplier: '', reference: '' };

export default function ExpensesPage() {
  const month = todayLocal().slice(0, 8) + '01';
  const [from, setFrom] = useState(month);
  const [to, setTo] = useState(todayLocal());
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({});
  const [rows, reload, error] = useLoad((sb) => {
    let q = sb.from('expenses').select('*, orders(order_no), products(name_lo)').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false }).order('created_at', { ascending: false });
    if (cat) q = q.eq('category', cat);
    return q;
  }, [from, to, cat]);
  const total = (rows || []).reduce((s, r) => s + Number(r.amount), 0);
  const byCat = (rows || []).reduce((m, r) => ({ ...m, [r.category]: (m[r.category] || 0) + Number(r.amount) }), {});

  async function save(e) {
    e.preventDefault();
    const row = { ...edit, amount: Number(edit.amount), supplier: edit.supplier || null, reference: edit.reference || null, expense_date: edit.expense_date || todayLocal() };
    delete row.orders; delete row.products;
    const sb = getSupabase();
    const res = row.id ? await sb.from('expenses').update(row).eq('id', row.id) : await sb.from('expenses').insert(row);
    if (res.error) return setMsg({ error: errMsg(res.error) });
    setEdit(null); setMsg({ ok: 'บันทึกค่าใช้จ่ายแล้ว' }); reload();
  }
  async function remove(r) {
    if (!window.confirm(`ลบรายการ "${r.description}" ${kip(r.amount)}? (การลบจะถูกบันทึกในประวัติ)`)) return;
    const { error: err } = await getSupabase().from('expenses').delete().eq('id', r.id);
    if (err) setMsg({ error: errMsg(err) }); else reload();
  }

  return (
    <>
      <PageHead title="ค่าใช้จ่าย" sub={`รวม ${kip(total)} ในช่วงที่เลือก`}>
        <button className="btn-ghost" onClick={() => exportCSV(`expenses-${from}-${to}.csv`, rows || [], [
          { key: 'expense_date', label: 'วันที่' }, { key: (r) => EXP_TH[r.category], label: 'หมวด' }, { key: 'description', label: 'รายละเอียด' },
          { key: 'amount', label: 'จำนวนเงิน' }, { key: 'supplier', label: 'ผู้ขาย' }, { key: 'reference', label: 'เลขอ้างอิง' },
          { key: (r) => r.orders?.order_no, label: 'คำสั่งซื้อ' }, { key: (r) => r.products?.name_lo, label: 'สินค้า' },
        ])}>ส่งออก CSV</button>
        <button className="btn-primary" onClick={() => { setMsg({}); setEdit({ ...BLANK, expense_date: todayLocal() }); }}>+ บันทึกค่าใช้จ่าย</button>
      </PageHead>
      <Alert {...msg} /><Alert error={error} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="จากวันที่" />
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="ถึงวันที่" />
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="หมวด"><option value="">ทุกหมวด</option>{Object.entries(EXP_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {Object.keys(byCat).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {Object.entries(byCat).map(([k, v]) => <span key={k} className="rounded-lg border border-line bg-white px-3 py-1.5">{EXP_TH[k]}: <b>{kip(v)}</b></span>)}
        </div>
      )}
      <p className="mb-4 text-xs text-ink-faint">หมวด “ซื้อวัตถุดิบ/สินค้าเข้าสต็อก” ไม่นำไปหักกำไรโดยตรง เพราะต้นทุนสินค้าคิดผ่านต้นทุนต่อชิ้นตอนขายแล้ว (กันการหักซ้ำ)</p>
      {rows === null ? <p className="text-ink-soft">กำลังโหลด…</p> : rows.length === 0 ? <Empty>ไม่มีค่าใช้จ่ายในช่วงนี้</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>วันที่</th><th>หมวด</th><th>รายละเอียด</th><th className="text-right">จำนวนเงิน</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{d(r.expense_date)}</td>
                  <td className="text-xs">{EXP_TH[r.category]}</td>
                  <td>{r.description}<div className="text-xs text-ink-faint">{[r.supplier, r.reference].filter(Boolean).join(' · ')}
                    {r.order_id && <> · <Link className="text-jade" href={`/admin/orders/${r.order_id}`}>{r.orders?.order_no}</Link></>}
                    {r.product_id && <> · <Link className="text-jade" href={`/admin/products/${r.product_id}`}>{r.products?.name_lo}</Link></>}</div></td>
                  <td className="text-right font-semibold">{kip(r.amount)}</td>
                  <td className="whitespace-nowrap text-right"><button className="btn-ghost btn-sm" onClick={() => { setMsg({}); setEdit({ ...r }); }}>แก้ไข</button> <button className="btn-danger btn-sm" onClick={() => remove(r)}>ลบ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'แก้ไขค่าใช้จ่าย' : 'บันทึกค่าใช้จ่าย'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">วันที่</span><input required type="date" className="input" value={edit.expense_date} onChange={(e) => setEdit({ ...edit, expense_date: e.target.value })} /></label>
              <label className="block"><span className="label">จำนวนเงิน (กีบ) *</span><input required type="number" min={1} className="input" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>
            </div>
            <label className="block"><span className="label">หมวด</span><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{Object.entries(EXP_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="block"><span className="label">รายละเอียด *</span><input required maxLength={500} className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ผู้ขาย/ผู้รับเงิน</span><input className="input" value={edit.supplier || ''} onChange={(e) => setEdit({ ...edit, supplier: e.target.value })} /></label>
              <label className="block"><span className="label">เลขที่ใบเสร็จ</span><input className="input" value={edit.reference || ''} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} /></label>
            </div>
            <Alert error={msg.error} />
            <button className="btn-primary w-full">บันทึก</button>
          </form>
        </Modal>
      )}
    </>
  );
}
