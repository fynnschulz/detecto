// app/lib/moderation.ts
const BANNED = [
  // Beispiele – anpassen/erweitern:
  'hurensohn', 'fotze', 'nazi', 'scheißhaufen',
  // Phrasen:
  'kill dich', 'verpiss dich',
];

function normalize(s: string) {
  return s
    .toLowerCase()
    // Umlaute/Diakritika entfernen, damit „Sch**ß“-Varianten weniger durchrutschen
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prüft Text auf verbotene Ausdrücke. */
export function checkPostAllowed(text: string): { ok: true } | { ok: false; hit: string } {
  const norm = normalize(text);
  for (const w of BANNED) {
    const needle = normalize(w);
    // Wort-/Phrasensuche, grob; optional auf Wortgrenzen anpassen
    const re = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i');
    if (re.test(norm)) return { ok: false, hit: w };
  }
  return { ok: true };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}