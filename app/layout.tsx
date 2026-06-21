import type { Viewport, Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 text-zinc-100 shadow-2xl",
              title: "text-zinc-100 font-semibold",
              description: "text-zinc-400",
              actionButton: "bg-blue-600 text-white",
              cancelButton: "bg-zinc-800 text-zinc-300",
              success:
                "border-emerald-500/30 [&>[data-icon]]:text-emerald-400",
              error: "border-rose-500/30 [&>[data-icon]]:text-rose-400",
              warning:
                "border-amber-500/30 [&>[data-icon]]:text-amber-400",
            },
          }}
        />
      </body>
    </html>
  );
}
