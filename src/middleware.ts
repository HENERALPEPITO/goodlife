import { NextRequest, NextResponse } from "next/server";

// Disabled middleware for demo - no authentication required
export async function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)"],
};


