'use client';
import { useState } from 'react';
import { useShop } from './Providers';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';

const REASONS = ['cancelR_mistake', 'cancelR_change', 'cancelR_address', 'cancelR_price', 'cancelR_other'];

// Lets a signed-in member cancel their own unpaid order. The server re-checks everything.
export default function CancelOrder({ orderNo, onDone, small = false }) {
  const { t } = useShop();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    const text = [reason && t(reason), note.trim()].filter(Boolean).join(' — ');
    const { error: err } = await getSupabase().rpc('cancel_my_order', { p_order_no: orderNo, p_reason: text || null });
    setBusy(false);
    if (err) return setError(errMsg(err));
    setOpen(false);
    onDone?.();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={`${small ? 'btn-sm' : ''} rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50`}>
        {t('cancelOrder')}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm" role="dialog" aria-label={t('cancelOrderTitle')}>
      <p className="font-semibold text-red-800">{t('cancelOrderTitle')} {orderNo}</p>
      <p className="mt-1 text-ink-soft">{t('cancelOrderHint')}</p>
      <p className="mb-2 mt-3 font-medium">{t('cancelReason')}</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(reason === r ? '' : r)}
            className={`rounded-full border px-3 py-1 text-xs ${reason === r ? 'border-red-600 bg-red-600 text-white' : 'border-line bg-white text-ink-soft hover:border-red-300'}`}>
            {t(r)}
          </button>
        ))}
      </div>
      <textarea className="input mt-3" rows={2} maxLength={300} placeholder={t('cancelNote')} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="mt-2 rounded-lg bg-white p-2 text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          {busy ? '…' : t('confirmCancel')}
        </button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(''); }} className="btn-ghost">{t('keepOrder')}</button>
      </div>
    </div>
  );
}
