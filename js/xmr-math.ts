import dayjs from "dayjs";

/**
 * Types
 */

export type DataValue = {
  order: number;
  x: string; // Date in YYYY-MM-DD format
  value: number;
  status: DataStatus;
};

export enum DataStatus {
  NORMAL = 0,
  RUN_OF_EIGHT_EXCEPTION = 1,
  FOUR_NEAR_LIMIT_EXCEPTION = 2,
  NPL_EXCEPTION = 3,
}

export type LineValueType = {
  xLeft: number; // date in unix milliseconds
  xRight: number; // date in unix milliseconds
  avgX: number;
  avgMovement?: number;
  UNPL?: number; // upper natural process limit
  LNPL?: number; // lower natural process limit
  URL?: number; // upper range limit
  lowerQuartile?: number;
  upperQuartile?: number;
};

export type Stats = {
  xchartMin: number;
  xchartMax: number;
  mrchartMax: number;
  lineValues: LineValueType[];
  xdataPerRange: DataValue[][];
  movementsPerRange: DataValue[][];
};

/**
 * Constants
 */

export const NPL_SCALING = 2.66;
export const URL_SCALING = 3.268;
export const DECIMAL_POINT = 2;

const USE_MEDIAN_AVG = false;
const USE_MEDIAN_MR = false;
const MEDIAN_NPL_SCALING = 3.145;
const MEDIAN_URL_SCALING = 3.865;

/**
 * Utility functions
 */

export function round(n: number, decimal_point: number = DECIMAL_POINT): number {
  let pow = 10 ** decimal_point;
  return Math.round(n * pow) / pow;
}

export function fromDateStr(ds: string): number {
  return dayjs(ds).valueOf();
}

export function numberStringSpaced(num: number): string {
  let [integerPart, decimalPart] = num.toString().split(".");
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (decimalPart) {
    decimalPart = decimalPart.replace(/(\d{3})(?=\d)/g, "$1 ");
    return `${integerPart}.${decimalPart}`;
  }
  return integerPart;
}

export function deepClone(src: DataValue[]): DataValue[] {
  return src.map((el) => {
    return { x: el.x, value: el.value, order: el.order, status: el.status };
  });
}

export function sortDataValues(dv: DataValue[]): DataValue[] {
  return dv.sort((a, b) => fromDateStr(a.x) - fromDateStr(b.x));
}

export function removeAllNulls(dv: DataValue[]): DataValue[] {
  return dv.filter((d) => d.x && (d.value || d.value == 0));
}

