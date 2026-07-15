// import { createServerClient } from "@supabase/ssr";
// import { NextResponse, type NextRequest } from "next/server";

// export async function proxy(request: NextRequest) {
//   let supabaseResponse = NextResponse.next({
//     request,
//   });

//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() {
//           return request.cookies.getAll();
//         },
//         setAll(cookiesToSet) {
//           cookiesToSet.forEach(({ name, value, options }) =>
//             request.cookies.set({ name, value, ...options })
//           );
//           supabaseResponse = NextResponse.next({
//             request,
//           });
//           cookiesToSet.forEach(({ name, value, options }) =>
//             supabaseResponse.cookies.set({ name, value, ...options })
//           );
//         },
//       },
//     }
//   );

//   // Refresh session if expired - required for Server Components
//   // https://supabase.com/docs/guides/auth/server-side/nextjs
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();

//   const isLoginPage = request.nextUrl.pathname.startsWith("/login");

//   if (!user && !isLoginPage) {
//     const url = request.nextUrl.clone();
//     url.pathname = "/login";
//     return NextResponse.redirect(url);
//   }

//   if (user && isLoginPage) {
//     const url = request.nextUrl.clone();
//     url.pathname = "/";
//     return NextResponse.redirect(url);
//   }

//   return supabaseResponse;
// }

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      * - images, icons, etc (static assets)
//      */
//     "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
//   ],
// };



import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  // No token + not on login page → redirect to login
  if (!token && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Has token + on login page → redirect to dashboard
  if (token && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};