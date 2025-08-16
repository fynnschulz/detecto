import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-Client mit Admin Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Nur Server-seitig erlaubt!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Kein userId angegeben" }, { status: 400 });
    }

    // 1. Löschen des Auth-Users
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. (Optional) Cleanup in weiteren Tabellen
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("API delete-account error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}