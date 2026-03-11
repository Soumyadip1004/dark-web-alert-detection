import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dark-web-alert-detection/ui/components/card";
import {
  Activity,
  AlertTriangle,
  Database,
  Eye,
  Globe,
  Search,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";

import { FooterCTA, HeroCTA } from "@/components/landing-cta";

function HeroGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute top-1/4 left-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/5 blur-[120px] dark:bg-red-500/10" />
      <div className="absolute right-0 bottom-0 h-[300px] w-[500px] rounded-full bg-orange-500/5 blur-[100px] dark:bg-orange-500/8" />
      <div className="absolute bottom-1/3 left-0 h-[250px] w-[400px] rounded-full bg-yellow-500/3 blur-[80px] dark:bg-yellow-500/5" />
    </div>
  );
}

function GridPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

const FEATURES = [
  {
    icon: Globe,
    title: "Dark Web Crawling",
    description:
      "Automated Tor-routed crawlers continuously monitor breach forums, marketplaces, and paste sites for leaked data.",
  },
  {
    icon: Search,
    title: "Leak Detection Engine",
    description:
      "Advanced pattern matching detects credit card numbers, credential dumps, PII, and bank-specific data leaks in real time.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Scoring",
    description:
      "Multi-factor risk scoring combines bank mentions, keyword severity, and pattern density into actionable threat levels.",
  },
  {
    icon: Zap,
    title: "Instant Alerts",
    description:
      "Get notified immediately when sensitive financial data surfaces. Filter by risk level, bank name, or leak type.",
  },
  {
    icon: Database,
    title: "Source Management",
    description:
      "Track and manage monitored sources — breach forums, marketplaces, leak sites — with priority and status controls.",
  },
  {
    icon: Activity,
    title: "Analytics Dashboard",
    description:
      "Visual dashboards with real-time stats, alert timelines, risk breakdowns, and top-targeted institution tracking.",
  },
] as const;

const STATS = [
  { value: "24/7", label: "Continuous Monitoring" },
  { value: "5+", label: "Detection Patterns" },
  { value: "4", label: "Risk Levels" },
  { value: "<1s", label: "Analysis Time" },
] as const;

export default function LandingPage() {
  return (
    <div className="relative flex flex-col">
      <HeroGlow />
      <GridPattern />

      {/* ─── Hero Section ─────────────────────────────── */}
      <section className="relative flex flex-col items-center px-4 pt-16 pb-20 text-center md:pt-24 md:pb-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-4 py-1.5 font-medium text-red-600 text-xs dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <Shield className="size-3.5" />
          Dark Web Threat Intelligence
        </div>

        <h1 className="max-w-4xl font-bold text-4xl tracking-tight md:text-6xl lg:text-7xl">
          <span className="block">Detect Financial</span>
          <span className="block bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            Data Leaks
          </span>
          <span className="block">Before They Spread</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
          Monitor the dark web for compromised banking data, stolen credentials,
          and financial information leaks. Get real-time alerts with risk
          scoring to protect your institution.
        </p>

        <HeroCTA />

        {/* ─── Stat Badges ──────────────────────────── */}
        <div className="mt-16 grid w-full max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
            >
              <span className="font-bold text-2xl">{stat.value}</span>
              <span className="text-muted-foreground text-xs">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features Grid ────────────────────────────── */}
      <section className="relative border-t bg-muted/30 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-widest">
              <Eye className="size-4" />
              Capabilities
            </div>
            <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
              Full-Spectrum Threat Detection
            </h2>
            <p className="mt-3 text-muted-foreground">
              From automated crawling to instant alerting — everything you need
              to stay ahead of data breaches.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(feature => (
              <Card
                key={feature.title}
                className="border-border/50 bg-card/60 backdrop-blur-sm transition-colors hover:bg-card/80"
              >
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────── */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three-stage pipeline from dark web crawling to actionable
              intelligence.
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Connector line */}
            <div className="absolute top-8 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />

            {[
              {
                step: "01",
                title: "Crawl",
                description:
                  "Tor-routed crawlers scrape breach forums, paste sites, and dark web marketplaces around the clock.",
                icon: Globe,
              },
              {
                step: "02",
                title: "Analyze",
                description:
                  "The detection engine scans content for credit card patterns, credentials, bank mentions, and PII indicators.",
                icon: Search,
              },
              {
                step: "03",
                title: "Alert",
                description:
                  "Risk-scored alerts are generated and surfaced in the dashboard with full context and remediation guidance.",
                icon: AlertTriangle,
              },
            ].map(item => (
              <div
                key={item.step}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 mb-4 flex size-16 items-center justify-center rounded-full border bg-background">
                  <item.icon className="size-7 text-primary" />
                </div>
                <span className="mb-1 font-mono text-muted-foreground text-xs">
                  STEP {item.step}
                </span>
                <h3 className="mb-2 font-semibold text-lg">{item.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ──────────────────────────────── */}
      <section className="relative border-t bg-muted/30 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl">
                Ready to Monitor the Dark Web?
              </CardTitle>
              <CardDescription className="text-base">
                Start detecting financial data leaks and protect your
                institution from emerging threats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FooterCTA />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────── */}
      <footer className="border-t px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-muted-foreground text-xs sm:flex-row">
          <div className="flex items-center gap-2">
            <Shield className="size-4" />
            <span className="font-medium">Dark Web Alert Detection</span>
          </div>
          <p>
            Built for Educational Purposes — Dark web threat intelligence
            platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
