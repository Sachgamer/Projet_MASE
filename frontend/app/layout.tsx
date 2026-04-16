import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ViewProvider } from "@/context/ViewContext";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebMASE",
  description: "Document relatif à la sécurité au travail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <ViewProvider>
            <Navbar />
            <main className="min-h-screen bg-background">
              {children}
            </main>
          </ViewProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
