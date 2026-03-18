import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaInsight 資訊科普教育平台",
  description: "教育部帶動中小學計畫｜Google Developer Groups on Campus NTUB｜© 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">{children}</body>
    </html>
  );
}
