# ProposalForge

AI-powered proposal generation for agencies, fabrication companies, freelancers
and creative studios.

> **Status:** Phase 1 complete — routing and the responsive application shell are
> in place. Pages currently hold placeholder content only. No AI functionality
> has been implemented yet.

## Tech stack

- **React 19** with JavaScript and the modern JSX transform
- **Vite 8** for dev server and builds
- **React Router 8** in declarative mode
- **CSS Modules** for component styles, with global design tokens
- **Oxlint** for linting

## Getting started

```bash
npm install
npm run dev
```

The dev server prints the local URL (Vite picks the next free port if 5173 is
taken).

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the dev server with HMR      |
| `npm run build`   | Production build into `dist/`      |
| `npm run preview` | Serve the production build locally |
| `npm run lint`    | Run Oxlint                         |

## Project structure

```
src/
  components/
    Header/       Page title and account avatar
    Icon/         Local inline SVG icon set
    Layout/       Application shell: sidebar + header + content outlet
    Sidebar/      Wordmark and primary navigation
  pages/
    Dashboard/
    NewProposal/
    History/
    Settings/
  assets/         Static assets imported by components
  styles/         Shared stylesheets
  navigation.js   Single source of truth for nav items and page titles
  index.css       Design tokens, reset and base typography
  App.jsx         Route definitions
  main.jsx        Entry point, mounts BrowserRouter
```

## Routes

| Path        | Page             |
| ----------- | ---------------- |
| `/`         | Dashboard        |
| `/new`      | New Proposal     |
| `/history`  | Proposal History |
| `/settings` | Settings         |

Unknown paths redirect to the Dashboard.

## Styling conventions

All colors, spacing, radii, shadows and layout dimensions are defined once as
CSS custom properties in `src/index.css`. Components must consume those tokens
rather than hard-coding values, so the theme stays consistent and adjustable
from a single file.

Component styles live in a co-located CSS Module, for example
`components/Sidebar/Sidebar.module.css`. Class names are scoped by the bundler,
so there is no risk of collisions between components.

### Theme

Premium dark SaaS: matte black (`#111111`) base, layered dark gray panels, teal
(`#14b8a6`) accent, rounded corners and soft shadows.

## Responsive behaviour

| Viewport         | Navigation                        |
| ---------------- | --------------------------------- |
| Above 1024px     | Full 260px sidebar with labels    |
| 641px – 1024px   | Collapsed 72px icon rail          |
| 640px and below  | Bottom navigation bar             |

Breakpoints are handled entirely in CSS, with no JavaScript state involved.

## Deployment note

The app uses `BrowserRouter`, so real URLs like `/new` are served client-side.
A static host must be configured to fall back to `index.html` for unknown paths,
otherwise a hard refresh on a nested route will return a 404.
