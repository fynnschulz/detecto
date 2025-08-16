

"use client";

// app/einstellungen/page.tsx — Detecto Settings (Client Component)
// Elegante, voll funktionsfähige Einstellungsseite, an den eingeloggten Account gebunden.
// Lädt Profil-Daten aus Supabase, erlaubt Bearbeitung & Speichern (Name, Sprache, Avatar, Opt-ins, Theme, etc.).

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ---------- UI Helpers ----------
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="p-6 border-t border-neutral-800 first:border-t-0">
      <div className="mb-4">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {description && <p className="text-sm text-neutral-400 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-neutral-300 mb-1">{label}</div>
      {children}
      {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
    </label>
  );
}

function Button({ children, variant = "primary", className = "", ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-white text-black hover:opacity-90",
    muted: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
    outline: "border border-neutral-700 text-neutral-100 hover:bg-neutral-900",
    danger: "border border-red-700/60 text-red-200 hover:bg-red-900/30",
  } as const;
  return (
    <button className={`${base} ${styles[variant as keyof typeof styles]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
      {children}
    </span>
  );
}

// ---------- Page ----------
export default function EinstellungenPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Auth-bound profile state
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("de");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [theme, setTheme] = useState<"system" | "dark" | "light">("dark");

  // Tabs
  const [tab, setTab] = useState<"profil" | "sicherheit" | "benachrichtigungen" | "darstellung" | "datenschutz">("profil");

  // ---- Load user & profile
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        if (!mounted) return;
        setUserId(user.id);
        setUserEmail(user.email || "");

        // Profile
        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, locale, marketing_opt_in, theme")
          .eq("id", user.id)
          .maybeSingle();
        if (pe) throw pe;

        setDisplayName(p?.display_name || user.email?.split("@")[0] || "");
        setAvatarUrl(p?.avatar_url || "");
        setLocale(p?.locale || "de");
        setMarketingOptIn(!!p?.marketing_opt_in);
        setTheme((p?.theme as any) || "dark");
      } catch (e: any) {
        setErr("Fehler beim Laden der Einstellungen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  // ---- Save profile
  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg("");
    setErr("");
    startSaving(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        const payload: any = {
          id: user.id,
          display_name: (displayName || user.email?.split("@")[0] || "").slice(0, 80),
          locale,
          marketing_opt_in: marketingOptIn,
          theme,
          updated_at: new Date().toISOString(),
        };
        if (avatarUrl) payload.avatar_url = avatarUrl;
        const { error } = await supabase.from("profiles").upsert(payload);
        if (error) throw error;
        setMsg("Gespeichert ✔");
      } catch (e: any) {
        setErr("Speichern fehlgeschlagen.");
      }
    });
  }

  // ---- Avatar upload
  async function onAvatarChange(file?: File | null) {
    setMsg("");
    setErr("");
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const path = `avatars/${userId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setErr("Avatar-Upload fehlgeschlagen. Ist der Storage-Bucket 'avatars' vorhanden?");
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  }

  // ---- Password reset
  async function sendPasswordReset() {
    setMsg("");
    setErr("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/reset-password`,
    });
    setMsg("Passwort-Reset-Link gesendet");
  }

  // ---- Data preview
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

  // ---- Deletion request flag
  async function requestDeletionFlag() {
    setMsg("");
    setErr("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ deletion_requested: true, updated_at: new Date().toISOString() } as any).eq("id", user.id);
    setMsg("Löschanfrage markiert");
  }

  // ---- UI
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="h-10 w-48 rounded-lg bg-neutral-900 animate-pulse" />
        <div className="mt-6 h-32 w-full rounded-2xl bg-neutral-950/60 border border-neutral-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
          <p className="text-neutral-400 mt-1">Verwalte Profil, Sicherheit, Darstellung, Benachrichtigungen und Datenschutz.</p>
        </div>
        <Badge>Angemeldet als {userEmail}</Badge>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 backdrop-blur overflow-hidden">
        {/* Tabs */}
        <div className="flex gap-2 p-2 border-b border-neutral-800">
          {[
            { id: "profil", label: "Profil" },
            { id: "sicherheit", label: "Sicherheit" },
            { id: "benachrichtigungen", label: "Benachrichtigungen" },
            { id: "darstellung", label: "Darstellung" },
            { id: "datenschutz", label: "Datenschutz" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-2 rounded-lg text-sm ${tab === t.id ? "bg-neutral-800" : "hover:bg-neutral-900"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        {(msg || err) && (
          <div className={`mx-6 mt-4 rounded-lg px-3 py-2 text-sm ${err ? "bg-red-900/20 border border-red-800 text-red-200" : "bg-neutral-800/40 border border-neutral-700 text-neutral-200"}`}>
            {err || msg}
          </div>
        )}

        {/* Profil */}
        {tab === "profil" && (
          <Section title="Profil" description="Anzeigename, Avatar und Sprache verwalten.">
            <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <Field label="Anzeigename">
                  <input
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Dein Name"
                  />
                </Field>
                <Field label="Sprache">
                  <select
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="E-Mail">
                  <input disabled value={userEmail} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 opacity-70" />
                </Field>
                <div className="flex items-center gap-2">
                  <input id="marketing_opt_in" type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
                  <label htmlFor="marketing_opt_in" className="text-sm text-neutral-300">Produkt-News & Tipps per E-Mail erhalten</label>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="primary" disabled={saving} type="submit">Speichern</Button>
                  <Button variant="muted" type="button" onClick={() => { setDisplayName(""); setAvatarUrl(""); setMarketingOptIn(false); setLocale("de"); }}>Zurücksetzen</Button>
                </div>
              </div>

              <div className="space-y-3">
                <Field label="Avatar" hint="PNG/JPG, max. 5 MB">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center ring-1 ring-neutral-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {avatarUrl ? <img alt="Avatar" src={avatarUrl} className="w-full h-full object-cover" /> : <span className="text-2xl">👤</span>}
                    </div>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onAvatarChange(e.target.files?.[0])}
                      />
                      <Button variant="muted" type="button">Avatar hochladen</Button>
                    </label>
                  </div>
                </Field>
              </div>
            </form>
          </Section>
        )}

        {/* Sicherheit */}
        {tab === "sicherheit" && (
          <Section title="Sicherheit" description="Passwort zurücksetzen & Sitzungen verwalten.">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={sendPasswordReset}>Passwort-Reset-Link senden</Button>
              <p className="text-sm text-neutral-400">Wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-800 p-4 bg-neutral-900/40">
                <div className="font-medium mb-1">Zwei-Faktor-Authentifizierung</div>
                <p className="text-sm text-neutral-400 mb-3">Kommt mit Detecto Guardian v2.</p>
                <Button variant="outline" disabled>Demnächst</Button>
              </div>
              <div className="rounded-xl border border-neutral-800 p-4 bg-neutral-900/40">
                <div className="font-medium mb-1">Aktive Sitzungen</div>
                <p className="text-sm text-neutral-400 mb-3">Sitzungen verwalten folgt in Kürze.</p>
                <Button variant="outline" disabled>Demnächst</Button>
              </div>
            </div>
          </Section>
        )}

        {/* Benachrichtigungen */}
        {tab === "benachrichtigungen" && (
          <Section title="Benachrichtigungen" description="Steuere, welche E-Mails du bekommst.">
            <div className="flex items-center gap-2">
              <input id="marketing_opt_in_2" type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
              <label htmlFor="marketing_opt_in_2" className="text-sm text-neutral-300">Produkt-News & Tipps per E-Mail erhalten</label>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="muted" onClick={handleSave}>Einstellungen speichern</Button>
              <Button variant="outline" onClick={() => setMarketingOptIn(false)}>Alles deaktivieren</Button>
            </div>
          </Section>
        )}

        {/* Darstellung */}
        {tab === "darstellung" && (
          <Section title="Darstellung" description="Theme und UI-Details.">
            <div className="space-y-4">
              <Field label="Theme">
                <div className="flex gap-2">
                  {(["system", "dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-3 py-2 rounded-lg border text-sm ${theme === t ? "border-white/80" : "border-neutral-700 hover:border-neutral-500"}`}
                    >
                      {t === "system" ? "System" : t === "dark" ? "Dunkel" : "Hell"}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="flex gap-3">
                <Button variant="primary" onClick={() => handleSave()}>Speichern</Button>
                <Button variant="outline" onClick={() => setTheme("dark")}>Zurücksetzen</Button>
              </div>
            </div>
          </Section>
        )}

        {/* Datenschutz */}
        {tab === "datenschutz" && (
          <Section title="Datenschutz" description="Daten einsehen/Export-V1 und Account-Löschung anstoßen.">
            <DataPreview loader={loadDataPreview} />
            <div className="mt-6 p-4 border border-red-900/60 bg-red-950/20 rounded-xl">
              <h3 className="font-medium text-red-300 mb-2">Danger Zone</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="danger" onClick={requestDeletionFlag}>Account-Löschung anfragen</Button>
                <p className="text-sm text-neutral-400">Wir markieren deine Löschanfrage. Der finale Hard-Delete erfolgt manuell/automatisiert im Backend.</p>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ---------- Data Preview ----------
function DataPreview({ loader }: { loader: () => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    loader().then((data) => {
      if (!mounted) return;
      setJson(data);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [open, loader]);

  return (
    <div>
      <Button variant="muted" onClick={() => setOpen(v => !v)}>{open ? "Daten ausblenden" : "Meine Daten anzeigen (V1)"}</Button>
      {open && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-neutral-900 p-3 text-xs border border-neutral-800 whitespace-pre-wrap">
{loading ? "Laden…" : json || "Keine Daten gefunden."}
        </pre>
      )}
    </div>
  );
}

// (Optional) If you're using TypeScript strict mode and react 18 types, allow `asChild`-style props if you later adopt Radix/shadcn patterns.
declare module "react" {
  interface HTMLAttributes<T> { asChild?: boolean }
}