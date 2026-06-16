import { NextResponse } from "next/server";

export function redirectTo(request: Request, path: string, status = 303) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return NextResponse.redirect(`${forwardedProto}://${host}${path}`, status);
  }

  return NextResponse.redirect(new URL(path, request.url), status);
}
