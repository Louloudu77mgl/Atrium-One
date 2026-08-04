import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get("data")?.trim();
  const size = Math.min(1200, Math.max(180, Number(searchParams.get("size") ?? 360) || 360));

  if (!data) {
    return NextResponse.json({ error: "Paramètre data requis." }, { status: 400 });
  }

  try {
    const svg = await QRCode.toString(data, {
      type: "svg",
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#17121F",
        light: "#FFFFFF"
      }
    });
    const download = searchParams.get("download") === "1";
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        ...(download ? { "Content-Disposition": "attachment; filename=rcu-qr-code.svg" } : {})
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de générer le QR code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
