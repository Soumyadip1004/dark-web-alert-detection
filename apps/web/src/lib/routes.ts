/**
 * Route utility — workaround for Next.js typed routes.
 *
 * When `typedRoutes: true` is enabled in next.config.ts, Next.js generates
 * a strict union of known route strings from the file system. New routes
 * aren't added to the generated type file until the *next* build/dev cycle,
 * which means Link `href` props reject any route string that wasn't present
 * during the last type generation.
 *
 * This helper bypasses the constraint by casting any string path to the
 * expected `Route` type. It's safe because we control all paths and they
 * map to real file-system routes.
 *
 * Usage:
 *   import { route } from "@/lib/routes";
 *   <Link href={route("/dashboard/alerts")}>Alerts</Link>
 *   <Link href={route(`/dashboard/alerts/${id}`)}>Detail</Link>
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRoute = any;

/**
 * Cast a path string to a Next.js typed route.
 * This is a no-op at runtime — it only satisfies the TypeScript constraint.
 */
export function route(path: string): AnyRoute {
  return path;
}
