"use client"

import { useState, useEffect } from "react"
import { usePreferences, type Language } from "@/lib/stores/use-preferences"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { 
  Moon, Sun, Monitor, Palette, Eye, EyeOff, Bell, 
  Volume2, Shield, Download, CreditCard, Link as LinkIcon, 
  Smartphone, Mail, Fingerprint, Lock, Zap, Server, ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

type Tab = 'appearance' | 'display' | 'security' | 'notifications' | 'data' | 'integrations' | 'subscription'

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('appearance')
  const { theme, setTheme } = useTheme()
  const t = useTranslations('Settings')
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const { 
    language, setLanguage,
    amoled, setAmoled,
    zenMode, setZenMode,
    soundEffects, setSoundEffects,
    defaultView, setDefaultView,
    accentColor, setAccentColor,
    biometrics, setBiometrics,
    twoFactor, setTwoFactor,
    tableDensity, setTableDensity,
    showPnlPercentOnly, setShowPnlPercentOnly,
    hideBalances, setHideBalances
  } = usePreferences()

  const [toggles, setToggles] = useState({
    pushNotifs: true,
    emailNotifs: true,
    weeklyReport: false,
  })

  if (!mounted) return null

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }



  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }))
    toast.success("Preferencia actualizada")
  }

  const handleMockAction = (msg: string) => {
    toast.success(msg)
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`
    toast.success("Idioma actualizado / Language updated")
    // Use window.location.reload() instead of router.refresh() to ensure the root layout locale updates instantly
    window.location.reload()
  }

  const tabs: { id: Tab, label: string, icon: any }[] = [
    { id: 'appearance', label: t('tab_appearance'), icon: Palette },
    { id: 'display', label: t('tab_display'), icon: Eye },
    { id: 'security', label: t('tab_security'), icon: Shield },
    { id: 'notifications', label: t('tab_notifications'), icon: Bell },
    { id: 'data', label: t('tab_data'), icon: Download },
    { id: 'integrations', label: t('tab_integrations'), icon: LinkIcon },
    { id: 'subscription', label: t('tab_subscription'), icon: CreditCard },
  ]

  return (
    <div className="max-w-6xl w-full mx-auto flex flex-col md:flex-row gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)] py-6 md:py-8 px-4 md:px-6 mb-10 md:mb-0">
      {/* Settings Sidebar */}
      <aside className="w-full md:w-64 shrink-0 flex flex-col">
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1 md:mb-2">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar snap-x w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap snap-start flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </div>
              {activeTab === tab.id && <ChevronRight className="w-4 h-4 hidden md:block" />}
            </button>
          ))}
        </nav>

        <div className="hidden md:block pt-8 mt-8 border-t border-border/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-500 hover:bg-rose-500/10 transition-all font-medium"
          >
            <Shield className="w-4 h-4" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Settings Content */}
      <main className="flex-1 max-w-full overflow-x-hidden bg-card/30 backdrop-blur-xl border border-border/50 rounded-3xl p-5 md:p-8 md:overflow-y-auto hide-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* APARIENCIA */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-semibold mb-1">{t('title')}</h2>
                  <p className="text-sm text-muted-foreground mb-6">Personaliza los colores y el tema de la aplicación.</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">{t('language')}</label>
                  <div className="flex flex-wrap bg-muted/50 p-1 rounded-xl gap-1 max-w-md">
                    {(['es', 'en', 'fr', 'de'] as Language[]).map(lang => (
                      <button 
                        key={lang}
                        onClick={() => handleLanguageChange(lang)} 
                        className={`flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-all ${language === lang ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {t(`language_${lang}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">{t('theme_title')}</label>
                  <div className="flex bg-muted/50 p-1 rounded-xl gap-1 max-w-md" suppressHydrationWarning>
                    <button onClick={() => setTheme('light')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Sun className="w-4 h-4" /> {t('theme_light')}
                    </button>
                    <button onClick={() => setTheme('dark')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Moon className="w-4 h-4" /> {t('theme_dark')}
                    </button>
                    <button onClick={() => setTheme('system')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Monitor className="w-4 h-4" /> {t('theme_system')}
                    </button>
                  </div>
                </div>

                {theme === 'dark' && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div>
                      <h3 className="text-sm font-medium flex items-center gap-2">{t('amoled_title')} <Zap className="w-3 h-3 text-yellow-400" /></h3>
                      <p className="text-xs text-muted-foreground mt-1">{t('amoled_desc')}</p>
                    </div>
                    <button onClick={() => setAmoled(!amoled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${amoled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${amoled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium mb-3 block">{t('accent_title')}</label>
                  <div className="flex gap-4">
                    {(['blue', 'emerald', 'violet', 'rose', 'amber'] as const).map((color) => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          accentColor === color ? 'border-foreground scale-110 shadow-lg' : 'border-transparent hover:scale-105 opacity-80'
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
            )}

            {/* VISUALIZACIÓN */}
            {activeTab === 'display' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-semibold mb-1">{t('tab_display')}</h2>
                  <p className="text-sm text-muted-foreground mb-6"></p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      {t('privacy_title')} {hideBalances ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{t('privacy_desc')}</p>
                  </div>
                  <button onClick={() => setHideBalances(!hideBalances)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hideBalances ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hideBalances ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>



                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      {t('sound_title')} <Volume2 className="w-4 h-4 text-muted-foreground" />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{t('sound_desc')}</p>
                  </div>
                  <button onClick={() => setSoundEffects(!soundEffects)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEffects ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEffects ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>


                <div>
                  <label className="text-sm font-medium mb-3 block">Densidad de las Tablas</label>
                  <div className="flex bg-muted/50 p-1 rounded-xl gap-1 max-w-md">
                    <button onClick={() => setTableDensity('relaxed')} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${tableDensity === 'relaxed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      Relajada
                    </button>
                    <button onClick={() => setTableDensity('compact')} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${tableDensity === 'compact' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      Compacta
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      Rentabilidad
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Mostrar P&L solo en porcentaje en las tablas.</p>
                  </div>
                  <button onClick={() => setShowPnlPercentOnly(!showPnlPercentOnly)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showPnlPercentOnly ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showPnlPercentOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* SEGURIDAD */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Seguridad y Privacidad</h2>
                  <p className="text-sm text-muted-foreground mb-6">Protege el acceso a tu patrimonio.</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex gap-4 items-center">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><Smartphone className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium">Autenticación de Dos Factores (2FA)</h3>
                      <p className="text-xs text-muted-foreground mt-1">Añade una capa extra de seguridad usando una app como Authy o Google Authenticator.</p>
                    </div>
                  </div>

                  <button onClick={() => {
                    setTwoFactor(!twoFactor)
                    toast.success("Preferencia de 2FA actualizada")
                  }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${twoFactor ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${twoFactor ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex gap-4 items-center">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Fingerprint className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium">Bloqueo Biométrico</h3>
                      <p className="text-xs text-muted-foreground mt-1">Requiere FaceID / TouchID para abrir la app móvil.</p>
                    </div>
                  </div>
                  <button onClick={() => {
                    setBiometrics(!biometrics)
                    toast.success("Preferencia actualizada")
                  }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${biometrics ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${biometrics ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <h3 className="text-sm font-medium mb-4">Sesiones Activas</h3>
                  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Windows PC - Chrome</p>
                        <p className="text-xs text-muted-foreground">Madrid, España • Activo ahora</p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md font-medium">Actual</span>
                  </div>
                  <div className="flex items-center justify-between py-2 mt-2">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">iPhone 14 Pro - Safari</p>
                        <p className="text-xs text-muted-foreground">Madrid, España • Hace 2 horas</p>
                      </div>
                    </div>
                    <button onClick={() => handleMockAction("Sesión revocada")} className="text-xs text-rose-500 hover:underline">Revocar</button>
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Notificaciones</h2>
                  <p className="text-sm text-muted-foreground mb-6">Decide cómo quieres mantenerte informado de tus inversiones.</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex gap-4 items-center">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg"><Bell className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium">Notificaciones Push</h3>
                      <p className="text-xs text-muted-foreground mt-1">Alertas de precios ejecutadas y movimientos automáticos.</p>
                    </div>
                  </div>
                  <button onClick={() => handleToggle('pushNotifs')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.pushNotifs ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggles.pushNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex gap-4 items-center">
                    <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg"><Mail className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium">Resumen Semanal</h3>
                      <p className="text-xs text-muted-foreground mt-1">Recibe un reporte de tu rentabilidad cada domingo en tu correo.</p>
                    </div>
                  </div>
                  <button onClick={() => handleToggle('weeklyReport')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.weeklyReport ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggles.weeklyReport ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* DATA */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Datos y Privacidad</h2>
                  <p className="text-sm text-muted-foreground mb-6">Tú tienes el control absoluto sobre tus datos financieros.</p>
                </div>

                <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg mt-1"><Download className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium">Exportar Transacciones</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">Descarga todo tu historial de operaciones en formato CSV compatible con Excel para tu declaración de la renta o análisis propio.</p>
                      <Button onClick={() => handleMockAction("Descargando informe CSV...")} variant="secondary" className="text-xs">Descargar CSV</Button>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg mt-1"><Server className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium text-amber-500">Recalcular Historial (Sincronización)</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">Si ves picos extraños en tu gráfica de rendimiento por haber introducido operaciones con fechas pasadas, usa esto para recalcular toda la historia usando tus transacciones reales.</p>
                      <Button onClick={async () => {
                        toast.loading("Recalculando historial...");
                        try {
                          await fetch('/api/backfill');
                          toast.dismiss();
                          toast.success("Historial sincronizado correctamente.");
                          setTimeout(() => window.location.reload(), 1500);
                        } catch (e) {
                          toast.dismiss();
                          toast.error("Error al sincronizar historial.");
                        }
                      }} variant="outline" className="text-xs border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">Sincronizar Historial</Button>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg mt-1"><Lock className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-medium text-rose-500">Zona de Peligro</h3>
                      <p className="text-xs text-rose-500/70 mt-1 mb-4">Una vez elimines tu cuenta, no hay vuelta atrás. Se borrará permanentemente todo tu historial.</p>
                      <Button onClick={() => handleMockAction("Acción bloqueada en demostración.")} variant="destructive" className="text-xs">Eliminar Cuenta Permanentemente</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* INTEGRACIONES */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Integraciones</h2>
                  <p className="text-sm text-muted-foreground mb-6">Conecta Silox Pro con tus bancos y brokers favoritos.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center text-center gap-3 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">PRO</div>
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center font-serif text-white font-bold text-xl">IB</div>
                    <div>
                      <h3 className="text-sm font-medium">Interactive Brokers</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4 line-clamp-2">Sincroniza tus operaciones de forma automática vía API.</p>
                    </div>
                    <Button variant="outline" className="w-full text-xs" onClick={() => handleMockAction("Configuración IBKR Próximamente")}>Conectar</Button>
                  </div>

                  <div className="p-5 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center text-center gap-3 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">PRO</div>
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white text-lg">DeGiro</div>
                    <div>
                      <h3 className="text-sm font-medium">DeGiro</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4 line-clamp-2">Importa tu PDF de transacciones directamente.</p>
                    </div>
                    <Button variant="outline" className="w-full text-xs" onClick={() => handleMockAction("Selector de archivo Próximamente")}>Importar PDF</Button>
                  </div>
                </div>

                <div className="mt-8 p-6 rounded-2xl border border-primary/20 bg-primary/5">
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-2"><Server className="w-4 h-4 text-primary" /> API para Desarrolladores</h3>
                  <p className="text-xs text-muted-foreground mb-4">Crea tus propios scripts o conecta herramientas de terceros utilizando nuestra API REST privada.</p>
                  <Button variant="default" onClick={() => handleMockAction("Generando Token...")} className="text-xs">Generar Token API</Button>
                </div>
              </div>
            )}

            {/* SUBSCRIPTION */}
            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Tu Plan</h2>
                  <p className="text-sm text-muted-foreground mb-6">Gestiona tu suscripción a Silox.</p>
                </div>

                <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Zap className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full mb-4">PLAN ACTUAL</span>
                    <h3 className="text-3xl font-bold mb-2">Silox <span className="text-primary">Pro</span></h3>
                    <p className="text-muted-foreground max-w-sm mb-6">Tienes acceso completo a sincronización automática, gráficos avanzados y modo AMOLED.</p>
                    <div className="flex items-center gap-4">
                      <Button onClick={() => handleMockAction("Portal de pagos en mantenimiento")}>Gestionar Facturación</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
