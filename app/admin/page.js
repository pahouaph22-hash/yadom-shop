'use client';
import Link from 'next/link';
import { useShop } from '@/components/Providers';
import { PageHead, StatusBadge, Stat, useLoad, Alert, Empty } from '@/components/admin/ui';
import { kip, dt } from '@/lib/format';

const ENTITY_TH = { products: 'สินค้า', orders: 'คำสั่งซื้อ', order_items: 'รายการสินค้าในคำสั่งซื้อ', payments: 'การชำระ/คืนเงิน', customers: 'ลูกค้า', expenses: 'ค่าใช้จ่าย', settings: 'ตั้งค่า', contact_channels: 'ช่องทางติดต่อ', contact_messages: 'ข้อความ', profiles: 'ผู้ใช้', auth: 'เข้าสู่ระบบ', admin_allowlist: 'รายชื่อแอดมิน' };
const ACTION_TH = { insert: 'เพิ่ม', update: 'แก้ไข', delete: 'ลบ', login: 'เข้าสู่ระบบ', logout: 'ออกจากระบบ' };

export default function Dashboard() {
  const { can } = useShop();
  const isAdmin = can('finance');
  const canAudit = can('audit');
  const [d, reload, error] = useLoad((sb) => sb.rpc('dashboard_stats'));
  const [slips] = useLoad((sb) => sb.from('payment_slips').select('id, order_id, created_at, orders(order_no)').eq('status', 'pending').order('created_at'), []);
  if (error) return <Alert error={error} />;
  if (!d) return <p className="text-ink-soft">กำลังโหลด…</p>;
  const today = d.today || {};
  const m = d.month || {};
  const open = d.open_orders || {};
  return (
    <>
      <PageHead title="ภาพรวมวันนี้" sub={new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Vientiane', dateStyle: 'full' })}>
        <button onClick={reload} className="btn-ghost">รีเฟรช</button>
        <Link href="/admin/orders/new" className="btn-primary">+ สร้างคำสั่งซื้อ</Link>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon="💰" label="ยอดขายวันนี้" value={kip(today.gross_sales)} tone="jade" href="/admin/reports" />
        <Stat icon="🛍" label="คำสั่งซื้อวันนี้" value={today.orders_count ?? 0} tone="sky" href="/admin/orders" />
        <Stat icon="✓" label="รับเงินจริงวันนี้" value={kip(Number(today.received || 0) - Number(today.refunds || 0))} tone="gold" />
        <Stat icon="⏳" label="ยอดค้างชำระทั้งหมด" value={kip(d.unpaid_total)} tone="red" href="/admin/orders?unpaid=1" />
      </div>

      {slips?.length > 0 && (
        <div className="mt-6 rounded-xl border-2 border-saffron bg-saffron-pale p-4">
          <p className="font-semibold">มีสลิปการโอนรอตรวจสอบ {slips.length} รายการ</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {slips.map((s) => <Link key={s.id} href={`/admin/orders/view?id=${s.order_id}`} className="btn-ghost btn-sm">{s.orders?.order_no} · {dt(s.created_at)}</Link>)}
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 font-semibold text-ink-soft">เดือนนี้</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon="📈" label="ยอดขาย" value={kip(m.gross_sales)} />
        <Stat icon="💵" label="รับเงินจริง (สุทธิหลังคืนเงิน)" value={kip(Number(m.received || 0) - Number(m.refunds || 0))} tone="gold" />
        <Stat icon="📦" label="ต้นทุนสินค้าที่ขาย" value={kip(m.cogs)} tone="ink" />
        {isAdmin && <Stat icon="🧾" label="ค่าใช้จ่ายดำเนินงาน" value={kip(m.op_expenses)} tone="ink" href="/admin/expenses" />}
        {isAdmin && <Stat icon="✨" label="กำไรโดยประมาณ" value={kip(m.profit)} tone={Number(m.profit) < 0 ? 'red' : 'jade'} href="/admin/reports" />}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="sec-title"><span className="sec-icon tone-jade">🛍</span>คำสั่งซื้อที่ต้องดำเนินการ</h2>
            {Number(d.new_messages) > 0 && <Link href="/admin/messages" className="rounded-full bg-saffron px-2 py-0.5 text-xs font-semibold">ข้อความใหม่ {d.new_messages}</Link>}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {['received', 'pending_payment', 'paid', 'shipping'].map((s) => (
              <Link key={s} href={`/admin/orders?status=${s}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-jade">
                <StatusBadge s={s} /><b>{open[s] || 0}</b>
              </Link>
            ))}
          </div>
          {d.recent_orders.length === 0 ? <Empty>ยังไม่มีคำสั่งซื้อ</Empty> : (
            <table className="tbl">
              <tbody>
                {d.recent_orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/view?id=${o.id}`} className="font-semibold text-jade hover:underline">{o.order_no}</Link><div className="text-xs text-ink-faint">{dt(o.created_at)}</div></td>
                    <td>{o.customer}</td>
                    <td><StatusBadge s={o.status} /></td>
                    <td className="text-right">{kip(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-4 md:p-5">
          <h2 className="sec-title mb-3"><span className="sec-icon tone-rose">⚠</span>สินค้าใกล้หมด</h2>
          {d.low_stock.length === 0 ? <Empty>สต็อกทุกรายการยังเพียงพอ</Empty> : (
            <ul className="divide-y divide-line">
              {d.low_stock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/admin/products/edit?id=${p.id}`} className="hover:text-jade">{p.name} <span className="text-ink-faint">({p.sku})</span></Link>
                  <span className={`font-bold ${p.stock === 0 ? 'text-red-700' : 'text-saffron-deep'}`}>{p.stock} / แจ้งเตือนที่ {p.threshold}</span>
                </li>
              ))}
            </ul>
          )}
          {canAudit && (
            <>
              <div className="mb-3 mt-6 flex items-center justify-between">
                <h2 className="sec-title"><span className="sec-icon tone-indigo">🕘</span>กิจกรรมล่าสุด</h2>
                <Link href="/admin/audit" className="text-sm text-jade hover:underline">ดูทั้งหมด</Link>
              </div>
              <ul className="space-y-2 text-sm">
                {d.recent_activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="w-28 shrink-0 text-xs text-ink-faint">{dt(a.at)}</span>
                    <span>
                      <b>{ACTION_TH[a.action] || a.action}</b> {ENTITY_TH[a.entity] || a.entity}
                      {a.changed_fields && <span className="text-ink-faint"> ({a.changed_fields.join(', ')})</span>}
                      <span className="block text-xs text-ink-faint">{a.actor_email || 'ลูกค้า (หน้าเว็บ)'}{a.note ? ` · ${a.note}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
