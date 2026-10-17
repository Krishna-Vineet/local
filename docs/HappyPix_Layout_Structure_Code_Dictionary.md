# HappyPix — Layout Structure Code Dictionary

Detailed meaning, visual structure, usage and implementation guidance

## 1. What These Code Words Mean

Words such as HERO, VSTACK, HSTACK, GRID2X2, CASCADE, MOSAIC and COLLAGE are structural layout identifiers. They describe HOW photo slots are arranged; they do not describe the visual theme, background, colors or decorative design.

Core separation:
FORMAT → LAYOUT STRUCTURE → PHOTO SLOTS → MASK/SHAPE → DESIGN → TEXT/BRANDING → EXPORT

Example: P1-46-T04-V-HERO3 means 1 piece, 4×6 media, 4 photo slots, vertical, with one dominant hero slot and three supporting slots.

## 2. Naming Convention

| Code Part | Meaning | Example |
|---|---|---|
| P1 | Piece count | P1 = one print piece |
| 46 | Media ratio/size family | 46 = 4×6 |
| T04 | Photo slot count | T04 = 4 slots |
| V/H/S | Orientation | V vertical, H horizontal, S square |
| HERO3 | Structural arrangement | 1 hero + 3 supporting slots |

## 3. Detailed Structure Dictionary

### HERO
Meaning: One dominant/full photo slot.
Structure: The main photo gets the largest visual area. Other branding/text can occupy the remaining space.
Best use: Hero templates, wedding portraits, corporate branding, single-image premium prints.
```text
┌──────────────────┐
│      HERO 1      │
│                  │
└──────────────────┘
```

### VSTACK
Meaning: Vertical stack.
Structure: Photo slots are arranged from top to bottom, usually with consistent gaps.
Best use: Portrait prints, strips, simple multi-photo layouts.
```text
┌──────────────┐
│      1       │
├──────────────┤
│      2       │
├──────────────┤
│      3       │
└──────────────┘
```

### HSTACK
Meaning: Horizontal stack.
Structure: Photo slots are arranged from left to right, usually with consistent gaps.
Best use: Landscape prints and wide strips.
```text
┌────┬────┬────┐
│ 1  │ 2  │ 3  │
└────┴────┴────┘
```

### GRID2X2
Meaning: 2 columns × 2 rows.
Structure: Four equal or near-equal cells form a four-photo grid.
Best use: Classic four-photo collage.
```text
┌──────┬──────┐
│  1   │  2   │
├──────┼──────┤
│  3   │  4   │
└──────┴──────┘
```

### GRID3X2
Meaning: 3 columns × 2 rows.
Structure: Six slots arranged as three columns and two rows.
Best use: Landscape six-photo layouts.
```text
┌───┬───┬───┐
│ 1 │ 2 │ 3 │
├───┼───┼───┤
│ 4 │ 5 │ 6 │
└───┴───┴───┘
```

### GRID2X3
Meaning: 2 columns × 3 rows.
Structure: Six slots arranged as two columns and three rows.
Best use: Portrait six-photo layouts.
```text
┌────┬────┐
│ 1  │ 2  │
├────┼────┤
│ 3  │ 4  │
├────┼────┤
│ 5  │ 6  │
└────┴────┘
```

### GRID4X2
Meaning: 4 columns × 2 rows.
Structure: Eight slots arranged in four columns and two rows.
Best use: Wide 8-photo collage.
```text
┌──┬──┬──┬──┐
│1 │2 │3 │4 │
├──┼──┼──┼──┤
│5 │6 │7 │8 │
└──┴──┴──┴──┘
```

### GRID2X4
Meaning: 2 columns × 4 rows.
Structure: Eight slots arranged in two columns and four rows.
Best use: Tall 8-photo collage.
```text
┌───┬───┐
│ 1 │ 2 │
├───┼───┤
│ 3 │ 4 │
├───┼───┤
│ 5 │ 6 │
├───┼───┤
│ 7 │ 8 │
└───┴───┘
```

### GRID3X3
Meaning: 3 columns × 3 rows.
Structure: Nine slots arranged in a square grid.
Best use: Square/social nine-photo layouts.
```text
┌───┬───┬───┐
│ 1 │ 2 │ 3 │
├───┼───┼───┤
│ 4 │ 5 │ 6 │
├───┼───┼───┤
│ 7 │ 8 │ 9 │
└───┴───┴───┘
```

### HERO3
Meaning: One hero + three supporting slots.
Structure: One large dominant photo plus three smaller photos.
Best use: Premium 4-photo layouts.
```text
┌────────────────┐
│       1        │
├──────┬────┬────┤
│  2   │ 3  │ 4  │
└──────┴────┴────┘
```

