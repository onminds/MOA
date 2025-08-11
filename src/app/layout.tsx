import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import BackgroundProvider from "@/components/BackgroundProvider";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Search Engine",
  description: "AI-powered search engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
