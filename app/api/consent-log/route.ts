import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string; // server-only
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const { scope = "leak-check", deepScan = false, path = "/leak-check", userId, userEmail, userName } = await req.json().catch(() => ({}));

    const ua = req.headers.get("user-agent") || "";
    const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const ip = ipHeader.split(",")[0].trim();

    const supabase = supabaseService();
    const { error } = await supabase.from("consent_logs").insert({
      scope,
      deep_scan: !!deepScan,
      path,
      user_agent: ua,
      ip: ip || null,
      user_id: userId || null,
      user_email: userEmail || null,
      user_name: userName || null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "insert_failed" }, { status: 500 });
  }
}