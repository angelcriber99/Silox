"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Monitor, Moon, Sun, LayoutList, LogOut, User, Sparkles, Volume2, Flower2, Palette, Check } from "lucide-react"
import { usePreferences, AccentColor } from "@/lib/stores/use-preferences"
import { createClient } from "@/lib/supabase/client"
import confetti from "canvas-confetti"

export default function PerfilPage() {
  const { theme, setTheme } = useTheme()
  const { 
    hideBalances, compactView, accentColor, celebrationMode, zenMode, amoled,
    setHideBalances, setCompactView, setAccentColor, setCelebrationMode, setZenMode
  } = usePreferences()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setEmail(data.user.email ?? null)
      }
    }
    fetchUser()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Perfil y Ajustes</h1>
        <p className="text-muted-foreground mt-2">Gestiona tus preferencias de la aplicación y tu cuenta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance Settings */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Apariencia
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Personaliza el tema visual de Silox.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === "light"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50"
                }`}
              >
                <Sun className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Claro</span>
              </button>
              
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === "dark"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50"
                }`}
              >
                <Moon className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Oscuro</span>
              </button>

              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === "system"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50"
                }`}
              >
                <Monitor className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Sistema</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* App Preferences */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-primary" />
              Preferencias
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Configuraciones recomendadas para tu panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Toggle Balances */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Ocultar saldos</p>
                <p className="text-sm text-muted-foreground">
                  Oculta las cantidades totales para mayor privacidad.
                </p>
              </div>
              <button
                onClick={() => setHideBalances(!hideBalances)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  hideBalances ? "bg-primary" : "bg-muted"
                }`}
              >
                <span className="sr-only">Ocultar saldos</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hideBalances ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Toggle Compact View */}
            <div className="hidden sm:flex items-center justify-between pt-4 border-t border-border/50">
              <div>
                <p className="font-medium text-foreground">Vista compacta (Solo escritorio)</p>
                <p className="text-sm text-muted-foreground">
                  Reduce el tamaño de las tablas e iconos en pantallas grandes.
                </p>
              </div>
              <button
                onClick={() => setCompactView(!compactView)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  compactView ? "bg-primary" : "bg-muted"
                }`}
              >
                <span className="sr-only">Vista compacta</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    compactView ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

          </CardContent>
        </Card>

        {/* Customization & Interactivity */}
        <Card className="bg-card border-border shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Interactividad y Estilo
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Ajustes premium para personalizar tu experiencia en Silox.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            {/* Accent Color */}
            <div>
              <p className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                Color de Acento
              </p>
              <div className="flex flex-wrap gap-3">
                {(['blue', 'emerald', 'violet', 'rose', 'amber'] as AccentColor[]).map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setAccentColor(color)
                    }}
                    className={`relative w-12 h-12 rounded-full transition-transform hover:scale-110 flex items-center justify-center
                      ${color === 'blue' ? 'bg-blue-500' : ''}
                      ${color === 'emerald' ? 'bg-emerald-500' : ''}
                      ${color === 'violet' ? 'bg-violet-500' : ''}
                      ${color === 'rose' ? 'bg-rose-500' : ''}
                      ${color === 'amber' ? 'bg-amber-500' : ''}
                      ${accentColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-primary shadow-lg shadow-primary/30 scale-110' : ''}
                    `}
                  >
                    {accentColor === color && <Check className="w-5 h-5 text-foreground" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Celebration Mode */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1 mr-4">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Celebrar días verdes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Confeti automático cuando el P&L supere +1%
                  </p>
                  <button 
                    onClick={() => {
                      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'], zIndex: 9999 })
                    }}
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    Probar ahora
                  </button>
                </div>
                <button
                  onClick={() => {
                    setCelebrationMode(!celebrationMode)
                  }}
                  className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors ${
                    celebrationMode ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    celebrationMode ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              {/* Zen Mode */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1 mr-4">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <Flower2 className="w-4 h-4 text-primary" />
                    Modo Zen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Oculta tablas y noticias para un panel relajante.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setZenMode(!zenMode)
                  }}
                  className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors ${
                    zenMode ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    zenMode ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>


            </div>

          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card className="bg-card border-border shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Sesión iniciada como</p>
              <p className="text-sm text-muted-foreground">
                {email ?? "Cargando..."}
              </p>
            </div>
            
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
