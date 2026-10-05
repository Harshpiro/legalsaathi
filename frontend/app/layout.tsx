import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalSaathi AI",
  description: "India ka AI-powered legal assistant — free, 24/7, Hindi mein.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="hi">
        <body className="min-h-screen bg-slate-950 text-slate-50 selection:bg-amber-500/30 antialiased overflow-x-hidden">
          {/* Background Gradients */}
          <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none -z-10">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 blur-[120px] rounded-full mix-blend-screen" />
          </div>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
