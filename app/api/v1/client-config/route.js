import { NextResponse } from "next/server";
import { iosClientConfig } from "../../../../src/utils/clientConfig";

// Asked by the iOS app on launch: is this build still supported, and what to
// say if not. Public and the same for everyone, so no sign-in. Only under
// /api/v1, since nothing but installed apps needs it. See
// src/utils/clientConfig.js for why it has to ship in the first release.

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ios: iosClientConfig(process.env) },
    // A few minutes' caching is fine: raising the minimum is rare, and a
    // launch-time call from every phone shouldn't each reach the function.
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
  );
}
