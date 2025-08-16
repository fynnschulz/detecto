

"use client";

// app/einstellungen/page.tsx — Detecto Settings (Client Component, redesigned)
import { useEffect, useRef, useState, useTransition } from "react";
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
function Card({ children }: { children: React.ReactNode }) {
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
function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
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
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("de");
  const [avatarUrl, setAvatarUrl] = useState("");
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
          .select("display_name, avatar_url, locale, marketing_opt_in, theme")
          .eq("id", user.id)
          .maybeSingle();
        setDisplayName(p?.display_name || user.email?.split("@")[0] || "");
        setAvatarUrl(p?.avatar_url || "");
        setLocale(p?.locale || "de");
        setMarketingOptIn(!!p?.marketing_opt_in);
        setTheme((p?.theme as any) || "dark");
      } catch (e) {
        setErr("Fehler beim Laden der Einstellungen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  // Save profile
  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg("");
    setErr("");
    startSaving(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace("/login");

        // Full payload (includes optional columns if they exist)
        const fullPayload: Record<string, any> = {
          id: user.id,
          display_name: (displayName || user.email?.split("@")[0] || "").slice(0, 80),
          locale,
          marketing_opt_in: marketingOptIn,
          theme,
        };
        if (avatarUrl) fullPayload.avatar_url = avatarUrl;

        // Attempt 1: upsert with full payload
        let { error: up1 } = await supabase.from("profiles").upsert(fullPayload, { onConflict: "id" });

        // If the schema doesn't have some columns (e.g., theme/updated_at), retry with minimal payload
        if (up1 && String(up1.message || up1.code || "").includes("column") ) {
          const minimal: Record<string, any> = {
            id: user.id,
            display_name: fullPayload.display_name,
            locale: fullPayload.locale,
            marketing_opt_in: fullPayload.marketing_opt_in,
          };
          if (avatarUrl) minimal.avatar_url = avatarUrl;
          const { error: up2 } = await supabase.from("profiles").upsert(minimal, { onConflict: "id" });
          up1 = up2 || null as any;
        }

        // If RLS blocks insert (new row), try update (row might already exist)
        if (up1 && /row-level security|RLS|not allowed/i.test(up1.message || "")) {
          const { error: upd } = await supabase.from("profiles").update(fullPayload).eq("id", user.id);
          if (upd) throw upd;
        } else if (up1) {
          // Some other error that persisted after minimal retry
          throw up1;
        }

        setMsg("Gespeichert ✔");
      } catch (e: any) {
        // Show a concise, helpful message
        const raw = e?.message || e?.code || "";
        if (/row-level security|RLS/i.test(raw)) {
          setErr("Speichern fehlgeschlagen: RLS-Policy blockiert. Erlaube Insert/Update für eigene ID in Supabase.");
        } else if (/column .* does not exist/i.test(raw)) {
          setErr("Speichern teilweise fehlgeschlagen: Bitte fehlende Spalten in `profiles` anlegen (z.B. `theme`).");
        } else {
          setErr("Speichern fehlgeschlagen.");
        }
      }
    });
  }

  // Avatar upload
  async function onAvatarChange(file?: File | null) {
    setMsg(""); setErr("");
    if (!file) return;

    // ✅ Clientseitiges Limit: 20 MB
    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setErr("Die Datei ist größer als 20 MB. Bitte wähle ein kleineres Bild oder komprimiere es.");
      return;
    }

    try {
      const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `avatars/${userId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      setAvatarUrl(url); // optimistic preview

      // persist URL to profile; if RLS blocks insert, try update
      let { error: up1 } = await supabase.from("profiles").upsert({ id: userId, avatar_url: url });
      if (up1 && /row-level security|RLS|not allowed/i.test(up1.message || "")) {
        const { error: upd } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("id", userId);
        if (upd) throw upd;
      } else if (up1) {
        throw up1;
      }

      setMsg("Avatar aktualisiert ✔");
    } catch (e) {
      setErr("Avatar konnte nicht gespeichert werden.");
    }
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
          <nav className="lg:sticky lg:top-24 h-max rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-2">
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
            {(msg || err) && (
              <Card>
                <div className={`text-sm ${err ? "text-red-200" : "text-white/90"}`}>{err || msg}</div>
              </Card>
            )}

            {/* Profil */}
            {tab === "profil" && (
              <Card>
                <SectionTitle title="Profil" desc="Name, Sprache, Avatar & Opt-ins" />
                <form onSubmit={handleSave}>
                  <FieldRow label="Anzeigename">
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
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
                      <Toggle checked={marketingOptIn} onChange={setMarketingOptIn} />
                      <span className="text-sm text-white/70">Newsletter & Produkt-Updates</span>
                    </div>
                  </FieldRow>

                  <FieldRow label="Avatar" hint="PNG/JPG, bis 20 MB">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-full overflow-hidden ring-1 ring-white/15 bg-white/5 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {avatarUrl ? <img alt="Avatar" src={avatarUrl} className="h-full w-full object-cover" /> : <span className="text-2xl">👤</span>}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onAvatarChange(e.target.files?.[0])}
                      />
                      <Button variant="muted" type="button" onClick={() => fileInputRef.current?.click()}>Avatar hochladen</Button>
                    </div>
                  </FieldRow>

                  <div className="mt-4 flex gap-3">
                    <Button variant="primary" disabled={saving} type="submit">Speichern</Button>
                    <Button variant="outline" type="button" onClick={() => { setDisplayName(""); setAvatarUrl(""); setMarketingOptIn(false); setLocale("de"); }}>Zurücksetzen</Button>
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
                  <Toggle checked={marketingOptIn} onChange={setMarketingOptIn} />
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
                      onClick={() => setTheme(t as any)}
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