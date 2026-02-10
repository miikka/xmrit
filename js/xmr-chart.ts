import dayjs from "dayjs";
import { init as initEChart } from "echarts";
import type { EChartsType } from "echarts";

import {
  DataValue,
  DataStatus,
  Stats,
  LineValueType,
  round,
  fromDateStr,
  numberStringSpaced,
  computeXmrStats,
} from "./xmr-math";

/**
 * Style constants
 */

const MEAN_SHAPE_COLOR = "red";
const LIMIT_SHAPE_COLOR = "steelblue";
const LIMIT_LINE_WIDTH = 2;

/**
 * Color functions
 */

function dataStatusColor(d: DataStatus): string {
  switch (d) {
    case DataStatus.RUN_OF_EIGHT_EXCEPTION:
      return "blue";
    case DataStatus.FOUR_NEAR_LIMIT_EXCEPTION:
      return "orange";
    case DataStatus.NPL_EXCEPTION:
      return "red";
    default:
      return "black";
  }
}

function dataLabelsStatusColor(d: DataStatus): string {
  switch (d) {
    case DataStatus.RUN_OF_EIGHT_EXCEPTION:
      return "blue";
    case DataStatus.FOUR_NEAR_LIMIT_EXCEPTION:
      return "#be5504";
    case DataStatus.NPL_EXCEPTION:
      return "#e3242b";
    default:
      return "black";
  }
}

/**
 * Chart config
 */

const ECHARTS_DATE_FORMAT = "{d} {MMM}";
const defaultValueFormatter = (n: number) => numberStringSpaced(round(n));

const chartBaseOptions = {
  backgroundColor: "rgba(255, 255, 255, 0.5)",
  xAxis: {
    type: "time",
    axisLabel: {
      formatter: ECHARTS_DATE_FORMAT,
      hideOverlap: true,
      color: "#000",
    },
    axisLine: {
      lineStyle: {
        color: "#000",
      },
      onZero: false,
    },
    position: "bottom",
    nameLocation: "center",
    nameGap: 25,
  },
  yAxis: {
    splitLine: {
      show: false,
    },
    axisLabel: {
      fontSize: 11,
      color: "#000",
      hideOverlap: true,
      formatter: defaultValueFormatter,
      padding: [0, 10, 0, 0],
    },
    splitNumber: 6,
    nameLocation: "middle",
    nameRotate: 90,
    nameGap: 45,
    nameTextStyle: {
      color: "#000",
    },
  },
  title: {
    left: "center",
  },
  tooltip: {
    show: true,
  },
};

/**
 * Series factories
 */

const mapDataValueToChartDataPoint =
  ({ showLabel }: { showLabel: boolean }) =>
  (dv: DataValue) => ({
    value: [fromDateStr(dv.x), dv.value],
    itemStyle: {
      color: dataStatusColor(dv.status),
    },
    label: {
      show: showLabel,
      color: dataLabelsStatusColor(dv.status),
      fontWeight: "bold",
      formatter: (params: any) => {
        return defaultValueFormatter(params.data.value[1]);
      },
    },
    tooltip: {
      formatter: `${dayjs(dv.x).format("ddd, D MMM YYYY")}:<br/> ${dv.value}`,
    },
  });

const mapDataValuesToChartSeries = (subD: DataValue[], i: number) => ({
  name: `${i}-data`,
  z: 100,
  type: "line",
  symbol: "circle",
  symbolSize: 7,
  lineStyle: {
    color: "#000",
  },
  labelLayout: {
    hideOverlap: true,
  },
  data: subD.map(mapDataValueToChartDataPoint({ showLabel: true })),
});

/**
 * Limit line rendering
 */

