import "./globals.css";

export const metadata = {
  title: "FirstFinder",
  description: "Rare books, verified editions, smarter collecting.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
