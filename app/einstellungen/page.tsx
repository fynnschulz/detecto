

"use client";

// app/einstellungen/page.tsx — Detecto Settings (Client Component, redesigned)
import { useEffect, useState, useTransition } from "react";
import type { ReactNode, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ---------------- Background (local hero-style)
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-cyan-500 via-sky-400 to-indigo-600" />
      <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-fuchsia-500 via-rose-400 to-orange-400" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),rgba(0,0,0,0)_60%)]" />
    </div>
  );
}

// ---------------- Small UI atoms
function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">{children}</div>;
}
function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {desc && <p className="text-sm text-white/60 mt-1">{desc}</p>}
    </div>
  );
}
function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3 py-3">
      <div className="text-sm text-white/80">{label}</div>
      <div className="md:col-span-2">{children}</div>
      {hint && <p className="md:col-span-3 text-xs text-white/50">{hint}</p>}
    </div>
  );
}
function Button({ children, variant = "primary", className = "", ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60";
  const styles = {
    primary: "bg-white text-black hover:opacity-90",
    muted: "bg-white/10 text-white hover:bg-white/15",
    outline: "border border-white/15 text-white hover:bg-white/5",
    danger: "border border-red-500/40 text-red-200 hover:bg-red-500/10",
  } as const;
  return (
    <button className={`${base} ${styles[variant as keyof typeof styles]} ${className}`} {...props}>{children}</button>
  );
}
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-white" : "bg-white/20"}`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-black transition ${checked ? "translate-x-5" : "translate-x-1"}`}
      />
    </button>
  );
}

