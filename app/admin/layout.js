import AdminShell from '@/components/admin/AdminShell';

export const metadata = { title: 'จัดการร้าน · Ya Dom Hom Lao', robots: { index: false } };

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
