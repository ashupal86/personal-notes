import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider }  from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import QueryProvider    from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "The Quiet Archive",
  description: "A minimalist knowledge workspace for capturing, organising and connecting your ideas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
