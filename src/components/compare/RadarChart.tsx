'use client'

/**
 * RadarChart — renders a Chart.js radar chart.
 *
 * Shape is driven by raw values on a FIXED per-axis scale (spec §5 / §6).
 * Percentile is shown on hover as a second number — never drives the shape.
 *
 * Chart.js cannot read CSS variables, so we pass grid/label colours explicitly
 * and re-derive them on theme change (spec §9).
 */

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from 'chart.js'
import { useTheme } from '@/components/layout/ThemeProvider'
import { RADAR_CONFIGS } from '@/lib/radar-config'
import { toRadarScore, fmtVal, computePercentile } from '@/lib/stats'
import type { AggregatedStats, Player, PlayerSeasonStats } from '@/lib/types'

ChartJS.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip)

function themeGridColor(dark: boolean) {
  return dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.09)'
}
function themeLabelColor(dark: boolean) {
  return dark ? '#8b97a7' : '#5b6573'
}

interface Dataset {
  d: AggregatedStats
  player: Player
  borderColor: string
  bgColor: string
}

interface Props {
  datasets: Dataset[]
  /** Position group — determines which radar axes apply */
  positionGroup: string
  allStats: PlayerSeasonStats[]
  allPlayers: Player[]
  /** Domestic-league competition ids — percentile cohort */
  leagueCompIds: ReadonlySet<number>
  height?: number
}

export function RadarChart({
  datasets,
  positionGroup,
  allStats,
  allPlayers,
  leagueCompIds,
  height = 310,
}: Props) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJS | null>(null)

  const config = RADAR_CONFIGS[positionGroup]
  if (!config) return null

  const labels = config.axes.map((a) => a.name)

  function buildChartData(): ChartData<'radar'> {
    return {
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.player.name + ' ' + ds.d.season,
        data: config.axes.map((a) =>
          toRadarScore(ds.d[a.key] as number | null, a.max, a.invert),
        ),
        borderColor:           ds.borderColor,
        backgroundColor:       ds.bgColor,
        pointBackgroundColor:  ds.borderColor,
        borderWidth: 2,
        pointRadius: 2,
      })),
    }
  }

  function buildOptions(): ChartOptions<'radar'> {
    const grid  = themeGridColor(dark)
    const label = themeLabelColor(dark)

    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid:        { color: grid },
          angleLines:  { color: grid },
          pointLabels: { color: label, font: { size: 11 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const dsIdx = ctx.datasetIndex
              const axIdx = ctx.dataIndex
              const ds    = datasets[dsIdx]
              const axis  = config.axes[axIdx]
              const raw   = ds.d[axis.key] as number | null
              const pct   = computePercentile(
                raw, axis.key, ds.player.position_group, ds.d.season,
                allStats, allPlayers, leagueCompIds, axis.invert,
              )
              const rawStr = fmtVal(raw, axis.fmt)
              return pct != null
                ? ` ${rawStr}  ·  ${pct} pctl`
                : ` ${rawStr}`
            },
          },
        },
      },
      elements: {
        line:  { borderWidth: 2 },
        point: { radius: 2 },
      },
    }
  }

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    chartRef.current = new ChartJS(ctx, {
      type: 'radar',
      data: buildChartData(),
      options: buildOptions(),
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, positionGroup, JSON.stringify(datasets.map((d) => ({ id: d.d.player_id, season: d.d.season, comps: d.d.competition_ids })))])

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas ref={canvasRef} role="img" aria-label="Player radar chart" />
    </div>
  )
}
