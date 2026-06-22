import type { Viewport, Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
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
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <PreferencesProvider>
              {children}
            </PreferencesProvider>
          </QueryProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
