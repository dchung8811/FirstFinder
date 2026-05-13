import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

export const metadata = {
  title: "FirstFinder",
  description: "Rare books, verified editions, smarter collecting.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}        <GoogleAnalytics gaId="G-WYF4FV2R9R" />
      </body>
    </html>
  );
}
