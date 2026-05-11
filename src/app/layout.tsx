
import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { IdleTimeoutProvider } from '@/components/IdleTimeoutProvider';
import SupportMessenger from '@/components/chat/SupportMessenger';

export const metadata: Metadata = {
  title: 'Mediconnect',
  description: 'Your health partner.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <FirebaseClientProvider>
          <IdleTimeoutProvider>
            {children}
            <SupportMessenger />
          </IdleTimeoutProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
