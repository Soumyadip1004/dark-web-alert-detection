"use client";

import { Button } from "@dark-web-alert-detection/ui/components/button";
import { Separator } from "@dark-web-alert-detection/ui/components/separator";
import { cn } from "@dark-web-alert-detection/ui/lib/utils";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { route } from "@/lib/routes";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/alerts",
    label: "Alerts",
    icon: AlertTriangle,
  },
  {
    href: "/dashboard/sources",
    label: "Sources",
    icon: Globe,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: Activity,
  },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-card/50 transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        {/* Sidebar header */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <Link
              href={route("/dashboard")}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Shield className="size-4 shrink-0 text-primary" />
              <span className="truncate font-semibold text-xs tracking-tight">
                DarkWeb Alert
              </span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0"
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronLeft className="size-3.5" />
            )}
          </Button>
        </div>

        <Separator />

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link key={item.href} href={route(item.href)}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  size={collapsed ? "icon" : "default"}
                  className={cn(
                    "w-full justify-start gap-2",
                    collapsed && "justify-center",
                    active && "font-medium",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t p-2">
          {!collapsed && (
            <p className="px-2 py-1 text-[10px] text-muted-foreground">
              Educational Project
            </p>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
