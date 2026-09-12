import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mashanoch CBT",
  description: "Computer-based testing for Mashanoch Private Schools",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
