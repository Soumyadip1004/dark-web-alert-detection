import {
  SidebarInset,
  SidebarProvider,
} from "@dark-web-alert-detection/ui/components/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="floating" />
      <SidebarInset className="max-h-svh overflow-hidden">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="@container/main flex flex-col gap-2 px-4 py-4 md:py-6 lg:px-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
