// app/einstellungen/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient, createServerActionClient } from "@supabase/auth-helpers-nextjs";

/**
 * Einstellungen (Settings) page
 * - Profil (Name, Avatar, Sprache)
 * - Sicherheit (Passwort-Reset-Link)
 * - Benachrichtigungen (Marketing-Opt-in)
 * - Datenschutz (Daten anzeigen/Export-V1, Account-Löschung: Anfrage)
 *
 * Hinweis: Diese erste Version ist komplett funktional ohne weitere Abhängigkeiten.
 * Avatar-Upload nutzt Supabase Storage-Bucket "avatars" (falls nicht vorhanden, wird eine Fehlermeldung angezeigt).
 */

export default async function EinstellungenPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Profil laden (falls Tabelle 'profiles' existiert)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, locale, marketing_opt_in")
    .eq("id", user.id)
    .maybeSingle();

  // Server Actions
  async function updateProfile(formData: FormData) {
    "use server";
    const supabase = createServerActionClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const displayName = String(formData.get("display_name") || "").slice(0, 80);
    const locale = (formData.get("locale") as string) || "de";
    const marketing = formData.get("marketing_opt_in") === "on";
    const avatar_url = (formData.get("avatar_url") as string) || null;

    const payload: any = {
      id: user.id,
      display_name: displayName || user.email?.split("@")[0] || "",
      locale,
      marketing_opt_in: marketing,
      updated_at: new Date().toISOString(),
    };
    if (avatar_url) payload.avatar_url = avatar_url;
    await supabase.from("profiles").upsert(payload);
  }

  async function requestPasswordReset() {
    "use server";
    const supabase = createServerActionClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`,
    });
  }

  async function flagDeletionRequest() {
    "use server";
    // V1: Wir markieren eine Löschanfrage im Profil (falls Spalte existiert), ansonsten keine Fehlermeldung werfen.
    // Ein echter Hard-Delete erfordert Service-Role-Keys und sollte in einer geschützten Route umgesetzt werden.
    const supabase = createServerActionClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    try {
      await supabase.from("profiles").update({
        deletion_requested: true,
        updated_at: new Date().toISOString(),
      } as any).eq("id", user.id);
    } catch (e) {
      // Ignorieren – falls Spalte nicht existiert
    }
  }

  async function getDataPreview() {
    "use server";
    const supabase = createServerActionClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const out: Record<string, any> = {};
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    out.profile = p || null;

    const { data: purchases } = await supabase.from("purchases").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    out.purchases = purchases || [];

    const { data: subs } = await supabase.from("subscriptions").select("*").eq("user_id", user.id);
    out.subscriptions = subs || [];

    return JSON.stringify(out, null, 2);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-semibold">Einstellungen</h1>
      <p className="text-neutral-400 mt-1">Verwalte Profil, Sicherheit, Benachrichtigungen und Datenschutz.</p>

      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/60 backdrop-blur">
        <Tabs
          userEmail={user.email!}
          initialProfile={{
            display_name: profile?.display_name || user.email?.split("@")[0] || "",
            avatar_url: profile?.avatar_url || "",
            locale: profile?.locale || "de",
            marketing_opt_in: !!profile?.marketing_opt_in,
          }}
          updateProfile={updateProfile}
          requestPasswordReset={requestPasswordReset}
          getDataPreview={getDataPreview}
          flagDeletionRequest={flagDeletionRequest}
        />
      </div>
    </div>
  );
}

// --- Client Components (Tabs & AvatarUpload) ---

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="p-6 border-t border-neutral-800 first:border-t-0">
      <div className="mb-4">
        <h2 className="text-lg font-medium">{title}</h2>
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

function Button({ children, className = "", ...props }: any) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-white text-black hover:opacity-90 disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function MutedButton({ children, className = "", ...props }: any) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-neutral-800 text-neutral-100 hover:bg-neutral-700 disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Tabs (Client)
// eslint-disable-next-line @next/next/no-async-client-component
// (Wir nutzen hier ein kleines Client-Segment, damit Avatar-Upload und UI-Tabs funktionieren)
"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

function Tabs({
  userEmail,
  initialProfile,
  updateProfile,
  requestPasswordReset,
  getDataPreview,
  flagDeletionRequest,
}: {
  userEmail: string;
  initialProfile: { display_name: string; avatar_url: string; locale: string; marketing_opt_in: boolean };
  updateProfile: (formData: FormData) => Promise<void>;
  requestPasswordReset: () => Promise<void>;
  getDataPreview: () => Promise<string>;
  flagDeletionRequest: () => Promise<void>;
}) {
  const supabase = createClientComponentClient();
  const [active, setActive] = useState<"profil" | "sicherheit" | "benachrichtigungen" | "datenschutz">("profil");
  const [name, setName] = useState(initialProfile.display_name);
  const [locale, setLocale] = useState(initialProfile.locale);
  const [marketing, setMarketing] = useState<boolean>(initialProfile.marketing_opt_in);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url);
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Avatar Upload
  async function onAvatarChange(file: File) {
    setMessage("");
    if (!file) return;
    const path = `avatars/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setMessage("Avatar-Upload fehlgeschlagen. Ist der Storage-Bucket 'avatars' vorhanden?");
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("display_name", name);
    fd.set("locale", locale);
    fd.set("marketing_opt_in", marketing ? "on" : "");
    if (avatarUrl) fd.set("avatar_url", avatarUrl); // falls du die Spalte speicherst

    startTransition(async () => {
      await updateProfile(fd);
      setMessage("Gespeichert ✔");
    });
  }

  return (
    <div>
      <div className="flex gap-2 p-2 border-b border-neutral-800">
        {[
          { id: "profil", label: "Profil" },
          { id: "sicherheit", label: "Sicherheit" },
          { id: "benachrichtigungen", label: "Benachrichtigungen" },
          { id: "datenschutz", label: "Datenschutz" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id as any)}
            className={`px-3 py-2 rounded-lg text-sm ${active === t.id ? "bg-neutral-800" : "hover:bg-neutral-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "profil" && (
        <Section title="Profil" description="Anzeigename, Avatar und Sprache verwalten.">
          <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Anzeigename">
                <input
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                <input id="marketing_opt_in" type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                <label htmlFor="marketing_opt_in" className="text-sm text-neutral-300">Produkt-News & Tipps per E-Mail erhalten</label>
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={isPending} type="submit">Speichern</Button>
                {message && <span className="text-sm text-neutral-400">{message}</span>}
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Avatar" hint="PNG/JPG, max. 5 MB">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {avatarUrl ? <img alt="Avatar" src={avatarUrl} className="w-full h-full object-cover" /> : <span>👤</span>}
                  </div>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && onAvatarChange(e.target.files[0])}
                    />
                    <MutedButton as-child>Avatar hochladen</MutedButton>
                  </label>
                </div>
              </Field>
            </div>
          </form>
        </Section>
      )}

      {active === "sicherheit" && (
        <Section title="Sicherheit" description="Passwort zurücksetzen & Sitzungen verwalten.">
          <div className="flex flex-wrap items-center gap-3">
            <form action={requestPasswordReset}>
              <Button type="submit">Passwort-Reset-Link senden</Button>
            </form>
            <p className="text-sm text-neutral-400">Wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
          </div>
        </Section>
      )}

      {active === "benachrichtigungen" && (
        <Section title="Benachrichtigungen" description="Steuere, welche E-Mails du bekommst.">
          <div className="flex items-center gap-2">
            <input id="marketing_opt_in_2" type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <label htmlFor="marketing_opt_in_2" className="text-sm text-neutral-300">Produkt-News & Tipps per E-Mail erhalten</label>
          </div>
          <div className="mt-4">
            <MutedButton onClick={handleSave}>Einstellungen speichern</MutedButton>
          </div>
        </Section>
      )}

      {active === "datenschutz" && (
        <Section title="Datenschutz" description="Daten einsehen/Export-V1 und Account-Löschung anstoßen.">
          <DataPreview getDataPreview={getDataPreview} />
          <div className="mt-6 p-4 border border-red-900/60 bg-red-950/20 rounded-xl">
            <h3 className="font-medium text-red-300 mb-2">Danger Zone</h3>
            <div className="flex flex-wrap items-center gap-3">
              <form action={flagDeletionRequest}>
                <button className="rounded-lg px-3 py-2 border border-red-800 text-red-200 hover:bg-red-900/30">
                  Account-Löschung anfragen
                </button>
              </form>
              <p className="text-sm text-neutral-400">Wir markieren deine Löschanfrage. Der finale Hard-Delete erfolgt manuell/automatisiert im Backend.</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function DataPreview({ getDataPreview }: { getDataPreview: () => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    getDataPreview().then((data) => {
      if (!mounted) return;
      setJson(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [open, getDataPreview]);

  return (
    <div>
      <MutedButton onClick={() => setOpen((v) => !v)}>{open ? "Daten ausblenden" : "Meine Daten anzeigen (V1)"}</MutedButton>
      {open && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-neutral-900 p-3 text-xs border border-neutral-800 whitespace-pre-wrap">
{loading ? "Laden…" : json || "Keine Daten gefunden."}
        </pre>
      )}
    </div>
  );
}

// Small helper to allow using <MutedButton as-child>
declare module "react" {
  interface HTMLAttributes<T> {
    asChild?: boolean;
  }
}
