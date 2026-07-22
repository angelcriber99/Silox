import type { Viewport, Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { DevSafeguard } from "@/components/dev-safeguard";
import { CapacitorProvider } from "@/components/providers/capacitor-provider";
import { TauriProvider } from "@/components/providers/tauri-provider";
import { ThemeEngine } from "@/components/providers/theme-engine";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }
  ],
  colorScheme: "dark",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Silox",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
      </head>
      <body className="flex flex-col h-[100vh] w-full overflow-hidden bg-background text-foreground" suppressHydrationWarning>
        {/* Tauri Drag Region for macOS */}
        <div data-tauri-drag-region className="h-8 w-full fixed top-0 left-0 z-50 bg-transparent" />
        
        <TauriProvider>
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
                    <ThemeEngine />
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
          </NextIntlClientProvider>
        </TauriProvider>
      </body>
    </html>
  );
}
