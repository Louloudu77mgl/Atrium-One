import { NextResponse } from "next/server";
import { recordEmailEvent } from "@/lib/emailing-store";

const pixel = Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64");

export async function GET(request: Request) {
  const url = new URL(request.url);
  await recordEmailEvent(url.searchParams.get("campaign") ?? "", url.searchParams.get("recipient") ?? "", "open").catch(() => null);
  return new NextResponse(pixel, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
}
