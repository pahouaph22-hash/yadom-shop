export const CARRIERS = {
  anousith: { lo: 'ອານຸສິດ ຂົນສົ່ງ', th: 'อนุสิด ขนส่ง', en: 'Anousith Express' },
  hal: { lo: 'ຮຸ່ງອາລຸນ (HAL)', th: 'ฮุ่งอรุณ (HAL)', en: 'Houng Aloun (HAL)' },
  mixay: { lo: 'ມີໄຊ ຂົນສົ່ງ', th: 'มีไซ ขนส่ง', en: 'Mixay Express' },
  unitel: { lo: 'Unitel Logistics', th: 'Unitel Logistics', en: 'Unitel Logistics' },
  self: { lo: 'ຮ້ານສົ່ງເອງ', th: 'ร้านส่งเอง', en: 'Shop delivery' },
  other: { lo: 'ອື່ນໆ', th: 'อื่น ๆ', en: 'Other' },
};
export const carrierLabel = (s, lang = 'th') => s.carrier_name || CARRIERS[s.carrier]?.[lang] || s.carrier;

// Lao mobile numbers → WhatsApp international format (856…)
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('856')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return '856' + d;
}
