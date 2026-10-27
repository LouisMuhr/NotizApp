/**
 * Baut den javascript:-Bookmarklet-Link. Er liest nur Auswahl, Seitentitel und URL und
 * öffnet damit das Speichern-Fenster der Webapp. Kein Schlüssel, keine Eingriffe in die Seite —
 * die CSP der fremden Seite greift für das neue Fenster nicht.
 */
export function buildBookmarkletHref(webappOrigin: string): string {
  const saveUrl = JSON.stringify(`${webappOrigin}/bookmarklet/save`);
  const script =
    '(function(){' +
    'var d={t:document.title,u:location.href,s:String(window.getSelection()).trim()};' +
    'var w=520,h=Math.min(760,screen.availHeight-40);' +
    'var l=Math.round(window.screenX+(window.outerWidth-w)/2),tp=Math.round(window.screenY+(window.outerHeight-h)/2);' +
    `window.open(${saveUrl}+'#'+encodeURIComponent(JSON.stringify(d)),'_blank','popup,noopener,width='+w+',height='+h+',left='+l+',top='+tp);` +
    '})();';
  return 'javascript:' + encodeURIComponent(script);
}
