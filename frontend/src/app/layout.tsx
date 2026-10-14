import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Batch Video Downloader — High-Fidelity Batch Media Extraction",
  description:
    "Professional desktop-grade batch video extraction utility. Inspect sources, preserve original stream quality, remux with FFmpeg, and export in bulk without lossy re-encoding.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0D12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0B0D12] text-[#F2F5FA] font-sans antialiased selection:bg-[#7185FF]/25 selection:text-[#F2F5FA]">
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          closeButton
          richColors
          toastOptions={{
            style: {
              background: "#121720",
              border: "1px solid #273041",
              color: "#F2F5FA",
            },
          }}
        />
      </body>
    </html>
  );
}
