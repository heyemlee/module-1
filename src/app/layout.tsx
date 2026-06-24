import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABCabinet Studio",
  description: "Cabinet project intake, spatial planning, and concept rendering"
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
