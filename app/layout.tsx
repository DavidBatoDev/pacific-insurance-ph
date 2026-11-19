import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const description = "Operations platform for Pacific Insurance PH.";

export const metadata: Metadata = {
  // Absolute base for og:image; the image itself is app/opengraph-image.png
  // (rendered by scripts/render-og-image.mjs).
  metadataBase: new URL("https://pacific-insurance-ph-ten.vercel.app"),
  title: "Pacific Insurance PH",
  description,
  openGraph: {
    type: "website",
    siteName: "Pacific Insurance PH",
    title: "Pacific Insurance PH",
    description,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
