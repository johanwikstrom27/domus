# Domus

Domus är en privat hushållsapp byggd i Next.js. Projektet stödjer nu:

- Supabase Auth för riktiga användarkonton
- delad hushållsdata i Supabase
- realtime-uppdateringar mellan medlemmar
- lokal fallback om Supabase-variabler saknas
- en uppdaterad app-shell för desktop och mobil

## Lokalt

```bash
npm install
npm run dev
```

Öppna `http://localhost:3000`.

## Supabase

1. Skapa ett Supabase-projekt.
2. Kör migrationen i [supabase/migrations/20260309203000_domus_realtime_foundation.sql](/Users/johanwikstrom/domus/supabase/migrations/20260309203000_domus_realtime_foundation.sql).
3. Säkerställ att Email auth är aktiverat.
4. Om du vill kunna testa snabbt utan mailbekräftelse: stäng av email confirmation i Supabase Auth settings.

Miljövariabler:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` behövs inte av frontend-flödet som finns i repo:t just nu.

## Vercel

1. Importera repo:t i Vercel.
2. Lägg in samma `NEXT_PUBLIC_SUPABASE_*`-variabler i projektets Environment Variables.
3. Deploya.
4. Skapa två konton och bjud in användare två via hushållsinställningarna.

## Verifiering

Följande kommandon går igenom:

```bash
npm run build
npm run lint
```
