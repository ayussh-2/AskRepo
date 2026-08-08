import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { RepoProvider } from "@/context/repo-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AskRepo",
  description: "Chat with any repo!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RepoProvider>
          {children}
        </RepoProvider>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              fontFamily: "var(--font-geist-sans), sans-serif",
              backgroundColor: "#0d0d0e",
              borderColor: "#23252a",
              color: "#f7f8f8",
            },
            className: "font-sans border border-[#23252a] bg-[#0d0d0e] text-[#f7f8f8] shadow-xl rounded-xl text-xs",
          }}
        />
      </body>
    </html>
  );
}
