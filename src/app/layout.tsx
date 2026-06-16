import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Module 1 Round 1 MVP",
  description: "Showroom intake and preliminary cabinet estimate workflow"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
