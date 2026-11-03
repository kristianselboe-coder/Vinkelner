# Vinkelner – prototype v5

Klikkbar mobilprototype. Ren HTML/CSS/JS, ingen bygging. **Alle viner, priser og lagerstatus er fiktive eksempeldata** (ikke fra Vinmonopolet).

## Kjør
    python3 -m http.server 8787   # i denne mappen
    # åpne http://localhost:8787 i mobilvisning (390 × 844)

## Designretning v5 (nordisk ro)
- **Palett:** papir (#F3F0EA), flate (#FBFAF7), blekk (#161C1B), én dempet leirtone som aksent (#9A5B44). Mørk modus: #101413 / #D4A28A. Vintyper vises kun som små dempede prikker og flaskefarger.
- **Typografi:** Geist (UI) og Instrument Serif (overskrifter, vinnavn, Gustavs replikker), begge OFL og lagret lokalt i `assets/fonts`.
- **Gustav:** strekfigur i blekk, hud og én leirfarget sløyfe, med seks stemninger og et lite nikk.
- **«Gustav lufter vinen»:** karaffel som fylles i én strek, ca. 1,5 s, uten konfetti.

## Filer
- `index.html`, `style.css`, `app.js` – grensesnittet
- `gustav.js` – maskoten (SVG fra enkle former)
- `wines.js`, `engine.js` – eksempeldata og rangering (rosé-feil for dessert rettet i v4)
- `assets/fonts` – Geist + Instrument Serif (SIL OFL, lisens ligger ved)
- `screens/` – skjermbilder 390 × 844

localStorage-nøkler: `vk_favs`, `vk_profile`, `vk_onboarded`.
