'use client';
import { useState } from 'react';
import { useShop } from './Providers';
import { getSupabase } from '@/lib/supabase/client';
import { dt, errMsg } from '@/lib/format';

const SLIP_CLS = { pending: 'bg-saffron-pale text-saffron-deep', approved: 'bg-jade-mist text-jade', rejected: 'bg-red-50 text-red-700' };

export default function PaymentBox({ order, phone, onChanged }) {
  const { t, fmt, settings } = useShop();
  const qrs = (Array.isArray(settings.payment_qr) ? settings.payment_qr : []).filter((q) => q.active !== false && q.image_url);
  const due = Number(order.total) - Number(order.paid || 0);
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState(String(due));
  const [note, setNote] = useState('');
  const [state, setState] = useState({});
  const [copied, setCopied] = useState('');
  const closed = ['cancelled', 'refunded'].includes(order.status);
  if (closed) return null;

  async function send(e) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setState({ error: t('fileTooBig') });
    setState({ busy: true });
    const sb = getSupabase();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${order.order_no}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from('payment-slips').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (up.error) return setState({ error: errMsg(up.error) });
    const { error } = await sb.rpc('submit_slip', {
      p_order_no: order.order_no, p_phone: phone, p_file_path: path, p_amount: Number(amount) || null, p_note: note || null,
    });
    if (error) return setState({ error: errMsg(error) });
    setState({ ok: true }); setFile(null); setNote('');
    onChanged?.();
  }

  return (
    <section className="card space-y-5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">{t('payNow')}</h2>
        {due > 0
          ? <p className="text-sm text-ink-soft">{t('amountDue')} <b className="text-2xl text-jade">{fmt(due)}</b></p>
          : <p className="font-semibold text-jade">✓ {t('paidInFull')}</p>}
      </div>

      {due > 0 && (
        qrs.length === 0 ? <p className="rounded-lg bg-saffron-pale p-3 text-sm">{t('noQr')}</p> : (
          <div>
            <p className="mb-3 text-sm text-ink-soft">{t('scanToPay')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {qrs.map((q) => (
                <figure key={q.id} className="rounded-xl border border-line p-3">
                  <img src={q.image_url} alt={`QR ${q.label || q.bank || ''}`} className="mx-auto aspect-square w-full max-w-[260px] rounded-lg bg-white object-contain" />
                  <figcaption className="mt-3 space-y-1 text-sm">
                    <p className="font-semibold">{q.label || q.bank}</p>
                    {q.account_name && <p>{t('accountName')}: {q.account_name}</p>}
                    {q.account_no && (
                      <div>
                        <p className="text-ink-soft">{t('accountNo')}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="break-all text-base">{q.account_no}</b>
                          <button type="button" className="btn-ghost btn-sm whitespace-nowrap" onClick={() => { navigator.clipboard?.writeText(q.account_no); setCopied(q.id); setTimeout(() => setCopied(''), 1500); }}>
                            {copied === q.id ? `✓ ${t('copied')}` : t('copy')}
                          </button>
                        </div>
                      </div>
                    )}
                    <a href={q.image_url} download target="_blank" rel="noopener noreferrer" className="text-xs text-jade underline">{t('saveQr')}</a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )
      )}

      {due > 0 && (
        <form onSubmit={send} className="space-y-3 rounded-xl bg-jade-wash p-4">
          <p className="font-semibold">{t('uploadSlip')}</p>
          <label className="flex cursor-pointer flex-wrap items-center gap-3">
            <span className="btn-primary">📎 {t('chooseFile')}</span>
            <span className="text-sm text-ink-soft">{file ? file.name : '—'}</span>
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] || null); setState({}); }} />
          </label>
          {file && file.type.startsWith('image/') && <img src={URL.createObjectURL(file)} alt="" className="max-h-48 rounded-lg" />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">{t('amountPaid')}</span>
              <input type="number" min={1} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="block"><span className="label">{t('note')}</span>
              <input maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
          {state.ok && <p role="status" className="rounded-lg bg-jade-mist p-3 text-sm text-jade">✓ {t('slipSent')}</p>}
          <button disabled={!file || state.busy} className="btn-gold w-full">{state.busy ? t('sending') : t('sendSlip')}</button>
        </form>
      )}

      {order.slips?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">{t('yourSlips')}</p>
          <ul className="space-y-2 text-sm">
            {order.slips.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SLIP_CLS[s.status]}`}>{t(`slip_${s.status}`)}</span>
                <span className="text-ink-faint">{dt(s.created_at)}</span>
                {s.amount && <span>{fmt(s.amount)}</span>}
                {s.review_note && <span className="text-ink-soft">— {s.review_note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
