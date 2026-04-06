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
   - `DEVICE_ID` — UUID aus den NotizApp-Settings
   - `MCP_BEARER_TOKEN` — selbst gewählter langer Random-String
3. **Deploy**: `npx vercel --prod`
4. **Bookmarklet bauen**: Datei `bookmarklet/bookmarklet.html` im Browser öffnen, URL + Token eintragen, Link in Lesezeichen-Leiste ziehen.

## Nutzung

In claude.ai eine Antwort markieren (oder Strg+A für die ganze Seite) → Bookmarklet klicken → Titel eingeben → Notiz erscheint am Handy.

## API

`POST /api/note?token=<MCP_BEARER_TOKEN>`

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
