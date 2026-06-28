import { z } from "zod";

export const ActivoSchema = z.object({
  ticker: z.string().min(1, "El ticker es obligatorio"),
  isin: z.string().optional(),
  nombre: z.string().optional(),
  tipo: z.string().min(1, "El tipo es obligatorio"),
  estrategia: z.string().min(1, "La estrategia es obligatoria"),
  moneda: z.string().min(1, "La moneda es obligatoria"),
  notas: z.string().optional(),
});

export const TransaccionSchema = z.object({
  activo_id: z.string().uuid("ID de activo inválido"),
  tipo_operacion: z.enum(["Compra", "Venta", "Dividendo"]),
  cantidad: z.number().nonnegative("La cantidad no puede ser negativa"),
  precio_unitario: z.number().nonnegative("El precio no puede ser negativo"),
  comision: z.number().nonnegative("La comisión no puede ser negativa").default(0),
  comision_moneda: z.string().optional(),
  precio_moneda: z.string().optional(),
  retencion_origen: z.number().nonnegative("La retención no puede ser negativa").optional(),
  retencion_origen_moneda: z.string().optional(),
  retencion_destino: z.number().nonnegative("La retención no puede ser negativa").optional(),
  retencion_destino_moneda: z.string().optional(),
  estado: z.enum(["Completada", "Pendiente"]).optional(),
  fecha: z.string().datetime({ message: "Fecha inválida" }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notas: z.string().optional(),
});

export const AlertaSchema = z.object({
  ticker: z.string().min(1, "El ticker es obligatorio"),
  target_price: z.number().positive("El precio objetivo debe ser mayor a 0"),
  condition: z.enum(["above", "below"]),
});

export const EventoRecurrenteSchema = z.object({
  activo_id: z.string().uuid("ID de activo inválido"),
  titulo: z.string().min(1, "El título es obligatorio"),
  dia_del_mes: z.number().int().min(1).max(31),
  tipo: z.string().min(1, "El tipo es obligatorio"),
});
