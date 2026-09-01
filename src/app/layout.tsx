import type { Metadata } from "next";
import { Toaster } from "sonner";
import { inter } from "@/lib/ui-font";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "LightType — Type it. Light it. Print it.",
  description: "Create illuminated 3D letters ready for printing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <TooltipProvider>
          {children}
          <Toaster position="bottom-center" richColors={false} />
        </TooltipProvider>
      </body>
    </html>
  );
}
