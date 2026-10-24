import Activities from '@/components/Activities';

export const metadata = {
  title: 'ກິດຈະກຳ · Activities — ຢາດົມຫອມລາວ Ya Dom Hom Lao',
  description: 'ເລື່ອງລາວ ແລະ ກິດຈະກຳຂອງຢາດົມຫອມລາວ — ລາງວັນຊະນະເລີດ IYA 2024, ມະຫາວິທະຍາໄລສຸພານຸວົງ ແລະ ຄູ່ຮ່ວມທຸລະກິດໃນຫຼວງພະບາງ.',
  openGraph: {
    title: 'ກິດຈະກຳ ແລະ ຄວາມເຄື່ອນໄຫວ · Ya Dom Hom Lao',
    description: 'From a student idea to a Lao herbal inhaler brand — IYA 2024 first prize.',
    images: [{ url: 'activities/iya-day2-b.webp', width: 899, height: 1599 }, { url: 'activities/product-blue.webp' }],
  },
};

export default function Page() {
  return <Activities />;
}