### 3HERO
Meaning: Three prominent slots + one supporting slot.
Structure: Three photos receive major visual weight; one is secondary.
Best use: Editorial/collage designs.
```text
┌────────┬────────┐
│   1    │   2    │
├────────┴────────┤
│       3         │
├─────────────────┤
│       4         │
└─────────────────┘
```

### HERO-R3
Meaning: Hero left + three right-side slots.
Structure: Large hero occupies the left; three supporting slots stack or distribute on the right.
Best use: Portrait/landscape premium layouts.
```text
┌────────────┬────┐
│            │ 2  │
│     1      ├────┤
│    HERO    │ 3  │
│            ├────┤
│            │ 4  │
└────────────┴────┘
```

### HERO-L3
Meaning: Hero right + three left-side slots.
Structure: Large hero occupies the right; three supporting slots are on the left.
Best use: Mirror of HERO-R3.
```text
┌────┬────────────┐
│ 2  │            │
├────┤     1      │
│ 3  │    HERO    │
├────┤            │
│ 4  │            │
└────┴────────────┘
```

### HERO5
Meaning: One hero + five supporting slots.
Structure: Six total photos with one dominant image.
Best use: Large 6-photo collage.
```text
┌───────────────┐
│       1       │
│     HERO      │
├────┬────┬─────┤
│ 2  │ 3  │  4  │
├────┼────┼─────┤
│ 5  │ 6  │     │
└────┴────┴─────┘
```

### HERO-L5
Meaning: Hero on right + five supporting slots.
Structure: Large right-side hero with five supporting images.
Best use: Editorial landscape/portrait layouts.

### HERO-R5
Meaning: Hero on left + five supporting slots.
Structure: Large left-side hero with five supporting images.
Best use: Editorial landscape/portrait layouts.

### HERO7
Meaning: One hero + seven supporting slots.
Structure: Eight total photos with one dominant hero.
Best use: 6×8/digital large collages.

### TRIPTYCH
Meaning: Three-panel composition.
Structure: Three main panels, normally equal or intentionally balanced.
Best use: Three-photo portrait/landscape compositions.
```text
┌──────┬──────┬──────┐
│  1   │  2   │  3   │
└──────┴──────┴──────┘
```

### CASCADE
Meaning: Staggered/step arrangement.
Structure: Slots are offset progressively instead of forming a strict grid.
Best use: Modern editorial and playful designs.
```text
┌────────┐
│   1    │
└────────┘
   ┌────────┐
   │   2    │
   └────────┘
      ┌────────┐
      │   3    │
      └────────┘
```

### MOSAIC
Meaning: Mixed-size tiled arrangement.
Structure: Different-sized slots fit together like tiles, usually with deliberate alignment.
Best use: Dense photo collages.
```text
┌────────┬──────┐
│        │  2   │
│   1    ├──────┤
│        │  3   │
├────┬───┴──────┤
│ 4  │    5     │
└────┴──────────┘
```

### COLLAGE
Meaning: Free-form mixed composition.
Structure: Slots can have different sizes, positions, overlaps or alignments.
Best use: Creative event templates.
```text
┌───────────┬─────┐
│           │  2  │
│     1     ├─────┤
│           │  3  │
├─────┬─────┴─────┤
│  4  │     5     │
└─────┴───────────┘
```

### CORNERS
Meaning: Corner/around-center arrangement.
Structure: Photos sit around a central branding, text or empty area.
Best use: Wedding, birthday and branded designs.
```text
┌──────┐      ┌──────┐
│  1   │      │  2   │
└──────┘      └──────┘

       BRAND / TEXT

┌──────┐      ┌──────┐
│  3   │      │  4   │
└──────┘      └──────┘
```

### DIAGONAL
Meaning: Diagonal flow.
Structure: Slots progress along a diagonal path or visual axis.
Best use: Dynamic modern templates.
```text
┌──────┐
│  1   │
└──────┘
      ┌──────┐
      │  2   │
      └──────┘
            ┌──────┐
            │  3   │
            └──────┘
```

### FILM
Meaning: Film-strip structure.
Structure: Photos are arranged like frames on a photographic film strip.
Best use: Retro/photo-booth themes.
```text
┌────┬────┬────┬────┐
│ 1  │ 2  │ 3  │ 4  │
└────┴────┴────┴────┘
```

### POLAROID
Meaning: Polaroid/card structure.
Structure: Each slot is presented as a photo card, often with a bottom caption area and optional rotation.
Best use: Vintage, scrapbook and wedding themes.
```text
┌─────────┐
│         │
│ PHOTO 1 │
│         │
├─────────┤
│ caption │
└─────────┘
```