// ---------------- Page
export default function EinstellungenPage() {
  const supabase = createClientComponentClient();
  const router = useRouter()

  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [showToast, setShowToast] = useState(false);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [username, setUsername] = useState("");
  const [locale, setLocale] = useState("de")
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [theme, setTheme] = useState<"system" | "dark" | "light">("dark");

  const [tab, setTab] = useState<"profil" | "sicherheit" | "benachrichtigungen" | "darstellung" | "datenschutz">("profil");

  // Load session + profile
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace("/login");
        if (!mounted) return;
        setUserId(user.id);
        setUserEmail(user.email || "");
        const { data: p } = await supabase
          .from("profiles")
          .select("username, locale, marketing_opt_in, theme")
          .eq("id", user.id)
          .maybeSingle();
        setUsername(p?.username || user.email?.split("@")[0] || "")
        setLocale(p?.locale || "de");
        setMarketingOptIn(!!p?.marketing_opt_in);
        const t = p?.theme as string | undefined;
        setTheme(t === "system" || t === "dark" || t === "light" ? t : "dark");
      } catch (e) {
        setErr("Fehler beim Laden der Einstellungen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  // Save profile
  function handleSave(e?: FormEvent) {
    e?.preventDefault();
    setMsg("");
    setErr("");
    startSaving(() => { (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace("/login");

        // Payload für Tabelle
        const payload: Record<string, any> = {
          username: (username || user.email?.split("@")[0] || "").slice(0, 80),
          locale,
          marketing_opt_in: marketingOptIn,
          theme,
        }

        // Existenz prüfen
        const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

        if (existing?.id) {
          const { error: upd } = await supabase.from("profiles").update(payload).eq("id", user.id);
          if (upd) throw upd;
        } else {
          const { error: ins } = await supabase.from("profiles").insert({ id: user.id, ...payload });
          if (ins) throw ins;
        }

        // ✨ Zusätzlich: auth.user Metadaten aktualisieren (für Header/Profile-Menü)
        const { error: metaErr } = await supabase.auth.updateUser({
          data: {
            username: payload.username,
            locale: payload.locale,
            marketing_opt_in: payload.marketing_opt_in,
            theme: payload.theme,
          },
        });
        if (metaErr) console.warn("auth.updateUser error", metaErr);

        setMsg("Gespeichert ✔");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2200);
        router.refresh();
      } catch (e: any) {
        const raw = e?.message || e?.code || "";
        console.error("Save failed:", e);
        if (/row-level security|RLS/i.test(raw)) {
          setErr("Speichern fehlgeschlagen: RLS-Policy blockiert (profiles). Bitte Insert/Update für eigene ID erlauben.");
        } else {
          setErr(`Speichern fehlgeschlagen: ${raw || "Unbekannter Fehler"}`);
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3200);
      }
    })(); });
  }


  // Password reset
  async function sendPasswordReset() {
    setMsg(""); setErr("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/reset-password` });
    setMsg("Passwort-Reset-Link gesendet");
  }

  // Data preview
  async function loadDataPreview() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const out: Record<string, any> = {};
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    out.profile = p || null;
    const { data: purchases } = await supabase.from("purchases").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    out.purchases = purchases || [];
    const { data: subs } = await supabase.from("subscriptions").select("*").eq("user_id", user.id);
    out.subscriptions = subs || [];
    return JSON.stringify(out, null, 2);
  }

  // Deletion flag
  async function requestDeletionFlag() {
    setMsg(""); setErr("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ deletion_requested: true, updated_at: new Date().toISOString() } as any).eq("id", user.id);
    setMsg("Löschanfrage markiert");
  }

  // --------------- UI Layout
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <HeroBackdrop />
      {(msg || err) && showToast && (
        <div className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm shadow-lg backdrop-blur-xl border ${err ? "bg-red-500/15 border-red-400/30 text-red-100" : "bg-white/10 border-white/20 text-white"}`}>
          {err || msg}
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
            <p className="text-white/60">Passe Detecto an dich an. Änderungen werden in deinem Konto gespeichert.</p>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full bg-white/10 text-white/80 px-3 py-1 text-xs border border-white/15">{userEmail || "Eingeloggt"}</span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-6">
          {/* Sidebar */}
          <nav className="h-max rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-2">
            {([
              { id: "profil", label: "Profil", icon: "👤" },
              { id: "sicherheit", label: "Sicherheit", icon: "🔒" },
              { id: "benachrichtigungen", label: "Benachrichtigungen", icon: "🔔" },
              { id: "darstellung", label: "Darstellung", icon: "🎨" },
              { id: "datenschutz", label: "Datenschutz", icon: "🧾" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm mb-1 transition border border-transparent hover:border-white/10 ${tab === t.id ? "bg-white/10" : "bg-transparent"}`}
              >
                <span className="text-base">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="space-y-6">

            {/* Profil */}
            {tab === "profil" && (
              <Card>
                <SectionTitle title="Profil" desc="Name, Sprache, Avatar & Opt-ins" />
                <form onSubmit={handleSave}>
                  <FieldRow label="Nutzername">
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Dein Name"
                    />
                  </FieldRow>

                  <FieldRow label="Sprache">
                    <select
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </FieldRow>

                  <FieldRow label="E-Mail">
                    <input disabled value={userEmail} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 opacity-70" />
                  </FieldRow>

                  <FieldRow label="Produkt-News">
                    <div className="flex items-center gap-3">
                      <Toggle checked={marketingOptIn} onChange={(v) => setMarketingOptIn(v)} />
                      <span className="text-sm text-white/70">Newsletter & Produkt-Updates</span>
                    </div>
                  </FieldRow>;


                  <div className="mt-4 flex gap-3">
                    <Button variant="primary" disabled={saving} type="submit">Speichern</Button>
                    <Button variant="outline" type="button" onClick={() => { setUsername(""); setMarketingOptIn(false); setLocale("de"); }}>Zurücksetzen</Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Sicherheit */}
            {tab === "sicherheit" && (
              <Card>
                <SectionTitle title="Sicherheit" desc="Passwort & Sitzungen" />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={sendPasswordReset}>Passwort-Reset-Link senden</Button>
                  <p className="text-sm text-white/70">Wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-6">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-medium mb-1">Zwei-Faktor-Authentifizierung</div>
                    <p className="text-sm text-white/60 mb-3">Kommt mit Detecto Guardian v2.</p>
                    <Button variant="outline" disabled>Demnächst</Button>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-medium mb-1">Aktive Sitzungen</div>
                    <p className="text-sm text-white/60 mb-3">Sitzungen verwalten folgt in Kürze.</p>
                    <Button variant="outline" disabled>Demnächst</Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Benachrichtigungen */}
            {tab === "benachrichtigungen" && (
              <Card>
                <SectionTitle title="Benachrichtigungen" desc="Kontrolliere, was du hörst." />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">Newsletter & Updates</div>
                    <p className="text-sm text-white/60">Produkt-News, Tipps & Sicherheitshinweise</p>
                  </div>
                  <Toggle checked={marketingOptIn} onChange={(v) => setMarketingOptIn(v)} />
                </div>
                <div className="mt-4 flex gap-3">
                  <Button variant="muted" onClick={handleSave}>Einstellungen speichern</Button>
                  <Button variant="outline" onClick={() => setMarketingOptIn(false)}>Alles deaktivieren</Button>
                </div>
              </Card>
            )}

            {/* Darstellung */}
            {tab === "darstellung" && (
              <Card>
                <SectionTitle title="Darstellung" desc="Theme & Look" />
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {["system", "dark", "light"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t as "system" | "dark" | "light")}
                      className={`rounded-xl border px-3 py-3 text-sm ${theme === t ? "border-white/80 bg-white/10" : "border-white/10 hover:border-white/20"}`}
                    >
                      {t === "system" ? "System" : t === "dark" ? "Dunkel" : "Hell"}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-3">
                  <Button onClick={() => handleSave()}>Speichern</Button>
                  <Button variant="outline" onClick={() => setTheme("dark")}>Zurücksetzen</Button>
                </div>
              </Card>
            )}

            {/* Datenschutz */}
            {tab === "datenschutz" && (
              <Card>
                <SectionTitle title="Datenschutz" desc="Daten einsehen & Account-Löschung" />
                <DataPreview loader={loadDataPreview} />
                <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <div className="font-medium text-red-200 mb-2">Danger Zone</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="danger" onClick={requestDeletionFlag}>Account-Löschung anfragen</Button>
                    <p className="text-sm text-white/70">Wir markieren deine Löschanfrage. Der finale Hard-Delete erfolgt im Backend.</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Skeleton during first load to reduce flicker */}
            {loading && (
              <Card>
                <div className="h-24 w-full animate-pulse rounded-xl bg-white/5" />
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------- Data Preview
function DataPreview({ loader }: { loader: () => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    loader().then((data) => { if (!mounted) return; setJson(data); setLoading(false); });
    return () => { mounted = false; };
  }, [open, loader]);

  return (
    <div>
      <Button variant="muted" onClick={() => setOpen(v => !v)}>{open ? "Daten ausblenden" : "Meine Daten anzeigen (V1)"}</Button>
      {open && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-white/5 p-3 text-xs border border-white/10 whitespace-pre-wrap">{loading ? "Laden…" : json || "Keine Daten gefunden."}</pre>
      )}
    </div>
  );
}