"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@dark-web-alert-detection/ui/components/sidebar";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CircleHelpIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { NavAdmin } from "@/components/nav-admin";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { authClient } from "@/lib/auth-client";
import { route } from "@/lib/routes";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    avatar: session?.user?.image ?? "",
  };

  const navMain = [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      isActive: pathname === "/dashboard",
    },
    {
      title: "Alerts",
      url: "/dashboard/alerts",
      icon: <AlertTriangleIcon />,
      isActive: pathname.startsWith("/dashboard/alerts"),
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: <ActivityIcon />,
      isActive: pathname.startsWith("/dashboard/analytics"),
    },
  ];

  const navAdmin = [
    {
      title: "Sources",
      url: "/dashboard/sources",
      icon: <GlobeIcon />,
      isActive: pathname.startsWith("/dashboard/sources"),
    },
  ];

  const navSecondary = [
    {
      title: "Settings",
      url: "#",
      icon: <Settings2Icon />,
    },
    {
      title: "Get Help",
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href={route("/dashboard")} />}
            >
              <ShieldIcon className="size-5! text-primary" />
              <span className="font-semibold text-base">DarkWeb Alert</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavAdmin items={navAdmin} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
