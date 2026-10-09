// Tremor chart utilities, mapped onto this app's color tokens (DESIGN.md):
// "blue" is the primary token, so charts match the One Blue rule.

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  blue: { bg: "bg-primary", stroke: "stroke-primary", fill: "fill-primary", text: "text-primary" },
  emerald: { bg: "bg-success", stroke: "stroke-success", fill: "fill-success", text: "text-success" },
  amber: { bg: "bg-score-fair", stroke: "stroke-score-fair", fill: "fill-score-fair", text: "text-score-fair" },
  red: { bg: "bg-destructive", stroke: "stroke-destructive", fill: "fill-destructive", text: "text-destructive" },
  gray: { bg: "bg-muted-foreground", stroke: "stroke-muted-foreground", fill: "fill-muted-foreground", text: "text-muted-foreground" },
} as const satisfies Record<string, Record<ColorUtility, string>>

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(chartColors) as AvailableChartColorsKeys[]

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

export const getColorClassName = (color: AvailableChartColorsKeys, type: ColorUtility): string => {
  const fallbackColor = chartColors.gray
  return chartColors[color]?.[type] ?? fallbackColor[type]
}

export const getYAxisDomain = (autoMinValue: boolean, minValue: number | undefined, maxValue: number | undefined) => {
  const minDomain = autoMinValue ? "auto" : (minValue ?? 0)
  const maxDomain = maxValue ?? "auto"
  return [minDomain, maxDomain]
}
