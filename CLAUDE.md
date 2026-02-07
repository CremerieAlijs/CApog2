# Cremerie Alijs

Artisanal ice cream shop website in Rijmenam, Belgium.

## Design System

### Aesthetic
Retro 70s village ice cream shop — warm, playful, nostalgic. Floating organic shapes, soft gradients, rounded corners, gentle animations.

### Brand Colors (from alijs-brand-guide.pdf)

| Name | Hex | CSS Variable |
|------|-----|--------------|
| Cream Light | #e8cfb6 | --brand-cream-light |
| Golden | #f4c784 | --brand-golden |
| Caramel | #a6572d | --brand-caramel |
| Chocolate | #632d16 | --brand-chocolate |
| Coral | #cc6358 | --brand-coral |
| Red/Terracotta | #a82b1d | --brand-red |
| Sage Light | #b8c470 | --brand-sage-light |
| Sage/Olive | #92a152 | --brand-sage |
| Navy | #1d1f52 | --brand-navy |
| Mauve | #8c7085 | --brand-mauve |
| Brand White | #f5e6d7 | --brand-white |

### Typography
**Font:** Montserrat (Google Fonts)
**Weights:** 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Theming System
The site uses a seasonal theming system via CSS custom properties. Themes are automatically applied based on the current date, with special day themes taking priority over seasonal themes.

#### How It Works
1. On page load, `js/theme.js` detects the current date
2. Special days are checked first (Valentine's, Easter, etc.)
3. If no special day, the seasonal theme applies (summer or winter)
4. The theme is applied via `data-theme` attribute on `<html>`
5. CSS custom properties update to reflect the theme colors

#### Semantic CSS Variables
Each theme defines these semantic variables:
| Variable | Purpose |
|----------|---------|
| `--primary` | Main brand color for the theme |
| `--primary-light` | Lighter variant for gradients |
| `--primary-dark` | Darker variant for hover states |
| `--bg-main` | Main background (hero, location section) |
| `--bg-section` | Section backgrounds (cream areas) |
| `--bg-section-alt` | Alternate section background |
| `--bg-card` | Card backgrounds |
| `--text-primary` | Main text color |
| `--text-on-primary` | Text on primary-colored backgrounds |
| `--accent` | Accent color (often same as primary) |
| `--accent-dark` | Dark accent for footer |

#### Theme Calendar & Taglines
Each theme has a unique color and tagline that displays in the hero section.

| Theme | Dates | Tagline |
|-------|-------|---------|
| Summer | April 1 - October 31 | Waar elk bolletje een zomerherinnering is |
| Winter | November 1 - March 31 | Waar warmte smelt op je tong |
| Valentine's | February 14 | Liefde smaakt naar meer |
| Easter | Sat-Mon around Easter | Lente in elk bolletje |
| Mother's Day | 2nd Sunday of May | Voor de allerliefste |
| Midsummer | June 21 | De langste dag, het lekkerste ijs |
| National Day | July 21 | Trots Belgisch, ambachtelijk lekker |
| Halloween | October 15 - November 1 | Griezelig goed |
| Sinterklaas | December 1-5 | Van de Sint, met liefde gedraaid |
| Christmas | December 6 - January 1 | Maak het feest compleet |

#### Testing & Debugging
**URL override:** Add `?theme=<name>` to test any theme:
```
https://alijs.be/?theme=winter
https://alijs.be/?theme=halloween
https://alijs.be/?theme=christmas
```

**Console API:** The `window.AlijsTheme` object exposes:
```js
// Apply a theme manually
AlijsTheme.applyTheme('halloween')

// Detect theme for a specific date
AlijsTheme.detectTheme(new Date('2026-12-25'))  // → 'christmas'

// Get Easter date for a year
AlijsTheme.getEasterDate(2026)  // → Date object

// Get Mother's Day for a year
AlijsTheme.getMothersDay(2026)  // → Date object

// Available theme names
AlijsTheme.THEMES  // { summer, winter, valentines, easter, ... }

// Available taglines
AlijsTheme.TAGLINES  // { summer: 'Waar elk bolletje...', winter: '...', ... }
```

#### Logo Theming
The logo color is shifted per theme using CSS filters (sepia, saturate, hue-rotate). This allows the single PNG logo to match each theme's primary color without maintaining multiple logo files.

#### Transitions
Theme changes animate smoothly via `--theme-transition` (0.4s). This is disabled when `prefers-reduced-motion: reduce` is set.

### Key Design Patterns
- Floating decorative shapes with subtle animation
- Elliptical section dividers (clip-path)
- Cards with rounded corners (1.5-3rem radius)
- Pill-shaped badges and buttons
- Smooth transitions on hover/focus
- Respect prefers-reduced-motion

### Project Structure

```
alijs.be/
├── index.html              # Main page
├── styles.css              # All styles and theme definitions
├── js/
│   ├── theme.js            # Seasonal theme switching logic
│   └── data.js             # Google Sheets data loader
├── img/
│   ├── logo-alijs.png        # Main logo
│   ├── favicon.svg         # Theme-aware favicon
│   └── about-photo.jpg     # About section image
├── alijs-brand-guide.pdf   # Official brand guidelines
└── CLAUDE.md               # This file
```

### Data Source

Opening hours, flavors, and "taste of the moment" are loaded from a Google Sheets document via `js/data.js`. The sheet is published as CSV and fetched client-side.
