# CLAUDE.md

## Project overview

XMRit is an XMR (Individuals and Moving Range) control chart tool. It has two parts:

1. **Main app** (`index.html` + `js/main3.ts`) &mdash; A full interactive web app with Handsontable data entry, ECharts visualization, share links, locked limits, dividers, seasonality, and trend lines. Built with Parcel.
2. **Standalone chart library** (`js/xmr-chart.ts` + `js/xmr-math.ts`) &mdash; A reusable library exposing `window.createXmrChart` for embedding XMR charts via a `<script>` tag. See `docs/xmr-chart-library.md` for the usage guide.

## Repository structure

```
js/main3.ts              Main app (~3,600 lines, monolithic)
js/xmr-math.ts           Pure XMR calculations (no DOM dependencies)
js/xmr-chart.ts          ECharts rendering + createXmrChart API
js/xmr-chart-entry.ts    Window global entry point for the library
js/lz77.js               LZ77 compression for share links (main app only)
index.html               Main app entry point
css/styles.css            Main app styles (Tailwind)
examples/                 Demo HTML for the standalone library
docs/                     Library usage guide
```

## Build commands

```sh
npm install              # Install dependencies
npm run start            # Dev server for the main app
npm run build            # Production build of the main app -> dist/
npm run build:lib        # Build the standalone chart library -> dist-lib/
```

## Key technical details

- **Bundler**: Parcel 2
- **Chart library**: ECharts 5
- **Date handling**: dayjs
- **CSS**: Tailwind 3
- **Table**: Handsontable 14 (main app only)
- **No test framework** is configured

## Architecture notes

- `js/main3.ts` is the monolithic main app file. It uses global `state` and direct DOM manipulation. Changes here affect the main app only.
- `js/xmr-math.ts` and `js/xmr-chart.ts` were extracted from `main3.ts` but are independent copies. They do not import from `main3.ts` and `main3.ts` does not import from them. Changes to the math/chart logic in one place do not automatically propagate to the other.
- The library (`xmr-math` + `xmr-chart`) intentionally supports only a single data segment (no dividers, locked limits, seasonality, or trend lines). This keeps the public API simple.
- XMR scaling constants: NPL uses 2.66, URL uses 3.268.
- Exception checks run in order: run-of-eight, then four-near-limit, then outside-limit. Higher-severity rules overwrite lower ones.

## Convention notes

- The `x` field on data values is a date string (parseable by dayjs), not a generic x-axis value.
- `DataStatus` enum values: 0 = normal, 1 = run of eight, 2 = four near limit, 3 = outside NPL.
- Values are rounded to 2 decimal places (`DECIMAL_POINT = 2`) throughout.
