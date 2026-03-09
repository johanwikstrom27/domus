DOMUS – FULLSTÄNDIG SPECIFIKATION (PRIVAT VERSION)

ÖVERGRIPANDE
Domus är en privat, svensk hushållsapp för mig, min familj och nära vänner. Ingen business.
Appen ska kännas lugn, personlig, svensk, enkel, stabil och vara i realtid.

SPRÅK + NAMNREGLER (VIKTIGT)
- All UI-text ska vara på svenska och mänsklig (inte teknisk).
- Om en person nämns ska alltid ENDAST FÖRNAMN användas (även när appen refererar till “dig själv”).
- Inga roller som “sambo”, “användare” osv. Överallt: inköp, to-do, notiser, historik, presence, toastar.

AUTH / KONTO (BESLUT)
- Signup/Login: E-post + lösenord.
- Signup kräver även: Förnamn + Efternamn.
- Ingen användarnamn-funktion.
- Efternamn används inte i vardagsflödet (endast ev i konto/profil).

HUSHÅLL
Ett hushåll består av:
- Medlemmar (inloggade användare)
- Boenden
All data delas inom hushållet och synkas i realtid.

INVITE TILL HUSHÅLL (LÄNK)
- Bjud in via länk med token: /join?token=...
- Rekommenderat: giltighet 7 dagar + engångsanvändning.
- Om ej inloggad → logga in/skapa konto först → anslut hushåll.
- Åtkomst styrs av medlemskap (RLS/permissions).

BOENDEN
Domus ska stödja flera boenden inom samma hushåll (inte “platser”).
Exempel: “Huset”, “Sommarstugan”, “Fjällstugan”.
- Användaren skapar boenden själv: namn + ikon (obligatoriskt) + valfri accentfärg.
- UI visar valt boende tydligt högst upp: 🏠 Huset ⌄
- Boendebyte: subtil animation + toast “Nu är du i Sommarstugan”.

Per boende sparas:
- Inköpslista
- Presets
- Historik
- Kategoriordning
- “Lär sig”-beteende (standardantal/enhet per boende över tid)

REALTIME (KÄRNKRAV)
- Alla ändringar synkas direkt mellan medlemmar.
- Optimistic UI.
- Konflikter: senaste skrivning vinner.
- Visningar (historik/”vem gjorde vad”) ska använda förnamn.

INKÖPSLISTA
Realtid på allt: lägga till, ändra mängd/enhet, check/uncheck, delete.

Lägg till vara (autosuggest)
- Snabb input: skriv “mjö” → få förslag.
- Enter väljer alltid översta förslaget direkt och lägger till.
- Inga extra bekräftelser.

Standardmängd
- Varje katalogartikel har standardantal + standardenhet (ex: Banan 6 st, Mjölk 1 l).
- När vara läggs till sätts standard direkt.

Inline ändra mängd/enhet
- På raden visas t.ex: “Banan 6 st”.
- Klick på “6 st” → inline-edit:
  - Ändra antal
  - Byt enhet från en rimlig lista per vara (st/kg/l/pkt etc)
- Sparas automatiskt när man klickar utanför.
- Ingen modal, ingen spara-knapp.

Smart parsing vid input
- “bana 10” → Banan – 10 st (om st är default)
- “mjölk 2” → Mjölk – 2 l (om l är default)

Dubbletter (VIKTIGT BESLUT)
- Samma vara ska ALLTID slås ihop automatiskt:
  - Finns Banan 6 st och man lägger till Banan igen → blir 12 st.
  - Ingen fråga, ingen ny rad.

Checka vara
- Check → line-through och flytta till “Plockat”.
- “Plockat” är kollapsbar sektion, senaste överst.
- Klick igen → återställ (uncheck).

Undo
- Vid borttagning: toast “Tog bort X” med knapp “Ångra”.

Kategorier
- Varor kategoriseras automatiskt och sorteras logiskt.
- Användaren kan ändra kategoriordning.
- Appen minns senaste ordningen per boende.

PRESETS
- Spara aktuell inköpslista som preset.
- Applicera preset.
- När preset appliceras: lägg endast till saknade varor (inte duplicera).
- Presets är per boende.

RECEPT
- Receptsida med receptkort + ingredienslista med checkbox.
- “Välj alla” + “Lägg till valda i inköpslistan”.
- Vid tillägg: matcha mot katalog, sätt kategori, standardenhet, slå ihop mot existerande (öka antal).

TO-DO (DELT + REALTIME)
To-do är delad i hushållet och synkar i realtid.
Uppgift kan vara:
- Kopplad till boende (valfritt)
- Eller global för hushållet

Uppgift innehåller:
- Titel
- Anteckning (valfritt)
- Förfallodatum (valfritt)
- Ansvarig (valfritt): ingen / specifik medlem / alla
- Status: aktiv / klar

Återkommande uppgifter
- Engång
- Varje vecka (välj veckodag)
- Varannan vecka
- Varje månad (datum eller sista dagen)
- Varje år
- Anpassad: var X dag/vecka/månad (göms bakom “Anpassad”)

När återkommande markeras som klar
- Skapa nästa instans (eller flytta förfallodatum) automatiskt direkt.
- Visa diskret feedback: “Klar. Nästa: 21 mars”.
- Ingen gamification.

NOTISER (ENDAST TO-DO)
VIKTIGT: Notiser ska INTE inkludera inköpslistan. Endast To-do.

Daglig sammanställning (gratis upplägg)
- Körs 1 gång per dag kl 08:00 svensk tid (Europe/Stockholm).
- På gratisplan ok att den triggas någon gång inom 08:00–08:59.
- Skicka endast om det finns något relevant.

Innehåll per person (alltid förnamn)
- Förfaller idag
- Försenade uppgifter (overdue)
- Gruppera per boende i texten.
- Om inget finns → skicka ingen notis.

Notiser på/av (VIKTIGT)
- Varje användare ska enkelt kunna slå av/på daglig sammanställning.
- Inställningar → Notiser: [På/Av] “Daglig sammanställning (08:00)”
- Om Av: användaren får inga dagliga notiser.

STARTSIDA (ÖVERSIKT)
- Visa boenden med “antal kvar att handla” (valfritt men önskat) så man ser status utan att byta boende.
- Appen ska kännas enkel och tydlig direkt.

DESIGNPRINCIPER
- Svensk, lugn, nordisk känsla.
- Luftigt, rundade hörn, mjuka skuggor.
- Färg: mörkgrön + varm beige (dämpat, inget neon).
- Ingen teknisk jargong i UI.

MÅL
Domus ska vara ett privat, stabilt system för hemmet:
- Flera boenden med ikon + tydlig boende-switch
- Realtid överallt (inköp + to-do)
- Smart inköpsinput (autosuggest, enter, smart parsing, dubblett-sammanslagning)
- Inline mängd/enhet
- Presets + recept → ingredienser till inköp
- To-do med återkommande regler
- Daglig to-do-notis 08:00, endast om något finns
- Notiser enkelt på/av per användare
- All personreferens via förnamn överallt