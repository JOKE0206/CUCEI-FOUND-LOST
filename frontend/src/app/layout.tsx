import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CUCEI Found & Lost",
  description: "Objetos perdidos y encontrados en CUCEI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#16211e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} antialiased`}>
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          theme="dark"
          position="top-center"
          mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          toastOptions={{
            style: {
              background: "var(--color-superficie)",
              border: "1.5px solid var(--color-ceniza)",
              color: "var(--color-gis)",
              fontFamily: "inherit",
              fontSize: "1rem",
            },
          }}
        />
      </body>
    </html>
  );
}
