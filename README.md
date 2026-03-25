# Navneet Singh — Portfolio v2
### Editorial Dark Theme · Generative Particles · Framer Motion

No WebGL / Three.js. Pure React + Framer Motion + Canvas 2D.
**Only 2 runtime dependencies**: `react` and `framer-motion`.

---

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # → /dist (deploy anywhere)
```

---

## File Structure

```
portfolio-v2/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx           ← React entry
    └── App.jsx            ← ENTIRE portfolio (all sections in one file)
```

All components live in `App.jsx` — cleanly separated with headers.

---

## Your Checklist

### Required
| What | Where in App.jsx | How |
|------|-----------------|-----|
| **Your photo** | About section, `// ↑ REPLACE` comment | Replace the placeholder `<div>` with `<img src="/photo.jpg" ...>` |
| **Email address** | Contact section + Footer | Search `navneet@lpu.in` and replace both occurrences |
| **Contact form** | `submit` async function | Wire to [EmailJS](https://emailjs.com) (free) or [Formspree](https://formspree.io) |
| **GitHub links** | Each project's `github` field | Update the `projects` array entries |

### Optional
| What | Where | Notes |
|------|-------|-------|
| Project screenshots | `ProjectCard` component, `// ↓ REPLACE` comment | Uncomment `<img>` and point to `/public/projects/xxx.png` |
| Color palette | `T` object at top of file | All colors in one place |
| Particle density | `ParticleCanvas` — `for (let i = 0; i < 70` and `< 35` | Reduce numbers on low-end devices |
| Add a 4th project | `projects` array | Copy one entry, change content + Mockup component |
| Fonts | `@import` in `GLOBAL_CSS` | Currently: Cormorant Garamond (display serif) + DM Sans + DM Mono |

---

## Design Decisions

| Choice | Rationale |
|--------|-----------|
| **Cormorant Garamond** | Premium editorial serif — creates contrast with the data-terminal mono |
| **Deep dark blues** (`#070b12` → `#192438`) | Layered depth, not flat black |
| **Cyan `#4dd9e8`** | Sophisticated, slightly desaturated — not garish neon |
| **Alternating project layout** | Odd projects: text-left / even: text-right — editorial rhythm |
| **Coded mockups** | Live-rendered UI illustrations that match the project context |
| **Parallax on mockups** | Subtle scroll-speed difference adds depth without 3D |

---

## Deploy

### Vercel (one command)
```bash
npx vercel --prod
```

### Netlify
```bash
npm run build
# Drag /dist to netlify.app dashboard
```

### GitHub Pages
```js
// vite.config.js — add base for repo subdirectory
base: '/your-repo-name/'
```
```bash
npm run build && npx gh-pages -d dist
```

---

## Performance

- No WebGL/Three.js — the Canvas 2D particle field uses a single `<canvas>` element
- Particle count: 70 nodes + 35 streams. Halve these if needed for mobile
- `devicePixelRatio` capped via `canvas.width = offsetWidth * dpr` — sharp on retina, not excessive
- All Framer Motion animations are `once: true` (fire once on enter, never replay)
- Google Fonts loaded via `@import` — for production, self-host with `fontsource` packages instead

---

Built by Claude (Anthropic) for Navneet Singh · v2 — No 3D Edition
