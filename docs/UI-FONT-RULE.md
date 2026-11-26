# UI FONT RULE (fixed — do not change)

The interface uses ONE typeface system, nothing else:

| Script | Font | Source |
|---|---|---|
| Latin, digits, symbols | **Google Sans Flex** (wght 400–800) | self-hosted `public/fonts/GoogleSansFlex-latin.woff` |
| Sinhala | **Noto Sans Sinhala** (wght 400–800) | self-hosted `public/fonts/NotoSansSinhala-ui.woff` |

* The stack is defined ONCE, in `src/index.css` as `--ui-font`. Tailwind's `font-sans`, `font-mono` and `font-sinhala` all point to it. Nothing may declare another UI font-family.
* Fonts are self-hosted (OFL licensed) so they never change with network, Google Fonts or device.
* Allowed exceptions (not UI): the Shape Guide preview styles (Noto Serif Sinhala, Abhaya Libre, Yaldevi, Gemunu Libre) and the user's own font being tested in Text Studio.
* `tests/logic.test.mjs` ("uiFont rule") fails the build if any of this is broken.
