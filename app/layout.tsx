import "./globals.css";

export const metadata = {
  title: "Dripwriter",
  description: "Paste your draft. Pick a duration. We’ll drip it into your Google Doc on a schedule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
