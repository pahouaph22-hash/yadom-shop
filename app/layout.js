import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'ຢາດົມຫອມລາວ · Ya Dom Hom Lao',
  description: 'ຢາດົມສະໝຸນໄພລາວ — ยาดมสมุนไพรลาว — Lao herbal inhalers, retail and wholesale.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F4C3A' };

export default function RootLayout({ children }) {
  return (
    <html lang="lo" translate="no">
      <head>
        {/* Browser auto-translate rewrites the DOM and crashes React; the site already has its own Lao/Thai/English switch */}
        <meta name="google" content="notranslate" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Lao:wght@600;700&family=Noto+Serif+Thai:wght@600;700&family=Noto+Sans:wght@400;600;700&display=swap"
        />
      </head>
      <body className="notranslate font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
