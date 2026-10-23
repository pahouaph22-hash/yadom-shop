export function money(lak, currency = 'LAK', rate = 650) {
  const n = Number(lak || 0);
  if (currency === 'THB') {
    const v = n / (Number(rate) || 650);
    return '฿' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return n.toLocaleString('en-US') + ' ₭';
}
export const kip = (n) => Number(n || 0).toLocaleString('en-US') + ' ₭';

export function dt(v) {
  if (!v) return '';
  return new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function d(v) {
  if (!v) return '';
  return new Date(v).toLocaleDateString('en-GB', { timeZone: 'Asia/Vientiane', day: '2-digit', month: 'short', year: 'numeric' });
}
export function todayLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' });
}
export function pickLang(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.lo || obj.th || obj.en || '';
}
export function productName(p, lang) {
  return (lang === 'th' && p.name_th) || (lang === 'en' && p.name_en) || p.name_lo;
}
export function productDesc(p, lang) {
  return (lang === 'th' && p.description_th) || (lang === 'en' && p.description_en) || p.description_lo || '';
}
export function errMsg(e) {
  if (!e) return '';
  return (e.message || String(e)).replace(/^.*?ERROR:\s*/, '');
}
