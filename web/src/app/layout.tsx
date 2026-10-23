import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { RepoProvider } from "@/context/repo-context";
import { ThemeProvider } from "@/components/theme-provider";
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-[#010102] dark:text-[#f7f8f8]">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          forcedTheme="dark"
        >
          <RepoProvider>{children}</RepoProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className:
                "font-sans border border-zinc-200 dark:border-[#23252a] bg-white dark:bg-[#0d0d0e] text-zinc-900 dark:text-[#f7f8f8] shadow-xl rounded-xl text-xs",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
