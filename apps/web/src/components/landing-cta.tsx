"use client";

import { Button } from "@dark-web-alert-detection/ui/components/button";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

/**
 * Auth-aware CTA buttons used in the landing page hero and footer sections.
 *
 * - Signed in  → "Go to Dashboard" (primary) — no sign-in button
 * - Signed out → "Go to Dashboard" (primary) + "Sign In" (outline)
 * - Loading    → skeleton placeholders to avoid layout shift
 */
export function HeroCTA() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-11 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-11 w-36 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
      <Link href="/dashboard">
        <Button size="lg" className="gap-2 px-6">
          Go to Dashboard
          <ArrowRight className="size-4" />
        </Button>
      </Link>
      {!session && (
        <Link href="/login">
          <Button variant="outline" size="lg" className="gap-2 px-6">
            <Lock className="size-4" />
            Sign In
          </Button>
        </Link>
      )}
    </div>
  );
}

export function FooterCTA() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <div className="h-11 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-11 w-40 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Link href="/dashboard">
          <Button size="lg" className="gap-2 px-8">
            Go to Dashboard
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <Link href="/login">
        <Button size="lg" className="gap-2 px-8">
          Get Started
          <ArrowRight className="size-4" />
        </Button>
      </Link>
      <Link href="/dashboard">
        <Button variant="outline" size="lg" className="px-8">
          View Dashboard
        </Button>
      </Link>
    </div>
  );
}