function renderLimitLines(
  xplot: EChartsType,
  mrplot: EChartsType,
  stats: Stats
): void {
  let xSeries: any[] = [];
  let mrSeries: any[] = [];

  for (let i = 0; i < stats.lineValues.length; i++) {
    const isLastSegment = i === stats.lineValues.length - 1;
    const lv = stats.lineValues[i];
    const strokeWidth = LIMIT_LINE_WIDTH;
    const lineType = "dashed";

    const createHorizontalLimitLineSeries = ({
      name,
      lineStyle,
      statisticY,
      showLabel = false,
    }: {
      name: string;
      lineStyle: any;
      statisticY: number;
      showLabel?: boolean;
    }) => ({
      name: name,
      type: "line",
      markLine: {
        symbol: ["none", "none"],
        lineStyle,
        tooltip: {
          show: true,
          formatter: `${statisticY}`,
          textStyle: {
            fontWeight: "bold",
          },
        },
        label: {
          formatter: showLabel && `${round(statisticY)}`,
          fontSize: 11,
          color: "#000",
        },
        emphasis: {
          disabled: true,
        },
        data: [
          [
            {
              xAxis: lv.xLeft,
              yAxis: statisticY,
            },
            {
              xAxis: isLastSegment
                ? dayjs(lv.xRight).add(1, "day").valueOf()
                : lv.xRight,
              yAxis: statisticY,
            },
          ],
        ],
      },
    });

    mrSeries = mrSeries.concat([
      createHorizontalLimitLineSeries({
        name: `${i}-avgmovement`,
        lineStyle: {
          color: MEAN_SHAPE_COLOR,
          width: strokeWidth,
          type: lineType,
        },
        statisticY: lv.avgMovement ?? 0,
        showLabel: isLastSegment,
      }),
      createHorizontalLimitLineSeries({
        name: `${i}-URL`,
        lineStyle: {
          color: LIMIT_SHAPE_COLOR,
          width: strokeWidth,
          type: lineType,
        },
        statisticY: lv.URL ?? 0,
        showLabel: isLastSegment,
      }),
    ]);

    xSeries = xSeries.concat([
      createHorizontalLimitLineSeries({
        name: `${i}-low-Q`,
        lineStyle: {
          color: "gray",
          type: "dashed",
          dashOffset: 15,
          width: 1,
        },
        statisticY: lv.lowerQuartile ?? 0,
      }),
      createHorizontalLimitLineSeries({
        name: `${i}-upp-Q`,
        lineStyle: {
          color: "gray",
          type: "dashed",
          dashOffset: 15,
          width: 1,
        },
        statisticY: lv.upperQuartile ?? 0,
      }),
      createHorizontalLimitLineSeries({
        name: `${i}-avg`,
        lineStyle: {
          color: MEAN_SHAPE_COLOR,
          width: strokeWidth,
          type: lineType,
        },
        statisticY: lv.avgX ?? 0,
        showLabel: isLastSegment,
      }),
      createHorizontalLimitLineSeries({
        name: `${i}-unpl`,
        lineStyle: {
          color: LIMIT_SHAPE_COLOR,
          width: strokeWidth,
          type: lineType,
        },
        statisticY: lv.UNPL ?? 0,
        showLabel: isLastSegment,
      }),
      createHorizontalLimitLineSeries({
        name: `${i}-lnpl`,
        lineStyle: {
          color: LIMIT_SHAPE_COLOR,
          width: strokeWidth,
          type: lineType,
        },
        statisticY: lv.LNPL ?? 0,
        showLabel: isLastSegment,
      }),
    ]);
  }

  xplot.setOption({ series: xSeries });
  mrplot.setOption({ series: mrSeries });
}

/**
 * Axis scaling
 */

function getXChartYAxisMinMax(stats: Stats): [number, number] {
  let min = stats.xchartMin;
  let max = stats.xchartMax;
  if (min === max) {
    const value = min;
    if (value === 0) return [-0.5, 0.5];
    const padding = Math.abs(value * 0.5);
    return [value - padding, value + padding];
  }
  const range = max - min;
  const absMax = Math.max(Math.abs(min), Math.abs(max));
  const orderOfMagnitude = Math.floor(Math.log10(Math.max(range, absMax)));
  const scale = Math.pow(10, orderOfMagnitude);
  let padding;
  if (range / scale < 0.25) {
    padding = range * 0.5;
  } else if (range / scale < 1) {
    padding = range * 0.25;
  } else {
    padding = range * 0.1;
  }
  padding = Math.max(padding, scale / 100);
  let lowerBound = min - padding;
  let upperBound = max + padding;
  const roundingScale = scale / 100;
  lowerBound = Math.floor(lowerBound / roundingScale) * roundingScale;
  upperBound = Math.ceil(upperBound / roundingScale) * roundingScale;
  if (Math.abs(lowerBound) < scale / 1000) lowerBound = 0;
  if (Math.abs(upperBound) < scale / 1000) upperBound = 0;
  return [lowerBound, upperBound];
}

