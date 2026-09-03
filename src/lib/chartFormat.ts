/**
 * Y-axis tick formatter for the "Daily net cumulative P&L" chart.
 *
 * Percent ticks must NOT be rounded to whole numbers. When the account's
 * cumulative return sits inside a narrow band -- a single trading day, or a
 * flat stretch -- Chart.js expands the range by only +-5% of the value and
 * spaces the gridlines well under 1% apart (e.g. -2.20, -2.15, -2.10, ...).
 * Rounding each of those to an integer collapses the entire axis to one
 * repeated label ("-2%" at every gridline), which is the bug this fixes.
 *
 * Dollars stay at 0 decimals: dollar ranges span hundreds or more, so the
 * gridlines never collide.
 */
export function formatCumulativeAxisTick(value: number, unit: '$' | '%'): string {
  if (unit === '%') {
    // toFixed(2) absorbs Chart.js float noise (-2.1500000000000004);
    // parseFloat trims the trailing zeros so a whole value still reads "-2%".
    return `${parseFloat(value.toFixed(2))}%`
  }
  return `$${Number(value).toFixed(0)}`
}
