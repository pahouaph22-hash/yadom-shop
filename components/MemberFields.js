'use client';
import { useShop } from './Providers';

// Shared member detail fields (register + edit profile)
export default function MemberFields({ f, set, withPhone = true }) {
  const { t } = useShop();
  const opt = <span className="text-xs text-ink-faint"> ({t('optional')})</span>;
  return (
    <>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold text-jade">{t('contactSection')}</legend>
        <label className="block"><span className="label">{t('fullName')} *</span>
          <input required maxLength={120} className="input" value={f.name} onChange={set('name')} autoComplete="name" /></label>
        {withPhone && (
          <label className="block"><span className="label">{t('phone')} *</span>
            <input required inputMode="tel" maxLength={30} className="input" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="020 xxxx xxxx" /></label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t('whatsapp')}{opt}</span><input maxLength={30} className="input" value={f.whatsapp} onChange={set('whatsapp')} /></label>
          <label className="block"><span className="label">{t('facebook')}{opt}</span><input maxLength={160} className="input" value={f.facebook} onChange={set('facebook')} /></label>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold text-jade">{t('addressSection')}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="label">{t('village')} *</span><input required maxLength={80} className="input" value={f.village} onChange={set('village')} /></label>
          <label className="block"><span className="label">{t('district')} *</span><input required maxLength={80} className="input" value={f.district} onChange={set('district')} /></label>
          <label className="block"><span className="label">{t('province')} *</span><input required maxLength={80} className="input" value={f.province} onChange={set('province')} /></label>
        </div>
        <label className="block"><span className="label">{t('address')}{opt}</span>
          <textarea rows={2} maxLength={400} className="input" value={f.address} onChange={set('address')} /></label>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold text-jade">{t('moreSection')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t('gender')}{opt}</span>
            <select className="input" value={f.gender} onChange={set('gender')}>
              <option value="">—</option><option value="female">{t('female')}</option><option value="male">{t('male')}</option><option value="other">{t('otherGender')}</option>
            </select></label>
          <label className="block"><span className="label">{t('birthDate')}{opt}</span><input type="date" min="1920-01-01" max={new Date().toISOString().slice(0, 10)} className="input" value={f.birth_date} onChange={set('birth_date')} /></label>
        </div>
        <label className="block"><span className="label">{t('referral')}{opt}</span>
          <select className="input" value={f.referral_source} onChange={set('referral_source')}>
            <option value="">—</option>
            {['Facebook', 'TikTok', 'WhatsApp', 'Friend', 'Trade show', 'Shop', 'Other'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.marketing_ok} onChange={set('marketing_ok')} /> {t('marketingOk')}</label>
      </fieldset>
    </>
  );
}

export const EMPTY_MEMBER = { name: '', phone: '', whatsapp: '', facebook: '', village: '', district: '', province: '', address: '', gender: '', birth_date: '', referral_source: '', marketing_ok: false };

export function fullAddress(m) {
  return [m.address, m.village && `ບ້ານ ${m.village}`, m.district && `ເມືອງ ${m.district}`].filter(Boolean).join(', ');
}
