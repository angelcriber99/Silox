"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { ChartDataPoint } from "./performance-modal"

interface PortfolioHistoryChartProps {
  chartData: ChartDataPoint[]
  onHoverChange?: (point: ChartDataPoint | null) => void
  hideTooltipContent?: boolean
  hideYAxis?: boolean
}

export function PortfolioHistoryChart({ chartData, onHoverChange, hideTooltipContent, hideYAxis }: PortfolioHistoryChartProps) {
  const { hideBalances } = usePreferences()

  if (!chartData || chartData.length === 0) {
    return null
  }

  const values = chartData.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1000
  const domainPadding = Math.max(range * 0.1, maxVal * 0.05)

  // Determine overall performance to choose color
  const firstValue = chartData[0].value
  const lastValue = chartData[chartData.length - 1].value
  const isOverallPositive = lastValue >= firstValue
  const lineColor = isOverallPositive ? "#10b981" : "#f43f5e"

  const lastInvested = chartData[chartData.length - 1]?.totalInvested

  const firstDate = parseISO(chartData[0].timestamp)
  const lastDate = parseISO(chartData[chartData.length - 1].timestamp)
  const spanMs = lastDate.getTime() - firstDate.getTime()
  const isOneDay = spanMs <= 24 * 60 * 60 * 1000

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (hideTooltipContent) return null;

    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint
      const isPositive = data.totalPnl >= 0
      const dateObj = parseISO(label)
      const formattedDate = format(dateObj, "d MMM yyyy, HH:mm", { locale: es })
      
      return (
        <div className="bg-card/95 border border-border/60 p-4 rounded-xl shadow-2xl backdrop-blur-md min-w-[180px]">
          <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div className="mb-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Patrimonio</p>
            <p className="font-bold text-lg font-tabular text-foreground leading-none">
              {hideBalances ? "****" : formatCurrency(data.value)}
            </p>
          </div>
          <div className="mb-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Ganancia Total</p>
            <p className={`font-bold text-sm font-tabular leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.totalPnl)}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">PnL Instante</p>
            {data.isFirstPoint ? (
              <p className="font-bold text-sm font-tabular text-muted-foreground leading-none">—</p>
            ) : (
              <p className={`font-bold text-sm font-tabular leading-none ${data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hideBalances ? "****" : `${data.pnl >= 0 ? '+' : ''}${formatCurrency(data.pnl)}`}
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = (props: any) => {
    const { x, y, index } = props;
    const dataPoint = chartData[index];
    const firstPoint = chartData[0];
    
    // Mostrar de forma más espaciada si hay muchos puntos
    const step = Math.max(1, Math.floor(chartData.length / 12));
    if (index % step !== 0 && index !== chartData.length - 1) return null;

    // Para 1D, el neto diario es el acumulado desde el inicio del día (relativePnl)
    // Para 1W, 1M, 1Y, TODO, cada punto es un día, por lo que el neto diario es dataPoint.pnl
    const pnlValue = isOneDay ? (dataPoint.totalPnl - firstPoint.totalPnl) : dataPoint.pnl;
    
    // Safety check just in case
    if (pnlValue === undefined || isNaN(pnlValue)) return null;

    const isPositive = pnlValue >= 0;
    const pnlStr = hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(pnlValue)}`;
    
    return (
      <text 
        x={x} 
        y={y - 12} 
        fill={isPositive ? '#10b981' : '#f43f5e'} 
        fontSize={10} 
        textAnchor="middle" 
        fontWeight={700}
      >
        {pnlStr}
      </text>
    );
  }

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={chartData} 
          margin={{ top: 25, right: 20, left: 20, bottom: 25 }}
          onMouseMove={(e: any) => {
            if (e.activePayload && e.activePayload.length) {
              onHoverChange?.(e.activePayload[0].payload)
            }
          }}
          onMouseLeave={() => {
            onHoverChange?.(null)
          }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => {
              try {
                if (!date) return "";
                return format(parseISO(date), isOneDay ? "HH:mm" : "d MMM", { locale: es });
              } catch (e) {
                return "";
              }
            }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
            dy={12}
            minTickGap={30}
          />
          <YAxis 
            hide={hideYAxis !== false}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `€${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
            width={55}
            dx={-5}
            domain={[minVal - domainPadding, maxVal + domainPadding]} 
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: hideTooltipContent ? '0' : '4 4', strokeOpacity: 0.5 }} 
          />
          {/* Invested reference line */}
          {lastInvested && lastInvested > 0 && (
            <ReferenceLine 
              y={lastInvested} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="4 4" 
              strokeOpacity={0.3}
              strokeWidth={1}
            />
          )}
          <Area 
            type="linear" 
            dataKey="value" 
            stroke={lineColor} 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorValue)" 
            activeDot={{ r: 6, fill: lineColor, stroke: "hsl(var(--background))", strokeWidth: 3 }}
            dot={chartData.length <= 45 ? { r: 3, fill: "hsl(var(--background))", stroke: lineColor, strokeWidth: 2 } : false}
            label={renderCustomLabel}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}


