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
const description = "A free, open-source catalog for collectors — not for shops. Photograph a find and get its edition, condition, and what copies like it actually sell for.";

// The bare name is a weak title: it carries no keywords, and an unrelated iOS
// app already owns "FirstFinder" in search results. Leading with what the app
// does gives Google something to match a query against.
const defaultTitle = "FirstFinder — Catalog your collection and identify first editions";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Used by any route that sets no title of its own -- the home page.
    default: defaultTitle,
    // Applied to routes that do, so the identification guides read as
    // "How to Identify a First Edition of Dune | FirstFinder". Splitting
    // default from template is what stops the home page becoming
    // "FirstFinder — ... | FirstFinder".
    template: "%s | FirstFinder",
  },
  description,
  openGraph: {
    title: defaultTitle,
    description,
    url: siteUrl,
    siteName: "FirstFinder",
    images: ["/firstfinder-mark-exact.png"],
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
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
