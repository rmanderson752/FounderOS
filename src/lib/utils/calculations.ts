import { addMonths } from 'date-fns'

export type RunwayStatus = 'healthy' | 'caution' | 'critical'

export interface RunwayCalculation {
  months: number
  days: number
  endDate: Date
  status: RunwayStatus
}

/**
 * Calculate runway from cash balance and burn rate
 */
export function calculateRunway(
  cashBalance: number,
  monthlyBurn: number,
  monthlyRevenue: number = 0
): RunwayCalculation {
  const netBurn = monthlyBurn - monthlyRevenue
  
  // Prevent division by zero or negative burn (profitable!)
  if (netBurn <= 0) {
    return {
      months: Infinity,
      days: Infinity,
      endDate: new Date('2099-12-31'),
      status: 'healthy',
    }
  }

  const months = cashBalance / netBurn
  const days = Math.round(months * 30)
  const endDate = addMonths(new Date(), months)
  
  let status: RunwayStatus
  if (months > 6) {
    status = 'healthy'
  } else if (months > 3) {
    status = 'caution'
  } else {
    status = 'critical'
  }

  return { months, days, endDate, status }
}

/**
 * Calculate runway with a hypothetical scenario
 */
export function calculateScenario(
  currentCash: number,
  currentBurn: number,
  currentRevenue: number = 0,
  options: {
    additionalCash?: number
    burnChange?: number // percentage change, e.g., -20 for 20% reduction
    revenueChange?: number // percentage change
  }
): RunwayCalculation {
  const cash = currentCash + (options.additionalCash || 0)
  const burn = currentBurn * (1 + (options.burnChange || 0) / 100)
  const revenue = currentRevenue * (1 + (options.revenueChange || 0) / 100)

  return calculateRunway(cash, burn, revenue)
}

/**
 * Calculate trend direction between two values
 */
export function calculateTrend(
  current: number,
  previous: number
): { direction: 'up' | 'down' | 'flat'; change: number; percentage: number } {
  if (previous === 0) {
    return {
      direction: current > 0 ? 'up' : current < 0 ? 'down' : 'flat',
      change: current,
      percentage: 0,
    }
  }

  const change = current - previous
  const percentage = (change / Math.abs(previous)) * 100

  let direction: 'up' | 'down' | 'flat'
  if (Math.abs(percentage) < 0.1) {
    direction = 'flat'
  } else {
    direction = change > 0 ? 'up' : 'down'
  }

  return { direction, change, percentage: Math.abs(percentage) }
}
