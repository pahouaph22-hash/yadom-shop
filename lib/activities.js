// Activities / news shown on /activities and the home page.
// Images live in public/activities (NAME.webp = large, NAME-sm.webp = thumbnail).
// To add a new activity: process photos the same way and add an entry at the top of EVENTS.

export const STORY = {
  kicker: { lo: 'ເລື່ອງລາວຂອງພວກເຮົາ', th: 'เรื่องราวของเรา', en: 'Our story' },
  title: {
    lo: 'ຈາກແນວຄິດຂອງນັກສຶກສາ ສູ່ແບຣນຢາດົມສະໝຸນໄພລາວ',
    th: 'จากไอเดียของนักศึกษา สู่แบรนด์ยาดมสมุนไพรลาว',
    en: 'From a student idea to a Lao herbal inhaler brand',
  },
  body: {
    lo: 'ໂຄງການຢາດົມຫອມລາວ ເກີດຂຶ້ນຈາກການແຂ່ງຂັນຂອງໂຄງການ IYA (Incubating Young Agripreneurs) ເພື່ອພັດທະນາຜະລິດຕະພັນທີ່ສ້າງສັນ. ທີມງານຂອງພວກເຮົາເລືອກເຮັດຢາດົມສະໝຸນໄພລາວ ເພາະຢາກສືບສານພູມປັນຍາທ້ອງຖິ່ນໃຫ້ເຂົ້າກັບຍຸກສະໄໝໃໝ່ — ພັດທະນາທັງສູດ ແລະ ດີໄຊບັນຈຸພັນໃຫ້ທັນສະໄໝ ພ້ອມກິ່ນຫອມທີ່ຊ່ວຍໃຫ້ສົດຊື່ນ ຜ່ອນຄາຍ ແລະ ໃຊ້ງານງ່າຍໃນຊີວິດປະຈຳວັນ.',
    th: 'โครงการยาดมหอมลาวเกิดขึ้นจากการแข่งขันของโครงการ IYA (Incubating Young Agripreneurs) เพื่อพัฒนาผลิตภัณฑ์ที่สร้างสรรค์ ทีมของเราเลือกทำยาดมสมุนไพรลาว เพราะอยากสืบสานภูมิปัญญาท้องถิ่นให้เข้ากับยุคสมัยใหม่ — พัฒนาทั้งสูตรและดีไซน์บรรจุภัณฑ์ให้ทันสมัย พร้อมกลิ่นหอมที่ช่วยให้สดชื่น ผ่อนคลาย และใช้งานง่ายในชีวิตประจำวัน',
    en: 'Ya Dom Hom Lao began as an entry in the IYA (Incubating Young Agripreneurs) competition for creative new products. Our team chose to make a Lao herbal inhaler to carry local herbal wisdom into modern life — reworking both the formula and the packaging, with a fresh, relaxing scent that is easy to use every day.',
  },
  award: {
    lo: 'ຜົນງານຂອງພວກເຮົາໄດ້ຮັບ ລາງວັນຊະນະເລີດ ຈາກການປະກວດ — ເປັນກຳລັງໃຈໃນການສ້າງແບຣນລາວໃຫ້ໂດດເດັ່ນ',
    th: 'ผลงานของเราได้รับ รางวัลชนะเลิศ จากการประกวด — เป็นกำลังใจในการสร้างแบรนด์ลาวให้โดดเด่น',
    en: 'Our work won first prize in the competition — a big encouragement to build a standout Lao brand',
  },
  facts: [
    { icon: '🏆', lo: 'ລາງວັນຊະນະເລີດ IYA', th: 'รางวัลชนะเลิศ IYA', en: 'IYA first prize' },
    { icon: '🎓', lo: 'ສູນບົ່ມເພາະທຸລະກິດ ມ.ສຸພານຸວົງ', th: 'ศูนย์บ่มเพาะธุรกิจ ม.สุพานุวง', en: 'Souphanouvong University incubator' },
    { icon: '🤝', lo: 'ຮ່ວມມືກັບ Wonders International (ເກົາຫຼີ)', th: 'ร่วมมือกับ Wonders International (เกาหลี)', en: 'With Wonders International (Korea)' },
    { icon: '🌿', lo: 'ສະໝຸນໄພລາວ 100%', th: 'สมุนไพรลาว 100%', en: '100% Lao herbs' },
  ],
  poster: 'story-poster',
};

