/**
 * Baut den javascript:-Bookmarklet-Link. Injiziert ein schwebendes Panel (Shadow DOM)
 * in die aktuelle Seite, vorausgefüllt mit der Textauswahl. Kein prompt()/alert().
 */
export function buildBookmarkletHref(webappUrl: string, bridgeUrl: string, token: string, categories: string[]): string {
  const cats = categories.length > 0 ? categories : ['Allgemein'];
  const panelScript = `(function(){
var SAVE_URL='${webappUrl}/bookmarklet/save';
var BRIDGE_URL='${bridgeUrl}';
var TOKEN='${token}';
var CATS=${JSON.stringify(cats)};
var sel=window.getSelection().toString().trim();
if(!sel){alert('Bitte zuerst Text markieren.');return;}

if(document.getElementById('_nmb_host'))return;
var host=document.createElement('div');
host.id='_nmb_host';
document.body.appendChild(host);
var shadow=host.attachShadow({mode:'closed'});

var style=document.createElement('style');
style.textContent=[
  '*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,system-ui,sans-serif;}',
  '#panel{position:fixed;bottom:24px;right:24px;width:380px;background:#FAF8F3;border:1px solid #E8DFC8;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:2147483647;overflow:hidden;',
    'transform:translateY(40px);opacity:0;transition:transform .25s cubic-bezier(.22,1,.36,1),opacity .2s;}',
  '#panel.open{transform:translateY(0);opacity:1;}',
  'header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid #E8DFC8;}',
  '.hd-title{display:flex;align-items:center;font-weight:700;font-size:15px;color:#2C2006;}',
  'header button{background:none;border:none;cursor:pointer;font-size:20px;color:#8B7355;padding:0 2px;line-height:1;}',
  '.body{padding:14px 16px;}',
  'label{display:block;font-size:12px;font-weight:600;color:#6B5535;margin-bottom:4px;margin-top:12px;}',
  'label:first-child{margin-top:0;}',
  'input[type=text],textarea{width:100%;background:#FFFEF9;border:1px solid #D4C4A0;border-radius:8px;padding:8px 10px;font-size:13px;color:#1C1000;outline:none;resize:none;}',
  'input[type=text]:focus,textarea:focus{border-color:#C8972B;}',
  '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}',
  '.chip{padding:5px 12px;border-radius:20px;border:1.5px solid #D4C4A0;background:#FFFEF9;font-size:12px;cursor:pointer;color:#4A3820;transition:all .15s;}',
  '.chip.active{background:#C8972B;border-color:#C8972B;color:#fff;font-weight:600;}',
  '.row{display:flex;align-items:center;justify-content:space-between;margin-top:12px;}',
  '.toggle-wrap{display:flex;align-items:center;gap:8px;font-size:13px;color:#4A3820;}',
  '.toggle{position:relative;width:36px;height:20px;}',
  '.toggle input{opacity:0;width:0;height:0;}',
  '.slider{position:absolute;inset:0;background:#D4C4A0;border-radius:20px;cursor:pointer;transition:.2s;}',
  '.slider:before{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;background:#fff;border-radius:50%;transition:.2s;}',
  'input:checked+.slider{background:#C8972B;}',
  'input:checked+.slider:before{transform:translateX(16px);}',
  '.reminder-toggle{font-size:12px;color:#C8972B;cursor:pointer;user-select:none;margin-top:10px;display:inline-block;}',
  '.reminder-section{margin-top:8px;display:none;}',
  '.reminder-section.open{display:block;}',
  'select{width:100%;background:#FFFEF9;border:1px solid #D4C4A0;border-radius:8px;padding:8px 10px;font-size:13px;color:#1C1000;outline:none;margin-top:4px;}',
  'select:focus{border-color:#C8972B;}',
  'footer{padding:12px 16px;border-top:1px solid #E8DFC8;display:flex;gap:10px;}',
  '.btn{flex:1;padding:10px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-weight:600;transition:opacity .15s;}',
  '.btn:active{opacity:.8;}',
  '.btn-cancel{background:#EDE5D4;color:#4A3820;}',
  '.btn-save{background:#C8972B;color:#fff;}',
  '.btn-save:disabled{opacity:.5;cursor:default;}',
  '#success{display:none;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;}',
  '#success .check{font-size:48px;animation:pop .3s cubic-bezier(.22,1,.36,1);}',
  '#success p{margin-top:12px;font-size:15px;font-weight:600;color:#2C2006;}',
  '@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}',
].join('');
shadow.appendChild(style);

var div=document.createElement('div');
div.id='panel';
div.innerHTML=[
  '<header><span class="hd-title" id="hd-title-span">Velm</span><button id="cls">✕</button></header>',
  '<div class="body" id="form-body">',
    '<label>Titel</label>',
    '<input type="text" id="ttl" maxlength="200">',
    '<label>Inhalt</label>',
    '<textarea id="cnt" rows="4"></textarea>',
    '<label>Kategorie</label>',
    '<div class="chips" id="chips"></div>',
    '<div class="row">',
      '<span class="toggle-wrap">',
        '<label class="toggle"><input type="checkbox" id="pin"><span class="slider"></span></label>',
        'KI darf darauf zugreifen',
      '</span>',
    '</div>',
    '<span class="reminder-toggle" id="rem-toggle">⏰ Erinnerung hinzufügen</span>',
    '<div class="reminder-section" id="rem-section">',
      '<label>Datum &amp; Uhrzeit</label>',
      '<input type="datetime-local" id="rem-dt" style="width:100%;background:#FFFEF9;border:1px solid #D4C4A0;border-radius:8px;padding:8px 10px;font-size:13px;color:#1C1000;outline:none;">',
      '<label>Wiederholung</label>',
      '<select id="rem-rec">',
        '<option value="once">Einmalig</option>',
        '<option value="daily">Täglich</option>',
        '<option value="weekly">Wöchentlich</option>',
        '<option value="monthly">Monatlich</option>',
      '</select>',
    '</div>',
  '</div>',
  '<div id="success"><div class="check">✅</div><p>Notiz gespeichert!</p></div>',
  '<footer>',
    '<button class="btn btn-cancel" id="can">Abbrechen</button>',
    '<button class="btn btn-save" id="sav">Speichern</button>',
  '</footer>',
].join('');
shadow.appendChild(div);

var ico=document.createElement('img');
ico.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAQAAAGKDAGaAAAFgUlEQVRYw7WXa2wUVRTH/20p7fZBW0p5iAplaUELCqEFlUCMYKwJKMYgaEwIUpQYNCIWRYgvQtTS6AeiKEqIQDBIAEFAEEm1DUVUoIqPVqhCC/IoammhC9vt/vywM7szu7NLLfHMl7n3nP/533vuPefMSHap8wNIoG57pxIYSErZDyCgB8qogTYUeKT+v2C+SlLanqA3v4EBwSdAasAI4CUUcA7wRsiBMbDIjQDQd4M0ogimtkrbMWSgAVzibUIouTIwfc4kJaVIkpT+PTxLiGplkHCo6Wq+uSOydlrYl3jD1xOSAQ5zdzcA1CJJK/ygOEk91kIhAMsQmeMDq9MRg7ojGExIINkrOAm8D4DHSg9QwiQApiDmeQzFWaDE2LUQ4DXjedimsAQaShgbqXj4NM4ISZpmVeTbdt6vGISrWtElfs76Fuig9+9hij7qFjbTs6GecEnxSdKa4DjbK0nFrzWFTI4yE/jVsvDsMaauP0JxX0ARviBgOg0A3GnZaVpO4N3llZRYYZrez8dhC/KRxrBVYSt37TPVgSh6GQN8FFxSQPLOqbsBSP3Wy2gLwJIRQcC91mPIOGyaTaTKARBxbllH7EtqZkJsgCRlvrTbF21JQiS3KN7pkFNH/BMOiJ+nq8vQTTNI8ChZnZabXJs7bxzf9zjAO/8kTLfNxynXwTpze6PlnG8/o16B+fzTfqCRgq1W62nXtYff1X1orjRiqzn2M8TgySlqAFjNuqDxFdIRKpWeag/Vo7zfJWXXei1ep3AaKDYDWypNvhLQnETk1+kWf/hC3iUrdGil0i3lAE8iRM/r1cpm3g0aNzAdgB8sACnvm8Bo0AuSLgLwKMeBQjosTEuCAJu0BSPgjsjo5WS0KyUM4Amqf6aO2cFRPUKU0cLAOhvgsgUAUM4u/PQz9lAGwC5/75eDgFlhAHuxKzNmynGtMwDtvMWOmIBahEjbYAACBWYCzY6A18kx3jI2WXolQJvRKMLqb6g5bbO0AnMPlbwSFdBrpwMA4FkOOwJ6mw08q/J8jChZnhtCR9HdfTo2IP6JyGQrfKbVGZBeETWdB723PwzQ/ZISr1IDchs9IcCtnasbWWMvCC3SNUhm2ophJ2raq9pyjycvjbju1yTje/604IzHllMXmH0256BGRBoPTipaO/jv4ktTPaNaC+rd02I5dqUsdTdUXiaGfOYbdKbPi2bnLkjLO3cszGJx+00fRLoemXlg1qkLVDOOxVyM6v4MM4kLlpQh6cObI22OIcatNh0nJj3X/8S2S3aTFhZwJ9/Z5raTZ71npZKUOWVxhPtDuBD5jZI7c+8DJ8/Giga7GcObzCMxMkFKJWlUYm6ztU0cYbihH7lccbv3cw9z+Tuq+yrG8gptNDGHBEcCSXGDjz7NDG6zWQyYLylhTyDSl1nK7VRYHLfxKmOpjCDcaH5dR5T1obPddekel9f95/BPs/ubwa+wB76acTzPRJ6hOWbYGnkEEb/wqlc96eu2CHAJ1cznLg5Fdf8lBQjxBqv87qbcx2MQJFd5HAjMyrSD0bxN6ABbWUiSQ9f4jQnNA7epjwNBSvWVGATmrX+M+xjjUGbLbHbtLLvU7w/dYf/0OrCV0ZTjjUEQ/WOxzJYh+QiRut5GkP6dz/jBms0kartA0ByWIekbbQQ9DnXYHG2gkIJOE7gc5jK32AgyavwOZ/A504N/AjG/px2entvtxf5Hoh5yByspZMN/JMjZbQ/RwRrf1W5RLZMY3Pkd7Ii8q5N71y9rae/CLbI/PY5qfKyk7ttvy13nj3aBIN6XslwZnW2TcX1KMlre8vk7RZB6QsVd7ccD3dUPXTwVhSCuI+lD80fi2iQhb1H+X5ssBEmn9KD+B7k54yut0XX/HfgvpUkmTvPggOsAAAAASUVORK5CYII=';
ico.alt='';
ico.style.cssText='width:20px;height:20px;border-radius:5px;margin-right:8px;flex-shrink:0;';
var hdSpan=shadow.getElementById('hd-title-span');
hdSpan.insertBefore(ico,hdSpan.firstChild);

var ttl=shadow.getElementById('ttl');
var cnt=shadow.getElementById('cnt');
ttl.value=sel.split('\\n')[0].slice(0,80);
cnt.value=sel;

['keydown','keyup','keypress','input','change'].forEach(function(evt){
  div.addEventListener(evt,function(e){e.stopPropagation();},{capture:true});
});

var activeCat=CATS[0];
var chipsEl=shadow.getElementById('chips');
CATS.forEach(function(c){
  var ch=document.createElement('span');
  ch.className='chip'+(c===activeCat?' active':'');
  ch.textContent=c;
  ch.onclick=function(){
    activeCat=c;
    chipsEl.querySelectorAll('.chip').forEach(function(x){x.classList.remove('active');});
    ch.classList.add('active');
  };
  chipsEl.appendChild(ch);
});

shadow.getElementById('rem-toggle').onclick=function(){
  var s=shadow.getElementById('rem-section');
  s.classList.toggle('open');
  this.textContent=s.classList.contains('open')?'✕ Erinnerung entfernen':'⏰ Erinnerung hinzufügen';
};

function close(){
  div.classList.remove('open');
  setTimeout(function(){host.remove();},300);
}
shadow.getElementById('cls').onclick=close;
shadow.getElementById('can').onclick=close;
shadow.addEventListener('keydown',function(e){if(e.key==='Escape'){close();}});

// Viele Seiten (X, Wikipedia, ...) blocken den direkten fetch() zur Bridge per
// Content-Security-Policy (connect-src). Daher speichert nicht das Panel selbst,
// sondern ein kurz geöffnetes Popup auf unserer eigenen Domain, das die CSP der
// Zielseite nicht erbt. Daten gehen per URL-Fragment mit (nie an einen Server gesendet).
shadow.getElementById('sav').onclick=function(){
  var btn=shadow.getElementById('sav');
  btn.disabled=true;
  btn.textContent='Speichern…';
  var remDt=shadow.getElementById('rem-dt').value;
  var payload={
    title:ttl.value.trim()||'Notiz aus Bookmarklet',
    content:cnt.value,
    category:activeCat,
    feeds_threads:shadow.getElementById('pin').checked,
    bridgeUrl:BRIDGE_URL,
    token:TOKEN,
  };
  if(remDt){
    payload.reminder_at=new Date(remDt).toISOString();
    payload.reminder_recurrence=shadow.getElementById('rem-rec').value;
  }
  var data=encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  var popup=window.open(SAVE_URL+'#data='+data,'_velm_bookmarklet_save','width=360,height=260');
  if(!popup){
    btn.disabled=false;
    btn.textContent='Speichern';
    alert('Popup wurde blockiert. Bitte Popups für diese Seite erlauben und erneut versuchen.');
    return;
  }
  function onMsg(e){
    if(e.source!==popup||!e.data||e.data.source!=='velm-bookmarklet')return;
    window.removeEventListener('message',onMsg);
    if(e.data.ok){
      shadow.getElementById('form-body').style.display='none';
      shadow.querySelector('footer').style.display='none';
      var s=shadow.getElementById('success');
      s.style.display='flex';
      setTimeout(close,1500);
    } else {
      btn.disabled=false;
      btn.textContent='Speichern';
      var code=e.data.error;
      var msg=code==='unauthorized'?'Schlüssel ungültig oder widerrufen. Bitte in der webapp ein neues Bookmarklet anlegen.'
        :code==='tier_required'?'Das Bookmarklet ist ab dem Basic-Plan verfügbar.'
        :'Speichern fehlgeschlagen ('+(code||'unknown')+').';
      alert(msg);
    }
  }
  window.addEventListener('message',onMsg);
};

requestAnimationFrame(function(){div.classList.add('open');});
})();`;

  return 'javascript:' + encodeURIComponent(panelScript);
}