### SQUARE
Meaning: Square photo-slot structure.
Structure: Photo masks use a 1:1 aspect ratio; canvas itself does not have to be square.
Best use: Social layouts and balanced collages.
```text
┌────────┐
│        │
│ PHOTO  │
│        │
└────────┘
```

### MIX
Meaning: Mixed size/orientation.
Structure: Slots deliberately use different dimensions or portrait/landscape ratios.
Best use: Creative multi-photo layouts.
```text
┌────────────┬──────┐
│            │  2   │
│     1      ├──────┤
│            │  3   │
└────────────┴──────┘
```

### FULL
Meaning: Full-canvas photo.
Structure: One photo occupies nearly the complete printable/digital area.
Best use: Single-photo hero designs.
```text
┌──────────────────┐
│                  │
│      PHOTO       │
│                  │
└──────────────────┘
```

## 4. Direction Rules
Recommended final naming convention:
- HERO-R3 = hero on LEFT + 3 supporting slots on RIGHT.
- HERO-L3 = hero on RIGHT + 3 supporting slots on LEFT.
- HERO-R5 = hero on LEFT + 5 supporting slots on RIGHT.
- HERO-L5 = hero on RIGHT + 5 supporting slots on LEFT.

This convention should be locked and used consistently across HappyPix.

## 5. Structure vs Design
A layout structure is not a finished template. The same structural layout can have hundreds of visual designs.

Example: `P1-46-T04-V-HERO3`
- Wedding Floral
- Birthday Neon
- Corporate Minimal
- Christmas
- Halloween
- Luxury Gold
- Kids Cartoon
All of the above can use the same HERO3 geometry while changing only the visual design layer.

## 6. Recommended HappyPix Data Separation
- **FORMAT** — physical/digital canvas and output size.
- **LAYOUT** — structural arrangement code such as HERO3 or GRID2X2.
- **SLOT** — exact X/Y/Width/Height and slot order.
- **MASK** — rectangle, circle, arch, polaroid, etc.
- **DESIGN** — background, frame, decorative graphics and theme.
- **TEXT** — names, dates, captions and typography.
- **BRANDING** — logo, event/company branding.
- **EXPORT** — PNG/JPEG and final resolution.

## 7. Quick Cheat Sheet

| Code | Meaning |
|---|---|
| HERO | One dominant/full photo slot. |
| VSTACK | Vertical stack. |
| HSTACK | Horizontal stack. |
| GRID2X2 | 2 columns × 2 rows. |
| GRID3X2 | 3 columns × 2 rows. |
| GRID2X3 | 2 columns × 3 rows. |
| GRID4X2 | 4 columns × 2 rows. |
| GRID2X4 | 2 columns × 4 rows. |
| GRID3X3 | 3 columns × 3 rows. |
| HERO3 | One hero + three supporting slots. |
| 3HERO | Three prominent slots + one supporting slot. |
| HERO-R3 | Hero left + three right-side slots. |
| HERO-L3 | Hero right + three left-side slots. |
| HERO5 | One hero + five supporting slots. |
| HERO-L5 | Hero on right + five supporting slots. |
| HERO-R5 | Hero on left + five supporting slots. |
| HERO7 | One hero + seven supporting slots. |
| TRIPTYCH | Three-panel composition. |
| CASCADE | Staggered/step arrangement. |
| MOSAIC | Mixed-size tiled arrangement. |
| COLLAGE | Free-form mixed composition. |
| CORNERS | Corner/around-center arrangement. |
| DIAGONAL | Diagonal flow. |
| FILM | Film-strip structure. |
| POLAROID | Polaroid/card structure. |
| SQUARE | Square photo-slot structure. |
| MIX | Mixed size/orientation. |
| FULL | Full-canvas photo. |

## 8. Developer Rules
- Do not use a structure code as a visual theme name.
- Do not hardcode a layout's decorative background into the slot geometry.
- Keep slot coordinates separate from masks and design assets.
- Prefer normalized coordinates (0–1) so the same structure can be rendered on different canvas sizes.
- Every slot must have a stable slot ID and deterministic order.
- Every published layout must validate that slots stay inside the safe area unless intentional bleed/overflow is supported.
- Use COVER/CONTAIN/CROP independently from slot geometry.
- New structural codes should only be created when an arrangement cannot be represented by an existing structure.
- Use the locked direction convention for HERO-R3/HERO-L3 and HERO-R5/HERO-L5.
- Keep this dictionary as the authoritative meaning of structure codes.
