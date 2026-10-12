import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Splunk Infrastructure Studio',
  description: 'پلتفرم کشف شبکه، طراحی معماری و استقرار Splunk',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-ink-50 text-ink-900 dark:bg-ink-950 dark:text-ink-100 antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
