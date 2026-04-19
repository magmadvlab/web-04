import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const inter = localFont({
  src: [
    {
      path: "../../public/fonts/InterVariable.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "../../public/fonts/InterVariable-Italic.woff2",
      style: "italic",
      weight: "100 900",
    },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RicettaZero",
  description: "Sistema di gestione prescrizioni mediche e consegne farmaci",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
