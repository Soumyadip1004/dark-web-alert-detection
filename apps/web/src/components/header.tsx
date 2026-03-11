"use client";

import { Button } from "@dark-web-alert-detection/ui/components/button";
import { Separator } from "@dark-web-alert-detection/ui/components/separator";
import { cn } from "@dark-web-alert-detection/ui/lib/utils";
import { Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
  ] as const;

  // On dashboard pages, render a minimal top bar (sidebar handles main nav)
  if (isDashboard) {
    return (
      <header className="flex h-11 shrink-0 items-center justify-between border-b bg-card/50 px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Shield className="size-4 text-primary" />
            <span className="hidden font-semibold text-xs tracking-tight sm:inline">
              DarkWeb Alert
            </span>
          </Link>
          <Separator orientation="vertical" className="!h-4" />
          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link key={href} href={href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="xs"
                    className={cn(
                      "text-xs",
                      isActive ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          <ModeToggle />
          <UserMenu />
        </div>
      </header>
    );
  }

  // On non-dashboard pages, render the full-width header
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
            <Shield className="size-4 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight">
            DarkWeb Alert
          </span>
        </Link>
        <Separator orientation="vertical" className="!h-5" />
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link key={href} href={href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    isActive ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
