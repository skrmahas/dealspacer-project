# Design Library

A pasteboard of UI component designs collected from [21st.dev](https://21st.dev). Think of it as a moodboard — screenshots, code snippets, SVGs, whatever. Unstructured by design.

## Why this exists

This file feeds the agent's visual imagination. When building UI, the agent should reference these patterns as inspiration for layout, component composition, animation, and styling conventions.

## The stack

Every design here is built on the same foundation:

| Layer | What |
|-------|------|
| **Components** | [shadcn/ui](https://ui.shadcn.com) — `@/components/ui/card`, `@/components/ui/button`, `@/components/ui/table`, etc. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) with `cn()` class merging from `@/lib/utils` |
| **Icons** | [lucide-react](https://lucide.dev) |
| **Animation** | [framer-motion](https://www.framer.com/motion/) |
| **3D/Canvas** | [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + custom GLSL shaders |
| **Dark mode** | Tailwind `dark:` variants throughout |

## What's in here

### Component patterns

- **Feature cards** — Grid layouts with decorative SVG borders, dual-mode light/dark images, radial gradient overlays, and circular UI indicators.
- **Sign-in flow** — Multi-step auth (email → OTP code → success) with canvas reveal effects, animated nav bars, and glassmorphism aesthetics.
- **Performance card** — Animated number counters with spring physics, competitor comparison rows, segmented benchmark bars, and action buttons.
- **Comparison table** — Select-two-to-compare pattern with search, category filter, color-coded winner highlighting.
- **CPU Architecture SVG** — Animated node diagram with colored pulse dots, marker animations, and gradient text effects.

### Styling conventions observed

- `rounded-xl` / `rounded-2xl` / `rounded-full` for cards and buttons
- `border` with `dark:border-white/10` for subtle glassmorphism borders
- `bg-gradient-to-b` / `bg-gradient-to-br` for depth
- `text-muted-foreground` for secondary text
- `shadow-zinc-950/5` for card shadows
- `backdrop-blur-sm` for glass effects
- Radial gradients via `[background:radial-gradient(...)]` arbitrary values
- SVG inline icons with `currentColor` for theme-aware coloring

## How the agent uses this

1. **Pick a pattern** — when asked to build a feature, skim this file for a component that matches the vibe.
2. **Adapt, don't copy-paste** — swap placeholder content, tweak colors, animate differently. The code is a starting point, not a library.
3. **Stay within the stack** — use shadcn/ui primitives (`Card`, `Button`, `Table`, etc.), Tailwind utilities, and lucide icons. Pull in framer-motion when motion matters.
4. **Respect dark mode** — every component should work with `dark:` variants.

## Adding to this file

Drop anything here — a screenshot of a landing page, a code snippet from a Dribbble redesign, an SVG you liked on Twitter. The `---` separator keeps sections distinct. No structure required.
