import { NextResponse, type NextRequest } from "next/server";

// Sends visitors without a session cookie to the login page.
// The FastAPI backend still checks the token on every request; this guard
// only keeps signed-out visitors away from portal pages.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("access_token")?.value);
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");

  if (!hasSession && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
