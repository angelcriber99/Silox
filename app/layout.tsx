import type { Viewport, Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import { DevSafeguard } from "@/components/dev-safeguard";
import { CapacitorProvider } from "@/components/providers/capacitor-provider";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Silox — Gestión Patrimonial",
  description:
    "Plataforma profesional de tracking de inversiones. Monitoriza tu cartera de fondos, ETFs y acciones en tiempo real.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Silox",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex flex-col fixed inset-0 overflow-hidden bg-background text-foreground" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <PreferencesProvider>
                <CapacitorProvider>
                  <DevSafeguard />
                  <main className="flex-1 h-full w-full overflow-y-auto overscroll-y-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {children}
                  </main>
                </CapacitorProvider>
              </PreferencesProvider>
            </QueryProvider>
          </ThemeProvider>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "bg-card backdrop-blur-sm border border-border text-foreground shadow-2xl",
                title: "text-foreground font-semibold",
                description: "text-muted-foreground",
                actionButton: "bg-primary text-primary-foreground",
                cancelButton: "bg-muted text-muted-foreground",
                success:
                  "border-emerald-500/30 [&>[data-icon]]:text-emerald-500",
                error: "border-rose-500/30 [&>[data-icon]]:text-rose-500",
                warning:
                  "border-amber-500/30 [&>[data-icon]]:text-amber-500",
              },
            }}
          />
          <PwaRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
