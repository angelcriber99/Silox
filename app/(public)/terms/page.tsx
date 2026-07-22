import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-primary">Silox</p>
          <h1 className="text-3xl font-bold tracking-tight">Términos de uso</h1>
          <p className="text-sm text-muted-foreground">Última actualización: 22 de julio de 2026</p>
        </header>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Herramienta informativa</h2>
          <p className="leading-7 text-muted-foreground">Silox es una herramienta de seguimiento y análisis. No es un bróker, no ejecuta órdenes, no custodia dinero y no ofrece asesoramiento financiero, fiscal o jurídico. Las cotizaciones pueden ser indicativas, retrasadas o no estar disponibles.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Responsabilidad del usuario</h2>
          <p className="leading-7 text-muted-foreground">Debes verificar movimientos, precios, divisas y cálculos antes de tomar decisiones o presentar declaraciones. Eres responsable de mantener segura tu cuenta y de disponer de derechos sobre los datos que importas.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Disponibilidad</h2>
          <p className="leading-7 text-muted-foreground">Trabajamos para ofrecer un servicio preciso y estable, pero no garantizamos disponibilidad ininterrumpida ni la ausencia total de errores de proveedores externos.</p>
        </section>
        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <Link className="underline underline-offset-4" href="/privacy">Política de privacidad</Link>
        </footer>
      </article>
    </main>
  )
}
