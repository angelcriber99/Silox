import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-primary">Silox</p>
          <h1 className="text-3xl font-bold tracking-tight">Política de privacidad</h1>
          <p className="text-sm text-muted-foreground">Última actualización: 22 de julio de 2026</p>
        </header>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Datos tratados</h2>
          <p className="leading-7 text-muted-foreground">Silox almacena el identificador y correo de la cuenta, los activos, movimientos, alertas, preferencias y demás datos financieros que introduces o importas. Se usan exclusivamente para autenticarte, calcular y mostrar tu cartera, sincronizar tus dispositivos y prestar las funciones solicitadas.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Proveedores y seguridad</h2>
          <p className="leading-7 text-muted-foreground">La autenticación y la base de datos se alojan en Supabase; la aplicación web y su API se ejecutan en Vercel. Los datos de mercado se consultan a proveedores externos usando símbolos de activos, sin enviarles tu identidad ni tu cartera. Silox no vende datos, no muestra publicidad y no realiza seguimiento entre aplicaciones.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Conservación y eliminación</h2>
          <p className="leading-7 text-muted-foreground">Los datos se conservan mientras mantengas la cuenta. Puedes eliminarla desde Ajustes; la eliminación borra la cuenta y sus datos asociados. Las copias de seguridad del proveedor pueden persistir durante su ciclo técnico de retención antes de desaparecer definitivamente.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Tus derechos y contacto</h2>
          <p className="leading-7 text-muted-foreground">Puedes acceder, corregir, exportar o eliminar tus datos desde la aplicación. Para consultas de privacidad o soporte, abre una solicitud en el canal oficial del proyecto.</p>
          <a className="font-medium text-primary underline underline-offset-4" href="https://github.com/angelcriber99/Silox/issues" rel="noreferrer">Contactar con soporte</a>
        </section>
        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <Link className="underline underline-offset-4" href="/terms">Términos de uso</Link>
        </footer>
      </article>
    </main>
  )
}
