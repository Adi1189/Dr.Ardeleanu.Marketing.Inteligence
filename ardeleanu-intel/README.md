# Centru Inteligență Competitivă — Dr. Ardeleanu

Site static (GitHub Pages) pentru rapoartele săptămânale și lunare de inteligență competitivă.
Filtrare după brand (Dr. Ardeleanu / Dental Safari), canal social, cadență, lună și căutare liberă.

---

## Cum funcționează

- **`index.html`** — dashboard cu gate de parolă + filtre. Citește `data/reports.json` și randează cardurile.
- **`data/reports.json`** — manifestul = sursa de adevăr a listei de rapoarte. **Nu se editează manual.**
- **`data/config.json`** — lista de branduri și canale (cu cadența fiecăruia). Aici adaugi un canal nou.
- **`reports/<brand>/<canal>/`** — aici pui fișierele HTML ale rapoartelor.
- **`scripts/build-manifest.mjs`** — scanează `reports/` și regenerează `reports.json`.

---

## Workflow săptămânal (3 pași)

1. **Salvează raportul** generat de skill în folderul corect:
   ```
   reports/adult/tiktok/2026-06-22_tiktok-saptamanal.html
   reports/kids/prices/2026-07-01_preturi-pedodontie.html
   ```
   Convenție de nume: `YYYY-MM-DD_descriere.html` (data prima).

2. **Regenerează manifestul:**
   ```bash
   node scripts/build-manifest.mjs
   ```

3. **Publică:**
   ```bash
   git add .
   git commit -m "Rapoarte saptamana 22 iun"
   git push
   ```
   GitHub Pages publică automat în ~1 minut.

---

## Metadate în rapoarte (recomandat)

Scriptul preferă meta-taguri din `<head>`-ul raportului. Skill-urile pot adăuga:

```html
<meta name="report:brand"   content="adult">      <!-- adult | kids -->
<meta name="report:channel" content="tiktok">
<meta name="report:cadence" content="weekly">     <!-- weekly | monthly -->
<meta name="report:date"    content="2026-06-22">
<meta name="report:period"  content="22–28 iun 2026">
<title>Raport TikTok săptămânal · Dr. Ardeleanu</title>
```

Dacă lipsesc, scriptul deduce automat: **brand** și **canal** din folder, **data** din numele
fișierului (`YYYY-MM-DD`), **cadența** din `config.json`, **titlul** din `<title>`.

---

## Deploy pe GitHub Pages

1. Creează repo (recomandat **privat**) și împinge tot conținutul acestui folder în rădăcină.
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `/ (root)`.
3. Salvează. Site-ul apare la `https://<user>.github.io/<repo>/`.
4. (Opțional) Domeniu propriu, ex. `intel.clinicileardeleanu.ro` → câmpul *Custom domain*.

Fișierul `.nojekyll` e deja inclus (oprește procesarea Jekyll).

---

## Adăugarea unui canal nou

1. Adaugă-l în `data/config.json` la `channels` (cu `label` și `cadence`).
2. Creează folderul `reports/adult/<canal>/` și/sau `reports/kids/<canal>/`.
3. Rulează `node scripts/build-manifest.mjs`.
