import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const heading = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mashanoch CBT",
  description: "Computer-based testing for Mashanoch Private Schools",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
