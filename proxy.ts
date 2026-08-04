import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRcuLanding = pathname.startsWith("/rcu/");
  const isPublicLoyaltyWallet = pathname.startsWith("/fidelite/");
  const isPublicRcuApi = pathname === "/api/rcu/qr" || /^\/api\/rcu\/forms\/[^/]+\/submit$/.test(pathname);

  if (isPublicRcuLanding || isPublicLoyaltyWallet || isPublicRcuApi) {
    return NextResponse.next({ request });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
