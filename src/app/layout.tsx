import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Role-Based Analyst Simulator",
  description: "Role-based simulation for BA, PO, Architect and Data Scientist",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
