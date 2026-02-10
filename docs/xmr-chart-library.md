# XMR Chart Library

A standalone library for rendering XMR (Individuals and Moving Range) control charts. Built on [ECharts](https://echarts.apache.org/), it lets you embed one or more interactive XMR charts on any page with a single `<script>` tag.

## Quick start

Build the library:

```sh
npm install
npm run build:lib
```

This produces `dist-lib/xmr-chart-entry.js`.

Add it to an HTML page and call `createXmrChart`:

```html
<div id="chart" style="width: 100%; height: 600px;"></div>
<script src="path/to/dist-lib/xmr-chart-entry.js"></script>
<script>
  var chart = createXmrChart(document.getElementById("chart"), {
    data: [
      { x: "2024-01-01", value: 50 },
      { x: "2024-02-01", value: 47 },
      { x: "2024-03-01", value: 53 },
      // ...
    ],
    title: "Monthly throughput",
    xLabel: "Month",
    yLabel: "Items",
  });
</script>
```

A working example with two charts is in `examples/xmr-chart-demo.html`.

## API

### `createXmrChart(container, options)`

Creates a pair of X and MR charts inside the given container element.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `container` | `HTMLElement` | The DOM element to render into. Must have an explicit height (e.g. via CSS). |
| `options` | `XmrChartOptions` | Chart data and labels (see below). |

**Returns** an `XmrChartInstance` with methods `update()` and `destroy()`.

### `XmrChartOptions`

```ts
{
  data: Array<{ x: string; value: number }>;
  title?: string;   // displayed above the X Plot (default: none)
  xLabel?: string;  // x-axis label (default: "Date")
  yLabel?: string;  // y-axis label (default: "Value")
}
```

- `data[].x` is a date string parseable by [dayjs](https://day.js.org/) (e.g. `"2024-01-15"`, `"Jan 15, 2024"`).
- `data[].value` is the numeric measurement.
- Data does not need to be sorted; the library sorts it by date internally.

### `XmrChartInstance`

```ts
{
  update(options: XmrChartOptions): void;
  destroy(): void;
}
```

- **`update(options)`** &mdash; Re-renders both charts with new data and options. The container is reused; no DOM teardown occurs.
- **`destroy()`** &mdash; Disposes ECharts instances, disconnects resize observers, and removes the chart `<div>` elements from the container.

## What the charts show

The library computes standard XMR control chart statistics for a single data segment:

**X chart (top):**
- Data points connected by a line
- Average (X-bar) &mdash; red dashed line
- Upper Natural Process Limit (UNPL) &mdash; steelblue dashed line
- Lower Natural Process Limit (LNPL) &mdash; steelblue dashed line
- Upper and lower quartile lines &mdash; gray dashed lines

**MR chart (bottom):**
- Moving range values (absolute difference between consecutive points)
- Average moving range &mdash; red dashed line
- Upper Range Limit (URL) &mdash; steelblue dashed line

### Exception detection

Data points are automatically colour-coded when they trigger one of the three XMR exception rules:

| Colour | Rule | Meaning |
|---|---|---|
| Blue | Run of eight | 8+ consecutive points on the same side of the average |
| Orange | Four near limit | 3 out of 4 consecutive points in the outer quarter |
| Red | Outside limit | A point beyond UNPL or LNPL (X chart) or URL (MR chart) |

Higher-severity rules take precedence (a point that is both in a run-of-eight and outside a limit is coloured red).

## Multiple charts on one page

Each `createXmrChart` call is fully independent. You can render as many charts as you like:

```html
<div id="a" style="height: 500px;"></div>
<div id="b" style="height: 500px;"></div>
<script src="dist-lib/xmr-chart-entry.js"></script>
<script>
  createXmrChart(document.getElementById("a"), { data: datasetA });
  createXmrChart(document.getElementById("b"), { data: datasetB });
</script>
```

## Responsiveness

Charts automatically resize when their container changes size (via `ResizeObserver`). No manual resize handling is needed.

## Architecture

The library is split into two internal modules:

- **`js/xmr-math.ts`** &mdash; Pure calculation logic (no DOM, no ECharts). Exports types, constants, math functions, exception checks, and `computeXmrStats()`. Can be imported directly if you only need the numbers.
- **`js/xmr-chart.ts`** &mdash; ECharts rendering layer. Imports `xmr-math`, creates chart instances, and exports `createXmrChart`.
- **`js/xmr-chart-entry.ts`** &mdash; Thin entry point that assigns `createXmrChart` to `window`.

The existing main application (`js/main3.ts`) is completely untouched and unaffected.

## Build scripts

| Script | Command | Output |
|---|---|---|
| `npm run build:lib` | `parcel build js/xmr-chart-entry.ts --dist-dir dist-lib --no-source-maps` | `dist-lib/xmr-chart-entry.js` |
| `npm run build` | Existing app build | `dist/` |
| `npm run start` | Existing app dev server | `dist/` |
