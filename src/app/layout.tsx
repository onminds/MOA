import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import BackgroundProvider from "@/components/BackgroundProvider";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://moa.tools"),
  applicationName: "모아툴스",
  title: {
    default: "모아툴스 - AI 검색 엔진",
    template: "%s | 모아툴스",
  },
  description: "AI 기반 검색과 생성형 도구를 한 곳에서 사용하는 Moa Tools",
  keywords: [
    "AI",
    "AI Search",
    "AI Tools",
    "생성형 AI",
    "Moa Tools",
    "모아툴스",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://moa.tools",
    siteName: "Moa Tools",
    title: "Moa Tools - AI Search Engine",
    description: "AI 기반 검색과 생성형 도구를 한 곳에서 사용하는 Moa Tools",
    images: [
      {
        url: "/images/Moa_Logo.png",
        width: 1200,
        height: 630,
        alt: "Moa Tools",
      },
    ],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Moa Tools - AI Search Engine",
    description: "AI 기반 검색과 생성형 도구를 한 곳에서 사용하는 Moa Tools",
    images: ["/images/Moa_Logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  themeColor: "#0B1220",
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Providers>
          <BackgroundProvider>
            {children}
          </BackgroundProvider>
        </Providers>
      </body>
    </html>
  );
}
