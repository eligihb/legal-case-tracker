import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ניהול תיקים משפטיים | רשויות והוצל"פ, חדל"פ וחברות',
  description:
    'מערכת מלאה בעברית RTL לניהול תיקי רשויות והוצל"פ, תיקי חדל"פ ותיקי חברות עם שמירה אוטומטית וייצוא לאקסל.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
