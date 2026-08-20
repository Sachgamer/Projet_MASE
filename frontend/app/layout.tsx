import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ViewProvider } from "@/context/ViewContext";
import Navbar from "@/components/Navbar";

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
      <body suppressHydrationWarning>
        <AuthProvider>
          <ViewProvider>
            <div className="flex flex-col md:flex-row min-h-screen bg-background">
              <Navbar />
              <main className="flex-1 min-h-screen bg-background overflow-x-hidden">
                {children}
              </main>
            </div>
          </ViewProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
