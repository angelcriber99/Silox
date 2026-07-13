import { z } from 'zod'

export const revolutImportTransactionSchema = z.object({
  ticker: z.string(),
  tipo_operacion: z.enum(['Compra', 'Venta']),
  cantidad: z.number(),
  precio_unitario: z.number(),
  fecha: z.string(),
})

export const revolutImportSuccessSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  newTransactions: z.number().int().nonnegative(),
  updatedTransactions: z.number().int().nonnegative(),
  ignoredDuplicates: z.number().int().nonnegative(),
  removedInternalMovements: z.number().int().nonnegative(),
  imported: z.array(revolutImportTransactionSchema),
  ignored: z.array(revolutImportTransactionSchema),
})

export const apiErrorSchema = z.object({
  error: z.string(),
})

export type RevolutImportTransaction = z.infer<typeof revolutImportTransactionSchema>
export type RevolutImportSuccess = z.infer<typeof revolutImportSuccessSchema>