export const EVENTS = [
  {
    id: 'aromdee',
    place: { lo: 'ຫຼວງພະບາງ', th: 'หลวงพระบาง', en: 'Luang Prabang' },
    tag: { lo: 'ຄູ່ຮ່ວມທຸລະກິດ', th: 'พันธมิตร', en: 'Partners' },
    title: {
      lo: 'ພົບປະຮ້ານ Aromdee (ອາລົມດີ) ຫຼວງພະບາງ',
      th: 'พบปะร้าน Aromdee (อารมณ์ดี) หลวงพระบาง',
      en: 'Meeting Aromdee in Luang Prabang',
    },
    body: {
      lo: 'ທີມງານໄດ້ໄປນຳສະເໜີຢາດົມຫອມລາວ ແລະ ແລກປ່ຽນຄຳຄິດເຫັນກັບຮ້ານ Aromdee — ຮ້ານກາເຟ ແລະ ຜະລິດຕະພັນທຳມະຊາດຄຸນນະພາບຈາກຫຼວງພະບາງ — ເພື່ອພັດທະນາສິນຄ້າ ແລະ ຂະຫຍາຍຊ່ອງທາງໃຫ້ນັກທ່ອງທ່ຽວໄດ້ຮູ້ຈັກຢາດົມລາວຫຼາຍຂຶ້ນ.',
      th: 'ทีมงานได้ไปนำเสนอยาดมหอมลาว และแลกเปลี่ยนความคิดเห็นกับร้าน Aromdee — ร้านกาแฟและผลิตภัณฑ์ธรรมชาติคุณภาพจากหลวงพระบาง — เพื่อพัฒนาสินค้าและขยายช่องทางให้นักท่องเที่ยวได้รู้จักยาดมลาวมากขึ้น',
      en: 'Our team presented Ya Dom Hom Lao to Aromdee — a coffee roastery and natural-products shop in Luang Prabang — gathering feedback and exploring ways to bring Lao inhalers to more visitors.',
    },
    cover: 'aromdee-front-2',
    photos: ['aromdee-front-2', 'aromdee-meeting', 'aromdee-meeting-2', 'aromdee-front'],
  },
  {
    id: 'iya-2024',
    date: '2024-03-23',
    place: { lo: 'ມະຫາວິທະຍາໄລສຸພານຸວົງ', th: 'มหาวิทยาลัยสุพานุวง', en: 'Souphanouvong University' },
    tag: { lo: 'ງານວາງສະແດງ', th: 'งานแสดงสินค้า', en: 'Expo' },
    title: {
      lo: 'ງານວາງສະແດງ IYA 2024 — ການບົ່ມເພາະທຸລະກິດກະສິກຳສຳລັບຊາວໜຸ່ມ',
      th: 'งานแสดงผลงาน IYA 2024 — บ่มเพาะธุรกิจเกษตรสำหรับคนรุ่นใหม่',
      en: 'IYA 2024 Expo — Incubating Young Agripreneurs',
    },
    body: {
      lo: 'ພວກເຮົານຳຢາດົມຫອມລາວໄປວາງສະແດງ ແລະ ຈຳໜ່າຍໃນງານ IYA 2024 ທີ່ຈັດໂດຍສູນບົ່ມເພາະທຸລະກິດລາວ-ເກົາຫຼີ (LKBIC) ມະຫາວິທະຍາໄລສຸພານຸວົງ ຮ່ວມກັບ Wonders International ສາທາລະນະລັດເກົາຫຼີ. ຕະຫຼອດ 2 ວັນຂອງງານ ໄດ້ຮັບຄວາມສົນໃຈຈາກແຂກ, ຄູອາຈານ, ນັກຮຽນ ແລະ ນັກສຶກສາຫຼາຍທ່ານ.',
      th: 'เรานำยาดมหอมลาวไปจัดแสดงและจำหน่ายในงาน IYA 2024 ที่จัดโดยศูนย์บ่มเพาะธุรกิจลาว-เกาหลี (LKBIC) มหาวิทยาลัยสุพานุวง ร่วมกับ Wonders International สาธารณรัฐเกาหลี ตลอด 2 วันของงานได้รับความสนใจจากแขก คุณครู นักเรียน และนักศึกษามากมาย',
      en: 'We showcased and sold Ya Dom Hom Lao at IYA 2024, organised by the Lao-Korea Business Incubating Center (LKBIC) at Souphanouvong University with Wonders International, South Korea. Over two days we met many guests, teachers and students who stopped by to try it.',
    },
    cover: 'iya-guest',
    photos: ['iya-guest', 'iya-team-girls', 'iya-booth-kids', 'iya-kids-poster', 'iya-day2-b', 'iya-day2-a', 'product-blue'],
  },
];

