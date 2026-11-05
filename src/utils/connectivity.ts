// Schneller Erreichbarkeits-Check ohne Native-Modul (kein NetInfo im Build).
// Gedacht fuer Entscheidungen wie "Spracherkennung online oder auf dem Geraet":
// ein Fehlschlag/Timeout heisst "behandle es wie offline", nicht "sicher offline".

// Eigene Domain statt gstatic.com: sonst ginge bei jedem Diktat die IP an Google.
// `webapp/public/ping` kommt statisch vom Vercel-CDN (kein Funktions-Kaltstart); fetch scheitert
// ohnehin nur bei Netzfehlern, auch ein 404 hiesse „online".
const PROBE_URL = 'https://www.velmnote.com/ping';

export async function isProbablyOnline(timeoutMs = 1200): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(PROBE_URL, { method: 'HEAD', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
