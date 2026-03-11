"use client";

import { Button } from "@dark-web-alert-detection/ui/components/button";
import { Separator } from "@dark-web-alert-detection/ui/components/separator";
import { SidebarTrigger } from "@dark-web-alert-detection/ui/components/sidebar";
import { LogOutIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/alerts": "Alerts",
  "/dashboard/sources": "Sources",
  "/dashboard/analytics": "Analytics",
};

function getPageTitle(pathname: string): string {
  // Check exact matches first
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  // Check prefix matches (e.g. /dashboard/alerts/[id])
  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(`${route}/`)) {
      return title;
    }
  }

  return "Dashboard";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
        },
      },
    });
  };

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 h-4 data-vertical:self-auto"
          />
          <h1 className="font-medium text-base">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button variant="destructive" onClick={handleSignOut}>
            <LogOutIcon className="size-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
