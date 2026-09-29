export const shipmentStatuses = [
  'Выезжает со склада',
  'Направляется к границе',
  'Проходит проверку',
  'На таможне',
  'В пути',
  'Прибыл в страну',
  'Готов к выдаче',
] as const

export type ShippingMethod = 'air' | 'bus'

export interface Shipment {
  code: string
  customerNickname: string
  weightKg: number
  paidAmount: number
  shippingMethod: ShippingMethod
  deliveryDays: number
  statusIndex: number
  statusStartedAt: number
  createdAt: number
  isPaused: boolean
  pausedAt?: number
  pausedMs: number
  isStopped: boolean
  stoppedAt?: number
  surcharge?: { amount: number; message: string }
  statusHistory: { statusIndex: number; at: number }[]
}

export interface AdminReview {
  id: string
  author: string
  rating: number
  text: string
  createdAt: number
  isPublished: boolean
}

// Keep the status timeline derived from elapsed time for static hosting.
export function getCurrentStatusIndex(shipment: Shipment, now = Date.now()) {
  const activeUntil = Math.min(
    shipment.isPaused && shipment.pausedAt ? shipment.pausedAt : now,
    shipment.isStopped && shipment.stoppedAt ? shipment.stoppedAt : now,
  )
  const elapsed = Math.max(0, activeUntil - shipment.statusStartedAt - shipment.pausedMs)
  const stageDuration = Math.max(1, (shipment.deliveryDays * 86_400_000) / (shipmentStatuses.length - 1))
  return Math.min(shipmentStatuses.length - 1, shipment.statusIndex + Math.floor(elapsed / stageDuration))
}

export function getDeliveryDays(method: ShippingMethod) {
  const [minimum, maximum] = method === 'air' ? [5, 12] : [10, 18]
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum
}