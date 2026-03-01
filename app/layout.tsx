import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "sandbox.fun",
  description: "Personal LLM sandbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
