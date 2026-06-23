import type { Metadata } from "next";
import { Playfair_Display, Instrument_Serif } from "next/font/google";
import "./globals.css";

// ponytail: next/font self-hosts these at build (needs network once); the two
// serifs are the defining look of the login design.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-playfair",
  display: "swap"
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap"
});

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
    <html lang="en" className={`${playfair.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
