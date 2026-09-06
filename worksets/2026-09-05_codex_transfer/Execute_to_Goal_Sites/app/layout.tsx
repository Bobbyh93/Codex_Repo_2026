import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open NCLEX Curriculum | Execute to Goal",
  description: "Private execution dashboard for the NurseStudy open NCLEX-RN curriculum.",
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
