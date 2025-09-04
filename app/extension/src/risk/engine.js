// Sehr leichter Heuristik-Scorer (0–100) – lokal, ohne Cloud
export function computeRisk(signals) {
  // signals: { thirdPartyHosts, pixelHits, setCookieLong, setCookieNoneSecure,
  //            suspiciousUrls, fingerprintCalls, cmp: { hasLegit, onlyNecessary }, history: { hits, lastSeen } }

  let s = 0;
  s += Math.min(signals.thirdPartyHosts || 0, 30) * 1.0;          // 0..30
  s += (signals.pixelHits || 0) * 6;                               // Pixel stark gewichten
  s += (signals.suspiciousUrls || 0) * 4;                           // /track,/collect,utm_…
  if (signals.setCookieLong)        s += 10;                        // Max-Age lang
  if (signals.setCookieNoneSecure)  s += 8;                         // SameSite=None; Secure
  s += (signals.fingerprintCalls || 0) * 5;                         // Canvas/Audio/WebGL
  if (signals.cmp?.hasLegit)        s += 10;                        // legit. interest default
  if (signals.cmp?.onlyNecessary)   s -= 15;                        // fairer CMP → abwerten

  // History weighting (optional): prior incidents increase risk conservatively
  const histHits = signals.history?.hits || 0;
  const histLastSeen = signals.history?.lastSeen || 0;
  if (histHits > 0) {
    // Add up to +25 points based on prior hits (1.5 per hit, capped)
    s += Math.min(histHits * 1.5, 25);
  }

  s = Math.max(0, Math.min(100, Math.round(s)));
  let level = "low";
  if (s >= 70) level = "high";
  else if (s >= 40) level = "mid";

  let recommend = "soft";
  if (level === "mid")  recommend = "standard";
  if (level === "high") recommend = "strict";

  // Build human-readable reasons for the computed risk score
  const reasons = [];
  if (signals.thirdPartyHosts) reasons.push(`Drittanbieter-Hosts: ${signals.thirdPartyHosts}`);
  if (signals.pixelHits) reasons.push(`${signals.pixelHits} Tracking-Pixel entdeckt`);
  if (signals.suspiciousUrls) reasons.push(`${signals.suspiciousUrls} verdächtige Tracking-URLs`);
  if (signals.setCookieLong) reasons.push("Langzeit-Cookie gefunden");
  if (signals.setCookieNoneSecure) reasons.push("SameSite=None; Secure-Cookie erkannt");
  if (signals.fingerprintCalls) reasons.push(`${signals.fingerprintCalls} Fingerprint-Versuche`);
  if (histHits) reasons.push(`Historie: ${histHits}x auffällig`);
  if (signals.cmp?.hasLegit) reasons.push("CMP mit legitimen Interesse vorausgewählt");
  if (signals.cmp?.onlyNecessary) reasons.push("CMP bietet nur notwendige Cookies an");

  return { score: s, level, recommend, reasons };
}