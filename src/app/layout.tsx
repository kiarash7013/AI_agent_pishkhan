import type { Metadata } from 'next';
import './globals.css';
import './shell.css';
import localFont from 'next/font/local';
const iransans=localFont({src:[{path:'../../public/fonts/IRANSansXFaNum-Regular.ttf',weight:'400'},{path:'../../public/fonts/IRANSansXFaNum-DemiBold.ttf',weight:'600'},{path:'../../public/fonts/IRANSansXFaNum-Bold.ttf',weight:'700'}],variable:'--font-iransans',display:'swap'});

const pinar=localFont({src:'../../public/fonts/Pinar-DS2-Black.ttf',variable:'--font-pinar',weight:'900',display:'swap'});

export const metadata: Metadata = { title: 'پیشخوان | دستیار هوشمند', description: 'دستیار کاری شما در پیشخوان', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl" data-dark-theme="blue" className={`${iransans.variable} ${pinar.variable}`}><body>{children}</body></html>;
}
