import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pearson Concept Audit Dashboard",
  description: "Private course audit workflow dashboard.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
