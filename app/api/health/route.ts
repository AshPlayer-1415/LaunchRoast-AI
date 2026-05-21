import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "LaunchRoast AI",
    timestamp: new Date().toISOString(),
  });
}
