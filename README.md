# SoulLink Tracker

Pokémon Gen I–V Nuzlocke **SoulLink** Tracker für zwei Spieler – mit Echtzeit-Synchronisation,
Team-Verwaltung, Bestätigungs-Anfragen (Link / Tod / Wiederbeleben / Team) und einer
Strategie-Analyse (Typen-Abdeckung, Arena-Risiko, Carry-Empfehlungen).

## Tech-Stack

- **React 19** + **TypeScript** + **Vite 8**
- **Tailwind CSS v4**
- **Supabase** (PostgreSQL, Row Level Security, Realtime)
- **TanStack React Query v5** (Server-State)
- **Zustand** (Client-State, persistiert)
- **React Router v7** (BrowserRouter / SPA)

## Lokale Entwicklung

```bash
npm install
cp .env.example .env   # Werte eintragen (siehe unten)
npm run dev            # http://localhost:5173
npm run build          # Typecheck (tsc -b) + Produktionsbuild nach dist/
npm run preview        # Produktionsbuild lokal testen
```

## Environment-Variablen

Beide Werte sind clientseitig öffentlich (der Anon-Key ist als Public-Key gedacht; der Zugriff
ist über Row Level Security abgesichert).

| Variable | Beschreibung |
| --- | --- |
| `VITE_SUPABASE_URL` | Projekt-URL aus den Supabase-Settings |
| `VITE_SUPABASE_ANON_KEY` | Anon/Public API-Key aus den Supabase-Settings |

## Datenbank

Das Schema liegt in `supabase/`. Bei einer leeren Datenbank `schema.sql` ausführen und danach
die Migrationen `migration_v5.sql` … `migration_v8.sql` in Reihenfolge (im Supabase SQL-Editor).

## Deployment (Vercel)

Das Projekt ist eine Single-Page-App. Damit Deep-Links wie `/run/:id` auch bei Browser-Refresh
oder Direktaufruf funktionieren, leitet `vercel.json` alle Pfade auf `index.html` um.

1. Repository in Vercel importieren (Framework wird als **Vite** erkannt).
2. Unter **Settings → Environment Variables** `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.
3. Deploy. Build-Command (`npm run build`) und Output-Verzeichnis (`dist`) sind in `vercel.json` definiert.

> Hinweis: Die `VITE_*`-Variablen werden zur Build-Zeit eingebettet. Nach dem Ändern der
> Environment-Variablen ist ein erneuter Deploy nötig.
