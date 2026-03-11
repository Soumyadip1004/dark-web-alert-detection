"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@dark-web-alert-detection/ui/components/avatar";
import { Button } from "@dark-web-alert-detection/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dark-web-alert-detection/ui/components/dropdown-menu";
import {
  ArrowRight,
  CircleUserRoundIcon,
  LogOutIcon,
  Shield,
  ShieldIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";

// ─── Helpers ───────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── Header ────────────────────────────────────────────

export default function Header() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  // Dashboard pages use the sidebar + SiteHeader — no need for this header
  if (isDashboard) {
    return null;
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 sm:px-6">
      {/* ─── Brand ─────────────────────────────────── */}
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

      {/* ─── Right side ────────────────────────────── */}
      <div className="flex items-center gap-2">
        <ModeToggle />
        <AuthActions />
      </div>
    </header>
  );
}

// ─── Auth-aware action buttons ─────────────────────────

function AuthActions() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const isLoginPage = pathname === "/login";

  // Still loading — show skeleton to avoid flash
  if (isPending) {
    return <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />;
  }

  // Signed in — show dashboard CTA + user menu
  if (session) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard">
          <Button size="sm" className="gap-1.5">
            Dashboard
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
        <UserMenu
          name={session.user.name ?? "User"}
          email={session.user.email ?? ""}
          avatar={session.user.image ?? ""}
        />
      </div>
    );
  }

  // Not signed in and already on /login — no need for sign-in button
  if (isLoginPage) {
    return null;
  }

  // Not signed in — show sign-in button
  return (
    <Link href="/login">
      <Button variant="outline" size="sm">
        Sign In
      </Button>
    </Link>
  );
}

// ─── User Menu (matches sidebar NavUser) ───────────────

function UserMenu({
  name,
  email,
  avatar,
}: {
  name: string;
  email: string;
  avatar: string;
}) {
  const router = useRouter();

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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" />}
      >
        <Avatar className="size-7 grayscale">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="text-[10px]">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="size-8">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <CircleUserRoundIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ShieldIcon />
            Security
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