export const PRODUCT_PHOTOS = ['product-blue', 'product-yellow'];

export const CAPTIONS = {
  'story-poster': { lo: 'ທີ່ມາຂອງໂຄງການ', th: 'ที่มาของโครงการ', en: 'How the project began' },
  'product-blue': { lo: 'ຢາດົມຫອມລາວ ພ້ອມຈຳໜ່າຍໃນງານ', th: 'ยาดมหอมลาว พร้อมจำหน่ายในงาน', en: 'Ready for sale at the expo' },
  'product-yellow': { lo: 'ຢາດົມຫອມລາວ ຝາສີເຫຼືອງ', th: 'ยาดมหอมลาว ฝาสีเหลือง', en: 'Ya Dom Hom Lao, yellow-cap batch' },
  'iya-guest': { lo: 'ແຂກມາຢ້ຽມຊົມ ແລະ ອຸດໜູນ', th: 'แขกมาเยี่ยมชมและอุดหนุน', en: 'Guests visiting and buying' },
  'iya-team-girls': { lo: 'ທີມງານ ແລະ ໝູ່ເພື່ອນທີ່ມາໃຫ້ກຳລັງໃຈ', th: 'ทีมงานและเพื่อน ๆ ที่มาให้กำลังใจ', en: 'Team and friends at the booth' },
  'iya-booth-kids': { lo: 'ນ້ອງໆນັກຮຽນມາຢ້ຽມຊົມບູດ', th: 'น้อง ๆ นักเรียนมาเยี่ยมชมบูธ', en: 'Students visiting our booth' },
  'iya-kids-poster': { lo: 'ແນະນຳທີ່ມາຂອງຢາດົມຫອມລາວ', th: 'แนะนำที่มาของยาดมหอมลาว', en: 'Sharing the story behind the brand' },
  'iya-day2-a': { lo: 'ບັນຍາກາດວັນທີ 2', th: 'บรรยากาศวันที่ 2', en: 'Day 2 at the expo' },
  'iya-day2-b': { lo: 'ບູດຢາດົມຫອມລາວ ວັນທີ 2', th: 'บูธยาดมหอมลาว วันที่ 2', en: 'Our booth on day 2' },
  'aromdee-front': { lo: 'ໜ້າຮ້ານ Aromdee', th: 'หน้าร้าน Aromdee', en: 'At Aromdee' },
  'aromdee-front-2': { lo: 'ທີມງານທີ່ຮ້ານ Aromdee ຫຼວງພະບາງ', th: 'ทีมงานที่ร้าน Aromdee หลวงพระบาง', en: 'Our team at Aromdee, Luang Prabang' },
  'aromdee-meeting': { lo: 'ນຳສະເໜີ ແລະ ແລກປ່ຽນຄຳຄິດເຫັນ', th: 'นำเสนอและแลกเปลี่ยนความคิดเห็น', en: 'Presenting and gathering feedback' },
  'aromdee-meeting-2': { lo: 'ພູດຄຸຍກ່ຽວກັບການວາງຈຳໜ່າຍ', th: 'พูดคุยเรื่องช่องทางจำหน่าย', en: 'Talking about sales channels' },
};
