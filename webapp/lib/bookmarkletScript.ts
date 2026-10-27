/**
 * Baut den javascript:-Bookmarklet-Link. Er liest nur Auswahl, Seitentitel und URL und
 * öffnet damit den Speichern-Tab der Webapp. Kein Schlüssel, keine Eingriffe in die Seite —
 * die CSP der fremden Seite greift für den neuen Tab nicht.
 */
export function buildBookmarkletHref(webappOrigin: string): string {
  const saveUrl = JSON.stringify(`${webappOrigin}/bookmarklet/save`);
  const script =
    '(function(){' +
    'var d={t:document.title,u:location.href,s:String(window.getSelection()).trim()};' +
    `window.open(${saveUrl}+'#'+encodeURIComponent(JSON.stringify(d)),'_blank','noopener');` +
    '})();';
  return 'javascript:' + encodeURIComponent(script);
}
