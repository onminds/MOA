import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import BackgroundProvider from "@/components/BackgroundProvider";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://moa.tools"),
  applicationName: "Moa Tools",
  title: {
    default: "Moa Tools - AI Search Engine",
    template: "%s | Moa Tools",
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
    icon: "/images/Moa_Logo.png",
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
