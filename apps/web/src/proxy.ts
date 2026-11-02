import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate for app pages only. It checks for the presence of the
 * session cookie; real authorization happens in route handlers / the DAL
 * (src/server/authz.ts). API routes are excluded and return 401 themselves.
 */
const PUBLIC_PREFIXES = [
  "/demo",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  // Marketing site (contract §4) and crawler files.
  "/product",
  "/how-it-works",
  "/features",
  "/ai-tools",
  "/use-cases",
  "/faq",
  "/about",
  "/sitemap.xml",
  "/robots.txt",
  "/dev",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const cookie = getSessionCookie(request);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|json)$).*)"],
};
