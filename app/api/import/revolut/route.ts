import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const parsedTransactions = [];

    // Ignoramos la cabecera (línea 0)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 8) continue;
      
      const rawDate = cols[0];
      const ticker = cols[1];
      const type = cols[2];
      const quantity = parseFloat(cols[3]);
      const priceRaw = cols[4];
      
      // Solo nos interesan las operaciones de compra y venta
      if (!type.includes('BUY') && !type.includes('SELL')) continue;
      if (!ticker) continue;
      
      // Extraemos el número del precio (ej: "USD 17.22")
      const priceMatch = priceRaw.match(/[\d\.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
      
      const date = new Date(rawDate);
      
      parsedTransactions.push({
        user_id: user.id,
        ticker,
        tipo_operacion: type.includes('BUY') ? 'Compra' : 'Venta',
        cantidad: quantity,
        precio_unitario: price,
        fecha: date.toISOString().split('T')[0],
        comision: 0 // El CSV de Revolut no exporta esta columna
      });
    }

    if (parsedTransactions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No se encontraron operaciones de compra/venta en este PDF.',
        newTransactions: 0,
        ignoredDuplicates: 0
      })
    }

    let { data: activos } = await supabase.from('activos').select('id, ticker').eq('user_id', user.id);
    const { data: existingTransactions } = await supabase
      .from('transacciones')
      .select('activo_id, tipo_operacion, cantidad, precio_unitario, fecha')
      .eq('user_id', user.id);

    let newTxCount = 0;
    let ignoredCount = 0;
    const toInsert = [];
    const imported = [];
    const ignored = [];

    // Deduplicar: buscar en la BD si existe una transacción con el mismo activo, tipo, cantidad aproximada y fecha
    for (const tx of parsedTransactions) {
      let activo_id = null;
      let existingActivo = activos?.find(a => a.ticker === tx.ticker);
      
      if (existingActivo) {
        activo_id = existingActivo.id;
      } else {
        const { data: newActivo, error: createError } = await supabase
          .from('activos')
          .insert({ user_id: user.id, ticker: tx.ticker, nombre: tx.ticker, tipo: 'Acción' })
          .select()
          .single();
          
        if (!createError && newActivo) {
          activo_id = newActivo.id;
          if (!activos) activos = [];
          activos.push(newActivo);
        }
      }

      if (!activo_id) continue;

      const exists = existingTransactions?.some(existing => {
        const isSameActivo = existing.activo_id === activo_id;
        const isSameType = existing.tipo_operacion === tx.tipo_operacion;
        const isSameQty = Math.abs(existing.cantidad - tx.cantidad) < 0.0001;
        const isSamePrice = Math.abs(existing.precio_unitario - tx.precio_unitario) < 0.01;
        const isSameDate = existing.fecha === tx.fecha;
        return isSameActivo && isSameType && isSameQty && isSamePrice && isSameDate;
      });

      if (exists) {
        ignoredCount++;
        ignored.push(tx);
      } else {
        const { ticker, ...dbTx } = tx; // Quitar ticker para insertar en BD
        toInsert.push({ ...dbTx, activo_id, estado: 'Completada' });
        imported.push(tx);
        newTxCount++;
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('transacciones')
        .insert(toInsert);

      if (insertError) {
        return NextResponse.json({ error: 'Error al insertar transacciones en la base de datos' }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      newTransactions: newTxCount,
      ignoredDuplicates: ignoredCount,
      imported,
      ignored
    })

  } catch (error: any) {
    console.error('Revolut Import Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