function adjustChartAxis(
  xplot: EChartsType,
  mrplot: EChartsType,
  stats: Stats
): void {
  const xMin = Math.min(
    ...stats.xdataPerRange.map((range) =>
      Math.min(...range.map((d) => dayjs(d.x).valueOf()))
    )
  );
  let xMax = Math.max(
    ...stats.movementsPerRange.map((range) =>
      Math.max(...range.map((d) => dayjs(d.x).valueOf()))
    ),
    ...stats.xdataPerRange.map((range) =>
      Math.max(...range.map((d) => dayjs(d.x).valueOf()))
    )
  );
  xMax = dayjs(xMax).add(2, "day").valueOf();

  const [xplotYMin, xplotYMax] = getXChartYAxisMinMax(stats);

  xplot.setOption({
    yAxis: { min: xplotYMin, max: xplotYMax },
    xAxis: { min: xMin, max: xMax },
  });
  mrplot.setOption({
    xAxis: { min: xMin, max: xMax },
    yAxis: { min: 0, max: stats.mrchartMax },
  });
}

/**
 * Public API
 */

export interface XmrChartOptions {
  data: Array<{ x: string; value: number }>;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

export interface XmrChartInstance {
  update(opts: XmrChartOptions): void;
  destroy(): void;
}

export function createXmrChart(
  container: HTMLElement,
  options: XmrChartOptions
): XmrChartInstance {
  // Create wrapper flex container for side-by-side layout
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "row";
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  wrapper.style.overflow = "hidden";

  // Create child divs for X and MR charts
  const xDiv = document.createElement("div");
  xDiv.style.flex = "1 1 0";
  xDiv.style.minWidth = "0";
  xDiv.style.height = "100%";
  const mrDiv = document.createElement("div");
  mrDiv.style.flex = "1 1 0";
  mrDiv.style.minWidth = "0";
  mrDiv.style.height = "100%";

  wrapper.appendChild(xDiv);
  wrapper.appendChild(mrDiv);
  container.appendChild(wrapper);

  // Initialize ECharts instances
  const xplot = initEChart(xDiv);
  const mrplot = initEChart(mrDiv);

  // Set up ResizeObserver for responsiveness
  const createResizeObserverFor = (plot: EChartsType, el: HTMLElement) =>
    new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        plot.resize({
          width,
          height,
          silent: true,
          animation: { duration: 500 },
        });
      }
    });

  const xObserver = createResizeObserverFor(xplot, xDiv);
  xObserver.observe(xDiv);
  const mrObserver = createResizeObserverFor(mrplot, mrDiv);
  mrObserver.observe(mrDiv);

  function render(opts: XmrChartOptions): void {
    // Convert user data to DataValue[]
    const dataValues: DataValue[] = opts.data.map((d, i) => ({
      order: i,
      x: d.x,
      value: d.value,
      status: DataStatus.NORMAL,
    }));

    // Compute stats
    const stats = computeXmrStats(dataValues);

    if (stats.xdataPerRange.length === 0) {
      return;
    }

    // Initialize base chart options
    xplot.setOption({ ...chartBaseOptions }, true);
    mrplot.setOption({ ...chartBaseOptions }, true);

    // Set titles and labels
    const xLabel = opts.xLabel || "Date";
    const yLabel = opts.yLabel || "Value";
    const title = opts.title || "";

    xplot.setOption({
      title: {
        text: title ? `X Plot: ${title}` : "X Plot",
      },
      xAxis: { name: xLabel },
      yAxis: { name: yLabel },
    });
    mrplot.setOption({
      title: {
        text: title ? `MR Plot: ${title}` : "MR Plot",
      },
      xAxis: { name: xLabel },
      yAxis: { name: yLabel },
    });

    // Render data series
    const xSeries = stats.xdataPerRange.map(mapDataValuesToChartSeries);
    xplot.setOption({ series: xSeries });
    mrplot.setOption({
      series: stats.movementsPerRange.map(mapDataValuesToChartSeries),
    });

    // Render limit lines and adjust axes
    renderLimitLines(xplot, mrplot, stats);
    adjustChartAxis(xplot, mrplot, stats);
  }

  // Initial render
  render(options);

  return {
    update(opts: XmrChartOptions): void {
      render(opts);
    },
    destroy(): void {
      xObserver.disconnect();
      mrObserver.disconnect();
      xplot.dispose();
      mrplot.dispose();
      container.removeChild(wrapper);
    },
  };
}
