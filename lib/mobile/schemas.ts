import { z } from 'zod'

export const IdSchema = z.string().uuid()

export const AssetInputSchema = z.object({
  ticker: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  isin: z.string().trim().max(32).nullish(),
  name: z.string().trim().max(200).nullish(),
  type: z.string().trim().min(1).max(50),
  strategy: z.string().trim().min(1).max(50),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  sector: z.string().trim().max(100).optional(),
  geography: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(4000).nullish(),
})

const OperationSchema = z.enum([
  'Compra', 'Venta', 'Dividendo', 'Traspaso Salida', 'Traspaso Entrada', 'Retirada',
])

const CANONICAL_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/

function canonicalizeLegacyNumber(value: number): string {
  const text = String(value)
  if (!/[eE]/.test(text)) return text

  const [mantissa, exponentText] = text.toLowerCase().split('e')
  const exponent = Number(exponentText)
  const negative = mantissa.startsWith('-')
  const unsigned = negative ? mantissa.slice(1) : mantissa
  const [integer, fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`
  const decimalIndex = integer.length + exponent
  const expanded = decimalIndex <= 0
    ? `0.${'0'.repeat(-decimalIndex)}${digits}`
    : decimalIndex >= digits.length
      ? `${digits}${'0'.repeat(decimalIndex - digits.length)}`
      : `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
  return negative ? `-${expanded}` : expanded
}

/**
 * New clients send canonical decimal strings so JSON never rounds financial data.
 * Finite JSON numbers remain accepted for one compatibility version.
 */
const CanonicalDecimalStringSchema = z.string().max(100).regex(CANONICAL_DECIMAL, 'Decimal no canónico')

export const DecimalInputSchema = z.union([
  CanonicalDecimalStringSchema,
  z.number().finite().nonnegative().transform(canonicalizeLegacyNumber).pipe(CanonicalDecimalStringSchema),
])

const PositiveDecimalInputSchema = DecimalInputSchema.refine(
  (value) => value !== '0',
  { message: 'El importe debe ser mayor que cero' },
)

export const TransactionInputSchema = z.object({
  assetId: IdSchema,
  operation: OperationSchema,
  quantity: DecimalInputSchema,
  unitPrice: DecimalInputSchema,
  commission: DecimalInputSchema.default('0'),
  sourceWithholding: DecimalInputSchema.default('0'),
  destinationWithholding: DecimalInputSchema.default('0'),
  status: z.enum(['Completada', 'Pendiente']).default('Completada'),
  date: z.string().date(),
  notes: z.string().trim().max(4000).nullish(),
  updateCash: z.boolean().default(false),
  cashImpact: z.object({
    operation: z.enum(['Compra', 'Venta']),
    amount: PositiveDecimalInputSchema,
  }).nullable().optional(),
})

export const TransactionPatchSchema = z.object({
  assetId: IdSchema.optional(),
  operation: OperationSchema.optional(),
  quantity: DecimalInputSchema.optional(),
  unitPrice: DecimalInputSchema.optional(),
  commission: DecimalInputSchema.optional(),
  sourceWithholding: DecimalInputSchema.optional(),
  destinationWithholding: DecimalInputSchema.optional(),
  status: z.enum(['Completada', 'Pendiente']).optional(),
  date: z.string().date().optional(),
  notes: z.string().trim().max(4000).nullish(),
  updateCash: z.boolean().optional(),
  cashImpact: z.object({
    operation: z.enum(['Compra', 'Venta']),
    amount: PositiveDecimalInputSchema,
  }).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'No hay cambios' })

export const TransferInputSchema = z.object({
  source: TransactionInputSchema.omit({ cashImpact: true, updateCash: true }).extend({
    operation: z.literal('Traspaso Salida'),
  }),
  destination: TransactionInputSchema.omit({ cashImpact: true, updateCash: true }).extend({
    operation: z.literal('Traspaso Entrada'),
  }),
}).refine((value) => value.source.assetId !== value.destination.assetId, {
  message: 'Los activos de origen y destino deben ser diferentes',
})

const PositiveIntegerQuery = z.coerce.number().int().positive()

export const TransactionListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: PositiveIntegerQuery.max(100).optional(),
  page: PositiveIntegerQuery.optional(),
  pageSize: PositiveIntegerQuery.max(100).optional(),
  query: z.string().trim().min(1).max(100)
    .regex(/^[\p{L}\p{N}\s._-]+$/u, 'Consulta inválida')
    .optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  operation: OperationSchema.optional(),
  assetId: IdSchema.optional(),
}).refine(
  (value) => !((value.cursor !== undefined || value.limit !== undefined)
    && (value.page !== undefined || value.pageSize !== undefined)),
  { message: 'No se puede mezclar paginación cursor y page/pageSize' },
).transform((value) => value.cursor !== undefined || value.limit !== undefined
  ? { ...value, mode: 'cursor' as const, limit: value.limit ?? 50 }
  : { ...value, mode: 'offset' as const, page: value.page ?? 1, pageSize: value.pageSize ?? 50 })

export type TransactionListQuery = z.infer<typeof TransactionListQuerySchema>

export const AlertInputSchema = z.object({
  ticker: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  targetPrice: PositiveDecimalInputSchema,
  condition: z.enum(['above', 'below']),
})

export const AlertPatchSchema = AlertInputSchema.partial().extend({
  triggered: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'No hay cambios' })

export const EventInputSchema = z.object({
  assetId: IdSchema,
  title: z.string().trim().min(1).max(200),
  dayOfMonth: z.number().int().min(1).max(31),
  type: z.string().trim().min(1).max(80),
})

export const SettingsInputSchema = z.object({
  pushNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  dividendAlerts: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'No hay cambios' })
