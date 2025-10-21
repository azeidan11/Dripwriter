import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Dripwriter",
  description: "Paste your draft. Pick a duration. We’ll drip it into your Google Doc on a schedule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overscroll-contain bg-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
