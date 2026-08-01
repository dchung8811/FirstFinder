import { GoogleAnalytics } from "@next/third-parties/google";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "FirstFinder",
  description: "Collectible inventory for people who keep the receipt.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${plexMono.variable}`}>{children}        <GoogleAnalytics gaId="G-WYF4FV2R9R" />
      </body>
    </html>
  );
}
