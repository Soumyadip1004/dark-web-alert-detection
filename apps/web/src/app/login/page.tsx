"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dark-web-alert-detection/ui/components/card";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <div className="relative flex min-h-full items-center justify-center px-4 py-12">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/5 blur-[100px] dark:bg-red-500/10" />
        <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[400px] rounded-full bg-orange-500/5 blur-[80px] dark:bg-orange-500/8" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            className="mb-4 flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="size-5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              DarkWeb Alert
            </span>
          </Link>
          <p className="text-muted-foreground text-sm">
            Dark web threat intelligence platform
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {showSignIn ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {showSignIn
                ? "Sign in to access your threat monitoring dashboard"
                : "Set up your account to start monitoring the dark web"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showSignIn ? (
              <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
            ) : (
              <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
            )}
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="mt-6 text-center text-muted-foreground text-xs">
          By continuing, you agree to the terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
