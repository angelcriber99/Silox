const { formatCurrency } = require('./lib/utils/formatters.ts') // wait, it's TS.
console.log(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(57.15))
console.log(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(57.15))
