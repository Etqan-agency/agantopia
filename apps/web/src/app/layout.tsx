import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";
import { QueryProvider } from "@/lib/query";
import { SITE_URL } from "@/lib/seo";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves file-convention images (opengraph-image.png) to absolute URLs on pages that do not
  // call buildMetadata, and silences the build-time metadataBase warning.
  metadataBase: new URL(SITE_URL),
  title: { default: "Agentopia", template: "%s · Agentopia" },
  description: "Run a small company staffed by AI employees, and watch them work in a top-down office.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111326" },
    { media: "(prefers-color-scheme: dark)", color: "#111326" },
  ],
};

// Applies a stored theme choice before paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem("agentopia.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