export function findExtremesX(arr: DataValue[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  arr.forEach((el) => {
    let d = fromDateStr(el.x);
    min = Math.min(min, d);
    max = Math.max(max, d);
  });
  return { min, max };
}

/**
 * Returns an array of movements given an array of data values
 */
export function getMovements(xdata: DataValue[]): DataValue[] {
  const movements: DataValue[] = [];
  for (let i = 1; i < xdata.length; i++) {
    const diff = round(Math.abs(xdata[i].value - xdata[i - 1].value));
    movements.push({ order: xdata[i].order, x: xdata[i].x, value: diff, status: DataStatus.NORMAL });
  }
  return movements;
}

export function calculateMedian(arr: number[]): number {
  arr.sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return 0;
  if (n % 2 !== 0) {
    const middleIndex = Math.floor(n / 2);
    return arr[middleIndex];
  } else {
    const middleIndex1 = n / 2 - 1;
    const middleIndex2 = n / 2;
    return (arr[middleIndex1] + arr[middleIndex2]) / 2;
  }
}

export function calculateLimits(xdata: DataValue[]): Partial<LineValueType> {
  const movements = getMovements(xdata);
  const avgX = USE_MEDIAN_AVG
    ? calculateMedian(xdata.map((x) => x.value))
    : xdata.reduce((a, b) => a + b.value, 0) / xdata.length;
  const avgMovement = USE_MEDIAN_MR
    ? calculateMedian(movements.map((x) => x.value))
    : movements.reduce((a, b) => a + b.value, 0) /
      Math.max(movements.length, 1);
  const delta =
    (USE_MEDIAN_MR ? MEDIAN_NPL_SCALING : NPL_SCALING) * avgMovement;
  const UNPL = avgX + delta;
  const LNPL = avgX - delta;
  const URL =
    (USE_MEDIAN_MR ? MEDIAN_URL_SCALING : URL_SCALING) * avgMovement;
  const lowerQuartile = (LNPL + avgX) / 2;
  const upperQuartile = (UNPL + avgX) / 2;
  return {
    avgX: round(avgX),
    avgMovement: round(avgMovement),
    UNPL: round(UNPL),
    LNPL: round(LNPL),
    URL: round(URL),
    lowerQuartile: round(lowerQuartile),
    upperQuartile: round(upperQuartile),
  };
}

/**
 * Exception detection checks
 */

export function checkRunOfEight(data: DataValue[], avg: number): void {
  if (data.length < 8) {
    return;
  }
  let aboveOrBelow = 0;
  for (let i = 0; i < 7; i++) {
    if (data[i].value > avg) {
      aboveOrBelow |= 1 << i % 8;
    }
  }
  for (let i = 7; i < data.length; i++) {
    if (data[i].value > avg) {
      aboveOrBelow |= 1 << i % 8;
    } else {
      aboveOrBelow &= ~(1 << i % 8);
    }
    if (aboveOrBelow == 0 || aboveOrBelow == 255) {
      for (let j = i - 7; j <= i; j++) {
        data[j].status = DataStatus.RUN_OF_EIGHT_EXCEPTION;
      }
    }
  }
}

export function checkFourNearLimit(
  data: DataValue[],
  lowerQuartile: number,
  upperQuartile: number
): void {
  if (data.length < 4) {
    return;
  }
  let belowQuartile = 0;
  let aboveQuartile = 0;
  for (let i = 0; i < 3; i++) {
    if (data[i].value < lowerQuartile) {
      belowQuartile += 1;
    } else if (data[i].value > upperQuartile) {
      aboveQuartile += 1;
    }
  }
  for (let i = 3; i < data.length; i++) {
    if (data[i].value < lowerQuartile) {
      belowQuartile += 1;
    } else if (data[i].value > upperQuartile) {
      aboveQuartile += 1;
    }
    if (belowQuartile >= 3 || aboveQuartile >= 3) {
      for (let j = i - 3; j <= i; j++) {
        data[j].status = DataStatus.FOUR_NEAR_LIMIT_EXCEPTION;
      }
    }
    if (data[i - 3].value < lowerQuartile) {
      belowQuartile -= 1;
    } else if (data[i - 3].value > upperQuartile) {
      aboveQuartile -= 1;
    }
  }
}

export function checkOutsideLimit(
  data: DataValue[],
  lowerLimit: number,
  upperLimit: number
): void {
  data.forEach((dv) => {
    if (dv.value < lowerLimit) {
      dv.status = DataStatus.NPL_EXCEPTION;
    } else if (dv.value > upperLimit) {
      dv.status = DataStatus.NPL_EXCEPTION;
    }
  });
}

/**
 * Simplified version of wrangleData() for a single segment.
 * No dividers, no locked limits, no seasonality, no trends.
 * Sorts data, calculates limits, runs exception checks, returns Stats.
 */
export function computeXmrStats(data: DataValue[]): Stats {
  const tableData = removeAllNulls(data);
  sortDataValues(tableData);

  const { min: xdataXmin, max: xdataXmax } = findExtremesX(tableData);

  const stats: Stats = {
    xchartMin: Infinity,
    xchartMax: -Infinity,
    mrchartMax: -Infinity,
    lineValues: [],
    xdataPerRange: [],
    movementsPerRange: [],
  };

  if (tableData.length === 0) {
    return stats;
  }

  const { avgX, avgMovement, UNPL, LNPL, URL, lowerQuartile, upperQuartile } =
    calculateLimits(tableData);

  const lv: LineValueType = {
    xLeft: xdataXmin,
    xRight: xdataXmax,
    avgX: avgX!,
    avgMovement,
    UNPL,
    LNPL,
    URL,
    lowerQuartile,
    upperQuartile,
  };
  stats.lineValues.push(lv);
  stats.xchartMin = Math.min(stats.xchartMin, LNPL!);
  stats.xchartMax = Math.max(stats.xchartMax, UNPL!);
  stats.mrchartMax = Math.max(stats.mrchartMax, URL!);

  // Check for process exceptions on X data
  tableData.forEach((dv) => (dv.status = DataStatus.NORMAL));
  checkRunOfEight(tableData, avgX!);
  checkFourNearLimit(tableData, lowerQuartile!, upperQuartile!);
  checkOutsideLimit(tableData, LNPL!, UNPL!);
  stats.xdataPerRange.push(tableData);

  // Check for movement exceptions
  const movements = getMovements(tableData);
  movements.forEach((dv) => (dv.status = DataStatus.NORMAL));
  checkOutsideLimit(movements, 0, URL!);
  stats.movementsPerRange.push(movements);

  // Update chart min/max to include data points outside limits
  removeAllNulls(tableData).forEach((dv) => {
    if (dv.value > stats.xchartMax) stats.xchartMax = dv.value;
    if (dv.value < stats.xchartMin) stats.xchartMin = dv.value;
  });
  movements.forEach((dv) => {
    if (dv.value > stats.mrchartMax) stats.mrchartMax = dv.value;
  });

  return stats;
}
