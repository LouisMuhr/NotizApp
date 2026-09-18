# notizapp-bridge

Vercel serverless endpoint that lets you save text from any webpage (claude.ai, ChatGPT, articles, etc.) into your NotizApp via a browser bookmarklet.

```
[Browser: claude.ai]  → bookmarklet → fetch POST
                                          ↓
                              [Vercel /api/note]
                                          ↓
                              [Supabase notes table]
                                          ↓
                              [NotizApp am Handy] (Realtime)
```

## Setup

1. **Supabase**: Projekt anlegen, `supabase-schema.sql` (im NotizApp-Repo) im SQL-Editor laufen lassen, Realtime auf `notes` aktivieren.
2. **Env**: `.env.local` (für `vercel dev`) bzw. Vercel-Dashboard ENV:
   - `SUPABASE_URL` — Project URL
   - `SUPABASE_SERVICE_KEY` — **Secret** Key (nicht Publishable!)
   - `ANTHROPIC_API_KEY` — für /api/synthesize
   - `BOOKMARKLET_MIN_TIER` — optional, Default `basic` (Freigabe des Bookmarklets)
   - (`MCP_BEARER_TOKEN`, `BRIDGE_USER_ID`, `DEVICE_ID` werden von den API-Endpunkten nicht mehr gelesen; nur noch der Worker unter `worker/` nutzt `BRIDGE_USER_ID`)
3. **Deploy**: `npx vercel --prod`
4. **Bookmarklet bauen**: In der App (Einstellungen → Bookmarklet, ab Basic) einen persönlichen Schlüssel erzeugen, `/bookmarklet` im Browser öffnen, Schlüssel eintragen, Link in Lesezeichen-Leiste ziehen.

## Nutzung

In claude.ai eine Antwort markieren (oder Strg+A für die ganze Seite) → Bookmarklet klicken → Titel eingeben → Notiz erscheint am Handy.

## API

`POST /api/note?token=<persönlicher Bookmarklet-Schlüssel>` — der Ziel-User ergibt sich aus dem Schlüssel (SHA-256-Hash in `profiles.bookmarklet_token_hash`); ein `user_id` im Body wird ignoriert.

Weitere Endpunkte (alle mit `Authorization: Bearer <Supabase-Access-Token des Users>`):
- `POST /api/synthesize` — KI-Synthese, Rate-Limit nach Tier
- `POST /api/bookmarklet-token` / `DELETE` — persönlichen Schlüssel erzeugen / widerrufen
- `POST /api/delete-user` — löscht ausschließlich den Aufrufer selbst

```json
{
  "title": "string",
  "content": "string",
  "category": "Allgemein",
  "checklist": ["item 1", "item 2"],
  "pinned": false
}
```

Auth alternativ via `Authorization: Bearer <token>` Header (für Tests aus dem Terminal).
