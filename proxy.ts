import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isPublic =
        path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/privacy");

    // Not logged in: every page except /login and /auth/* goes to /login.
    if (!user && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        return NextResponse.redirect(url);
    }

    // Signed in but not on the allowlist (domain or email): send to /not-allowed.
    if (user && !path.startsWith("/not-allowed") && !path.startsWith("/auth") && !path.startsWith("/privacy")) {
        const { data: allowed } = await supabase.rpc("is_email_allowed");
        if (allowed === false) {
            const url = request.nextUrl.clone();
            url.pathname = "/not-allowed";
            url.search = "";
            return NextResponse.redirect(url);
        }
    }

    // Already logged in: skip the login page.
    if (user && path.startsWith("/login")) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};