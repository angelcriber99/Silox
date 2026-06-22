import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos el Service Role Key si existe, sino caemos al ANON KEY.
// Lo ideal es crear un SUPABASE_SERVICE_ROLE_KEY en Vercel para saltarnos el RLS.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    // Protección básica del webhook (más permisiva por si iOS añade espacios)
    const authHeader = request.headers.get('authorization') || '';
    const secret = process.env.WEBHOOK_SECRET || 'silox-patreon-secret';
    
    if (!authHeader.includes(secret)) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        debug_recibido: authHeader 
      }, { status: 401 });
    }

    const body = await request.json();
    const { title = '', text = '' } = body;
    const fullText = `${title} ${text}`.trim();

    if (!fullText) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
    }

    let tipo = 'post';
    let ticker = null;
    let accion = null;
    let precio = null;

    // Lógica para procesar el Chat: $GRRR BUY ALERT @$16.95
    const chatMatch = fullText.match(/\$([A-Z]+)\s+(BUY|SELL)\s+ALERT\s*@\s*\$?([\d.]+)/i);
    
    // Lógica para procesar Posts normales: $DUOL, TWEET: $GRRR
    const postTickerMatch = fullText.match(/\$([A-Z]+)/);

    if (chatMatch) {
      tipo = 'chat';
      ticker = chatMatch[1].toUpperCase();
      accion = chatMatch[2].toUpperCase();
      precio = parseFloat(chatMatch[3]);
    } else if (postTickerMatch) {
      tipo = 'post';
      ticker = postTickerMatch[1].toUpperCase();
    }

    const { error } = await supabase.from('alertas').insert({
      tipo,
      ticker,
      accion,
      precio,
      texto_original: title ? `${title}\n${text}` : text
    });

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, tipo, ticker });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
