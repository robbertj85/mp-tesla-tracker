import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tesla Prijstracker — Model 3 & Model Y",
  description:
    "Track Marktplaats Tesla Model 3 & Model Y listings and estimate fair prices via regression.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
