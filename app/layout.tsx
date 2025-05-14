import type { Metadata } from 'next';
import { Raleway, Press_Start_2P } from 'next/font/google';
import './globals.css';

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-raleway',
});

const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-press-start-2p',
});

export const metadata: Metadata = {
  title: 'Sagar Patel',
  description: 'Software Engineer. Gamer. Thinker.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${raleway.variable} ${pressStart2P.variable} font-sans`}>{children}</body>
    </html>
  );
}
