import { Header, Footer, ChatButton } from '@/components/ShopChrome';

export default function ShopLayout({ children }) {
  return (
    <>
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      <ChatButton />
    </>
  );
}
