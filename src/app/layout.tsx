import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Pricing Calculator',
  description: 'Multi-rate pricing calculator — documents, discounts, tax, and reporting',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
