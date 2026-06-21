"use client"

import { useMemo } from "react"
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts"

interface SparklineProps {
  data: number[]
  color?: string
}

export function Sparkline({ data, color = "#3b82f6" }: SparklineProps) {
  const chartData = useMemo(() => data.map((val, i) => ({ index: i, value: val })), [data])

  if (!data || data.length < 2) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-700 text-[10px]">Sin datos</div>
  }

  // Calculate min and max to tighten the Y axis
  const min = Math.min(...data)
  const max = Math.max(...data)
  const padding = (max - min) * 0.1 || (min === 0 ? 0.1 : min * 0.05)

  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={[min - padding, max + padding]} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
