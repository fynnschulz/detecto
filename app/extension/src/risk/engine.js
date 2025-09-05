(function(){
  "use strict";
  const WEIGHTS = {
    thirdPartyHosts: 1.0,
    pixelHits: 6,
    suspiciousUrls: 4,
    setCookieLong: 10,
    setCookieNoneSecure: 8,
    fingerprintCalls: 5,
    cmpHasLegit: 10,
    cmpOnlyNecessary: 15,
    suspiciousHeaders: 5,
    tinyResponses: 4,
    historyHit: 1.5,
    historyMax: 25,
    cnameCloak: 10,
    pixelRedirects: 6
  };
  // Risk Engine – MV3 compatible (no exports). Exposes: self.computeRisk(signals)

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

  self.computeRisk = function(signals){
    // signals: { thirdPartyHosts, pixelHits, setCookieLong, setCookieNoneSecure,
    //            suspiciousUrls, fingerprintCalls, cmp: { hasLegit, onlyNecessary },
    //            history: { hits, lastSeen }, pixelRedirects, cnameCloak,
    //            suspiciousHeaders, tinyResponses }
    const sgn = signals || {};

    let s = 0;
    s += Math.min(sgn.thirdPartyHosts || 0, 30) * WEIGHTS.thirdPartyHosts;          // 0..30
    s += (sgn.pixelHits || 0) * WEIGHTS.pixelHits;                              // Pixel stark gewichten
    s += (sgn.suspiciousUrls || 0) * WEIGHTS.suspiciousUrls;                         // /track,/collect,utm_…
    if (sgn.setCookieLong)       s += WEIGHTS.setCookieLong;                       // Max-Age lang
    if (sgn.setCookieNoneSecure) s += WEIGHTS.setCookieNoneSecure;                        // SameSite=None; Secure
    s += (sgn.fingerprintCalls || 0) * WEIGHTS.fingerprintCalls;                       // Canvas/Audio/WebGL
    if (sgn.cmp?.hasLegit)       s += WEIGHTS.cmpHasLegit;                       // legit. interest default
    if (sgn.cmp?.onlyNecessary)  s -= WEIGHTS.cmpOnlyNecessary;                       // fairer CMP → abwerten

    // New: suspiciousHeaders (e.g., cookies with wide domain scopes, very large response headers)
    if (sgn.suspiciousHeaders) s += sgn.suspiciousHeaders * WEIGHTS.suspiciousHeaders;

    // New: tinyResponses (very small response bodies)
    if (sgn.tinyResponses) s += sgn.tinyResponses * WEIGHTS.tinyResponses;

    // History weighting (optional): prior incidents increase risk conservatively
    const histHits = sgn.history?.hits || 0;
    if (histHits > 0) {
      // Add up to +25 points based on prior hits (1.5 per hit, capped)
      s += Math.min(histHits * WEIGHTS.historyHit, WEIGHTS.historyMax);
    }

    // Heuristik: CNAME-Cloaking (falls vom SW gesetzt)
    const cnameCloak = !!sgn.cnameCloak;
    if (cnameCloak) s += WEIGHTS.cnameCloak;

    // Pixel Redirects contribute to score
    if (sgn.pixelRedirects) s += sgn.pixelRedirects * WEIGHTS.pixelRedirects;

    s = clamp(Math.round(s), 0, 100);

    let level = "low";
    if (s >= 70) level = "high";
    else if (s >= 40) level = "mid";

    let recommend = "soft";
    if (level === "mid")  recommend = "standard";
    if (level === "high") recommend = "strict";

    // Build human-readable reasons for the computed risk score
    const reasons = [];
    if (sgn.thirdPartyHosts) reasons.push(`Drittanbieter-Hosts: ${sgn.thirdPartyHosts}`);
    if (sgn.pixelHits) reasons.push(`${sgn.pixelHits} Tracking-Pixel entdeckt`);
    if (sgn.suspiciousUrls) reasons.push(`${sgn.suspiciousUrls} verdächtige Tracking-URLs`);
    if (sgn.setCookieLong) reasons.push("Langzeit-Cookie gefunden");
    if (sgn.setCookieNoneSecure) reasons.push("SameSite=None; Secure-Cookie erkannt");
    if (sgn.fingerprintCalls) reasons.push(`${sgn.fingerprintCalls} Fingerprint-Versuche`);
    if (histHits) reasons.push(`Historie: ${histHits}x auffällig`);
    if (sgn.cmp?.hasLegit) reasons.push("CMP mit legitimen Interesse vorausgewählt");
    if (sgn.cmp?.onlyNecessary) reasons.push("CMP bietet nur notwendige Cookies an");
    if (sgn.pixelRedirects) reasons.push(`${sgn.pixelRedirects} Tracking-Pixel umgeleitet`);
    if (cnameCloak) reasons.push("CNAME-Cloaking-Verdacht");
    if (sgn.suspiciousHeaders) reasons.push(`${sgn.suspiciousHeaders} verdächtige Header-Muster erkannt (z.B. breite Cookie-Domains, sehr große Header)`);
    if (sgn.tinyResponses) reasons.push(`${sgn.tinyResponses} ungewöhnlich kleine Antwortkörper entdeckt`);

    return { score: s, level, recommend, reasons };
  };
})();