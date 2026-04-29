import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk' });
const mono    = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'NexCRM — AI Sales Intelligence',
  description: 'AI-powered CRM for modern sales teams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${grotesk.variable} ${mono.variable}`}>
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
