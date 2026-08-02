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

const siteUrl = "https://firstfinder.app";
const description = "Collectible inventory for people who keep the receipt.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "FirstFinder",
  description,
  openGraph: {
    title: "FirstFinder",
    description,
    url: siteUrl,
    siteName: "FirstFinder",
    images: ["/firstfinder-mark-exact.png"],
  },
  twitter: {
    card: "summary",
    title: "FirstFinder",
    description,
    images: ["/firstfinder-mark-exact.png"],
  },
};

export default function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${plexMono.variable}`}>
        {children}
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
