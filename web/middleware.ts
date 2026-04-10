import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseUrl = rawUrl.startsWith("http") ? rawUrl : rawKey.startsWith("http") ? rawKey : rawUrl;
const supabaseAnonKey = rawKey.startsWith("eyJ") ? rawKey : rawUrl.startsWith("eyJ") ? rawUrl : rawKey;

export async function middleware(request: NextRequest) {
      let response = NextResponse.next({ request: { headers: request.headers } });

    const supabase = createServerClient(
              supabaseUrl,
              supabaseAnonKey,
      {
                    cookies: {
                                      get: (name: string) => request.cookies.get(name)?.value,
                                      set: (name: string, value: string, options: CookieOptions) => {
                                                            request.cookies.set({ name, value, ...options });
                                                            response = NextResponse.next({ request: { headers: request.headers } });
                                                            response.cookies.set({ name, value, ...options });
                                      },
                                      remove: (name: string, options: CookieOptions) => {
                                                            request.cookies.set({ name, value: "", ...options });
                                                            response = NextResponse.next({ request: { headers: request.headers } });
                                                            response.cookies.set({ name, value: "", ...options });
                                      },
                    },
      }
          );

    const { data: { user } } = await supabase.auth.getUser();
      const path = request.nextUrl.pathname;
      const isProtected = path.startsWith("/cliente") || path.startsWith("/contador") || path.startsWith("/admin") || path.startsWith("/gestao");

    if (isProtected && !user) {
              return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
}

export const config = { matcher: ["/cliente/:path*", "/contador/:path*", "/admin/:path*", "/gestao/:path*"] };
