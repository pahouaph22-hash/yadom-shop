'use client';
import { useShop } from './Providers';
import { dt } from '@/lib/format';

const FLOW = ['received', 'pending_payment', 'paid', 'shipping', 'delivered'];

export default function OrderTimeline({ status, history = [] }) {
  const { t } = useShop();
  if (status === 'cancelled' || status === 'refunded') {
    return <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{t(`st_${status}`)}</p>;
  }
  const reached = new Map();
  (history || []).forEach((h) => reached.set(h.status, h.at));
  const idx = FLOW.indexOf(status);
  return (
    <ol className="grid gap-0 sm:grid-cols-5" aria-label={t('status')}>
      {FLOW.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start">
            <div className="flex w-full items-center">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-jade text-white' : 'border border-line bg-white text-ink-faint'}`}>{done ? '✓' : ''}</span>
              {i < FLOW.length - 1 && <span className={`mx-1 hidden h-1 flex-1 sm:block ${i < idx ? 'ikat ikat-thin' : 'bg-line'}`} />}
            </div>
            <div className="pb-3 sm:pt-2">
              <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-ink-faint'}`}>{t(`st_${s}`)}</p>
              {reached.get(s) && <p className="text-xs text-ink-faint">{dt(reached.get(s))}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
