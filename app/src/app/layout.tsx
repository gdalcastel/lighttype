import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { CapacitorBootstrap } from "@/components/native/CapacitorBootstrap";
import { inter } from "@/lib/ui-font";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "LightType",
  description: "Illuminated 3D letters, ready to print.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LightType",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full overflow-hidden antialiased`}>
      <body className="h-full overflow-hidden bg-background font-sans text-foreground touch-manipulation">
        <TooltipProvider>
          <CapacitorBootstrap />
          {children}
          <Toaster position="bottom-center" richColors={false} />
        </TooltipProvider>
      </body>
    </html>
  );
}
