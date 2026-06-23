"use client"

import { usePreferences } from "@/lib/stores/use-preferences"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, Palette, Eye, EyeOff, Bell, Volume2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { 
    amoled, setAmoled,
    zenMode, setZenMode,
    soundEffects, setSoundEffects,
    defaultView, setDefaultView,
    accentColor, setAccentColor
  } = usePreferences()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Ajustes</h1>
        <p className="text-muted-foreground">Personaliza tu experiencia y configura tus preferencias de la app.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Apariencia */}
        <section className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Palette className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold">Apariencia</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-3 block">Tema</label>
              <div className="flex bg-muted/50 p-1 rounded-xl gap-1">
                <button 
                  onClick={() => setTheme('light')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Sun className="w-4 h-4" /> Claro
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Moon className="w-4 h-4" /> Oscuro
                </button>
                <button 
                  onClick={() => setTheme('system')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Monitor className="w-4 h-4" /> Sistema
                </button>
              </div>
            </div>

            {theme === 'dark' && (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Modo AMOLED</h3>
                  <p className="text-xs text-muted-foreground">Negros puros para ahorrar batería en pantallas OLED.</p>
                </div>
                <button 
                  onClick={() => setAmoled(!amoled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${amoled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${amoled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-3 block">Color de Acento</label>
              <div className="flex gap-3">
                {(['blue', 'emerald', 'violet', 'rose', 'amber'] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => setAccentColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      accentColor === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                    } ${
                      color === 'blue' ? 'bg-[#3b82f6]' :
                      color === 'emerald' ? 'bg-[#10b981]' :
                      color === 'violet' ? 'bg-[#8b5cf6]' :
                      color === 'rose' ? 'bg-[#f43f5e]' :
                      'bg-[#f59e0b]'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Visualización */}
        <section className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Eye className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold">Visualización</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  Modo Zen {zenMode ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </h3>
                <p className="text-xs text-muted-foreground">Oculta los balances para mayor privacidad en público.</p>
              </div>
              <button 
                onClick={() => setZenMode(!zenMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${zenMode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${zenMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Vista por defecto (Dashboard)</label>
              <div className="flex bg-muted/50 p-1 rounded-xl gap-1">
                <button 
                  onClick={() => setDefaultView('historical')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${defaultView === 'historical' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Histórico (Desde compra)
                </button>
                <button 
                  onClick={() => setDefaultView('daily')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${defaultView === 'daily' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Diario (Hoy)
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  Efectos de Sonido <Volume2 className="w-4 h-4 text-muted-foreground" />
                </h3>
                <p className="text-xs text-muted-foreground">Sonidos sutiles al realizar ciertas acciones.</p>
              </div>
              <button 
                onClick={() => setSoundEffects(!soundEffects)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEffects ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEffects ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </section>
        
        {/* Cuenta y Seguridad */}
        <section className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-rose-500">Cuenta</h2>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Cerrar Sesión</h3>
              <p className="text-xs text-muted-foreground">Desconecta tu cuenta de forma segura en este dispositivo.</p>
            </div>
            <Button variant="destructive" onClick={handleLogout}>
              Desconectar
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
