import { Footer, ChatButton } from '@/components/ShopChrome';
import GlassHeader, { RevealObserver } from '@/components/GlassHeader';

export default function ShopLayout({ children }) {
  return (
    <>
      <GlassHeader />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      <ChatButton />
      <RevealObserver />
    </>
  );
}
