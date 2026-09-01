import type { Metadata } from "next";
import { Toaster } from "sonner";
import { inter } from "@/lib/ui-font";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "LightType",
  description: "Illuminated 3D letters, ready to print.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full overflow-hidden antialiased`}>
      <body className="h-full overflow-hidden bg-background font-sans text-foreground">
        <TooltipProvider>
          {children}
          <Toaster position="bottom-center" richColors={false} />
        </TooltipProvider>
      </body>
    </html>
  );
}
