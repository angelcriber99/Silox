"use server"

import { createClient } from '@/lib/supabase/server'
import { TransaccionSchema } from '@/lib/validations/schemas'
import type { Transaccion } from '@/lib/types'
import { fetchMarketPrices } from '@/lib/actions/market'

export async function insertTransaccionAction(formData: unknown): Promise<Transaccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = TransaccionSchema.parse(formData)

  // Verify asset ownership
  const { data: asset, error: assetError } = await supabase
    .from('activos')
    .select('id, moneda')
    .eq('id', validatedData.activo_id)
    .eq('user_id', user.id)
    .single()

  if (assetError || !asset) throw new Error('Activo no encontrado o no autorizado')

  let finalComision = validatedData.comision
  let comisionNote = ''
  
  let finalPrecio = validatedData.precio_unitario
  let precioNote = ''
  
  if (validatedData.precio_moneda && validatedData.precio_moneda !== asset.moneda && validatedData.precio_unitario > 0) {
    try {
      const marketData = await fetchMarketPrices([`EUR${asset.moneda}=X`, `${asset.moneda}EUR=X`], true)
      let fxRate = 1
      if (validatedData.precio_moneda === 'EUR') {
        fxRate = marketData.fxRates?.[asset.moneda] || 1
      } else if (asset.moneda === 'EUR') {
        fxRate = marketData.fxRates?.[validatedData.precio_moneda] ? (1 / marketData.fxRates[validatedData.precio_moneda]) : 1
      }
      
      finalPrecio = validatedData.precio_unitario * fxRate
      precioNote = ` (Precio orig: ${validatedData.precio_unitario.toFixed(2)} ${validatedData.precio_moneda})`
    } catch (e) {
      console.error("Failed to convert precio:", e)
    }
  }

  if (validatedData.comision_moneda && validatedData.comision_moneda !== asset.moneda && validatedData.comision > 0) {
    try {
      const marketData = await fetchMarketPrices([`EUR${asset.moneda}=X`, `${asset.moneda}EUR=X`], true)
      // We want to convert from comision_moneda to asset.moneda
      let fxRate = 1
      if (validatedData.comision_moneda === 'EUR') {
        fxRate = marketData.fxRates?.[asset.moneda] || 1
      } else if (asset.moneda === 'EUR') {
        fxRate = marketData.fxRates?.[validatedData.comision_moneda] ? (1 / marketData.fxRates[validatedData.comision_moneda]) : 1
      }
      
      finalComision = validatedData.comision * fxRate
      comisionNote = ` (Comisión orig: ${validatedData.comision.toFixed(2)} ${validatedData.comision_moneda})`
    } catch (e) {
      console.error("Failed to convert commission:", e)
      // fallback to un-converted if FX fails, though rare
    }
  }
  
  let finalRetencionOrigen = validatedData.retencion_origen || 0
  let finalRetencionDestino = validatedData.retencion_destino || 0
  
  const insertData = { 
    ...validatedData, 
    user_id: user.id, 
    comision: finalComision, 
    precio_unitario: finalPrecio,
    retencion_origen: finalRetencionOrigen,
    retencion_destino: finalRetencionDestino
  }
  delete (insertData as any).comision_moneda
  delete (insertData as any).precio_moneda
  
  const combinedNotes = [precioNote, comisionNote].filter(Boolean).join(' | ')
  if (combinedNotes) {
    insertData.notas = (insertData.notas ? insertData.notas + " " + combinedNotes : combinedNotes.trim())
  }

  const { data, error } = await supabase
    .from('transacciones')
    .insert([insertData as any])
    .select()
    .single()

  if (error) throw new Error(`Error registrando transacción: ${error.message}`)
  return data as any
}

export async function updateTransaccionAction(id: string, formData: unknown): Promise<Transaccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const validatedData = TransaccionSchema.partial().parse(formData)
  
  const updateData = { ...validatedData }

  if (validatedData.comision !== undefined && validatedData.comision_moneda) {
    // Verify asset ownership again to get moneda
    const { data: asset } = await supabase
      .from('activos')
      .select('moneda')
      .eq('id', validatedData.activo_id || id) // need asset id, wait we don't have it unless we query transaccion
      .single()

    // Actually, to get the asset currency we need the transaction's asset
    const { data: trx } = await supabase
      .from('transacciones')
      .select('activo:activos(moneda), notas')
      .eq('id', id)
      .single()

    const assetMoneda = (trx?.activo as any)?.[0]?.moneda || (trx?.activo as any)?.moneda || 'EUR'
    let comisionNote = ''
    
    if (validatedData.comision_moneda !== assetMoneda && validatedData.comision > 0) {
      try {
        const marketData = await fetchMarketPrices([`EUR${assetMoneda}=X`, `${assetMoneda}EUR=X`], true)
        let fxRate = 1
        if (validatedData.comision_moneda === 'EUR') {
          fxRate = marketData.fxRates?.[assetMoneda] || 1
        } else if (assetMoneda === 'EUR') {
          fxRate = marketData.fxRates?.[validatedData.comision_moneda] ? (1 / marketData.fxRates[validatedData.comision_moneda]) : 1
        }
        
        updateData.comision = validatedData.comision * fxRate
        comisionNote = ` (Comisión orig. modif: ${validatedData.comision.toFixed(2)} ${validatedData.comision_moneda})`
      } catch (e) {
        console.error("Failed to convert commission on update:", e)
      }
    }
    
    let precioNote = ''
    if (validatedData.precio_moneda && validatedData.precio_moneda !== assetMoneda && validatedData.precio_unitario !== undefined && validatedData.precio_unitario > 0) {
      try {
        const marketData = await fetchMarketPrices([`EUR${assetMoneda}=X`, `${assetMoneda}EUR=X`], true)
        let fxRate = 1
        if (validatedData.precio_moneda === 'EUR') {
          fxRate = marketData.fxRates?.[assetMoneda] || 1
        } else if (assetMoneda === 'EUR') {
          fxRate = marketData.fxRates?.[validatedData.precio_moneda] ? (1 / marketData.fxRates[validatedData.precio_moneda]) : 1
        }
        
        updateData.precio_unitario = validatedData.precio_unitario * fxRate
        precioNote = ` (Precio orig. modif: ${validatedData.precio_unitario.toFixed(2)} ${validatedData.precio_moneda})`
      } catch (e) {
        console.error("Failed to convert precio on update:", e)
      }
    }
    
    const combinedNotes = [precioNote, comisionNote].filter(Boolean).join(' | ')
    if (combinedNotes) {
      updateData.notas = (validatedData.notas || trx?.notas || '') + (trx?.notas ? " " : "") + combinedNotes
    }
  }

  delete (updateData as any).comision_moneda
  delete (updateData as any).precio_moneda

  const { data, error } = await supabase
    .from('transacciones')
    .update(updateData as any)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw new Error(`Error actualizando transacción: ${error.message}`)
  return data as any
}

export async function deleteTransaccionAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('transacciones')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Error eliminando transacción: ${error.message}`)
}
