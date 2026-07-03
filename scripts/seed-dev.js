const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpvdttnmeeltsyptafm.supabase.co';
// Usa la service role key desde .env.local para poder saltar RLS y crear un usuario admin
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("🚀 Iniciando Seeder para entorno DEV...");

  // 1. Crear el usuario de prueba
  console.log("👤 Creando usuario test@silox.dev...");
  let userId;
  
  const { data: existingUser, error: listError } = await supabase.auth.admin.listUsers();
  const testUser = existingUser?.users?.find(u => u.email === 'test@silox.dev');
  
  if (testUser) {
    console.log("✅ Usuario ya existe. ID:", testUser.id);
    userId = testUser.id;
    // Borrar datos anteriores para regenerar
    await supabase.from('transacciones').delete().eq('user_id', userId);
    await supabase.from('activos').delete().eq('user_id', userId);
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@silox.dev',
      password: 'test1234',
      email_confirm: true
    });
    
    if (authError) {
      console.error("❌ Error creando usuario:", authError);
      return;
    }
    userId = authData.user.id;
    console.log("✅ Usuario creado. ID:", userId);
  }

  // 2. Crear Activos
  console.log("📈 Creando 15 activos ficticios...");
  const mockActivos = [
    { ticker: 'AAPL', nombre: 'Apple Inc.', tipo: 'Acción' },
    { ticker: 'MSFT', nombre: 'Microsoft Corp.', tipo: 'Acción' },
    { ticker: 'GOOGL', nombre: 'Alphabet Inc.', tipo: 'Acción' },
    { ticker: 'AMZN', nombre: 'Amazon.com', tipo: 'Acción' },
    { ticker: 'TSLA', nombre: 'Tesla Inc.', tipo: 'Acción' },
    { ticker: 'BTC', nombre: 'Bitcoin Tracker', tipo: 'Acción' },
    { ticker: 'ETH', nombre: 'Ethereum Tracker', tipo: 'Acción' },
    { ticker: 'SOL', nombre: 'Solana Tracker', tipo: 'Acción' },
    { ticker: 'VOO', nombre: 'Vanguard S&P 500 ETF', tipo: 'Fondo Indexado' },
    { ticker: 'QQQ', nombre: 'Invesco QQQ Trust', tipo: 'Fondo Indexado' },
    { ticker: 'O', nombre: 'Realty Income Corp.', tipo: 'Acción' },
    { ticker: 'KO', nombre: 'Coca-Cola Co.', tipo: 'Acción' },
    { ticker: 'JNJ', nombre: 'Johnson & Johnson', tipo: 'Acción' },
    { ticker: 'NVDA', nombre: 'NVIDIA Corp.', tipo: 'Acción' },
    { ticker: 'META', nombre: 'Meta Platforms', tipo: 'Acción' },
  ].map(a => ({ ...a, user_id: userId }));

  const { data: insertedActivos, error: actError } = await supabase.from('activos').insert(mockActivos).select();
  if (actError) {
    console.error("❌ Error creando activos:", actError);
    return;
  }
  console.log("✅ 15 activos creados correctamente.");

  // 3. Crear Transacciones
  console.log("💸 Generando transacciones masivas (200 operaciones en 2 años)...");
  
  const transacciones = [];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  
  // Base prices per ticker
  const basePrices = {
    'AAPL': 150, 'MSFT': 300, 'GOOGL': 120, 'AMZN': 130, 'TSLA': 200,
    'BTC': 45000, 'ETH': 2500, 'SOL': 100, 'VOO': 400, 'QQQ': 350,
    'O': 50, 'KO': 60, 'JNJ': 150, 'NVDA': 400, 'META': 300
  };

  for (let i = 0; i < 200; i++) {
    const activo = insertedActivos[Math.floor(Math.random() * insertedActivos.length)];
    const tipo = Math.random() > 0.3 ? 'Compra' : 'Venta';
    const isCrypto = ['BTC', 'ETH', 'SOL'].includes(activo.ticker);
    
    // Random date within last 2 years
    const rDate = new Date(startDate.getTime() + Math.random() * (new Date().getTime() - startDate.getTime()));
    const formattedDate = rDate.toISOString().split('T')[0];
    
    const baseP = basePrices[activo.ticker];
    const variance = (Math.random() * 0.4) - 0.2; // +/- 20%
    let unitPrice = baseP * (1 + variance);
    unitPrice = parseFloat(unitPrice.toFixed(2));
    
    // Amount
    let qty = isCrypto ? (Math.random() * 2) : (Math.floor(Math.random() * 20) + 1);
    qty = parseFloat(qty.toFixed(isCrypto ? 8 : 4));

    transacciones.push({
      user_id: userId,
      activo_id: activo.id,
      tipo_operacion: tipo,
      cantidad: qty,
      precio_unitario: unitPrice,
      fecha: formattedDate,
      estado: 'Completada',
      comision: parseFloat((Math.random() * 5).toFixed(2))
    });
  }

  const { error: txError } = await supabase.from('transacciones').insert(transacciones);
  if (txError) {
    console.error("❌ Error creando transacciones:", txError);
    return;
  }
  
  console.log("✅ 200 transacciones generadas e insertadas.");
  console.log("🎉 Seeding finalizado con éxito.");
  console.log("👉 Ahora puedes iniciar sesión con: test@silox.dev / test1234");
}

seed();
