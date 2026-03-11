"use client";

import { Toaster } from "@dark-web-alert-detection/ui/components/sonner";
import { TooltipProvider } from "@dark-web-alert-detection/ui/components/tooltip";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={0}>
        {children}
        <Toaster richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
