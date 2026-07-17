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

export const TransactionInputSchema = z.object({
  assetId: IdSchema,
  operation: OperationSchema,
  quantity: z.number().finite().nonnegative(),
  unitPrice: z.number().finite().nonnegative(),
  commission: z.number().finite().nonnegative().default(0),
  sourceWithholding: z.number().finite().nonnegative().default(0),
  destinationWithholding: z.number().finite().nonnegative().default(0),
  status: z.enum(['Completada', 'Pendiente']).default('Completada'),
  date: z.string().date(),
  notes: z.string().trim().max(4000).nullish(),
  cashImpact: z.object({
    operation: z.enum(['Compra', 'Venta']),
    amount: z.number().finite().positive(),
  }).nullable().optional(),
})

export const TransferInputSchema = z.object({
  source: TransactionInputSchema.omit({ cashImpact: true }).extend({
    operation: z.literal('Traspaso Salida'),
  }),
  destination: TransactionInputSchema.omit({ cashImpact: true }).extend({
    operation: z.literal('Traspaso Entrada'),
  }),
}).refine((value) => value.source.assetId !== value.destination.assetId, {
  message: 'Los activos de origen y destino deben ser diferentes',
})

export const AlertInputSchema = z.object({
  ticker: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  targetPrice: z.number().finite().positive(),
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
