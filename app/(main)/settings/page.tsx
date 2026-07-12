"use client"

import { useState, useEffect } from "react"
import { usePreferences, type Language } from "@/lib/stores/use-preferences"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  Moon, Sun, Monitor, Palette, Eye, EyeOff, Bell,
  Volume2, Shield, Download, CreditCard, Link as LinkIcon,
  Smartphone, Fingerprint, Zap, ChevronRight, LogOut, Check, Settings,
  AlertTriangle, Loader2, Trash2
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { RevolutSync } from "@/components/transactions/revolut-sync"

type Tab = 'appearance' | 'security' | 'notifications' | 'integrations' | 'data'

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('appearance')
  const { theme, setTheme } = useTheme()
  const t = useTranslations('Settings')
  const router = useRouter()

  const { 
    language, setLanguage,
    amoled, setAmoled,
    zenMode, setZenMode,
    accentColor, setAccentColor,
    biometrics, setBiometrics,
    twoFactor, setTwoFactor,
    tableDensity, setTableDensity,
    showPnlPercentOnly, setShowPnlPercentOnly,
    hideBalances, setHideBalances,
    pushNotifs, setPushNotifs,
    emailNotifs, setEmailNotifs,
    priceAlerts, setPriceAlerts,
    weeklyReport, setWeeklyReport,
    dividendAlerts, setDividendAlerts
  } = usePreferences()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletePending, setDeletePending] = useState(false)


  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`
    toast.success("Idioma actualizado")
    window.location.reload()
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "BORRAR") {
      toast.error("Escribe BORRAR para confirmar")
      return
    }

    setDeletePending(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo borrar la cuenta')
      }

      toast.success("Cuenta borrada correctamente")
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = "/login"
    } catch (error: any) {
      toast.error(error.message || "No se pudo borrar la cuenta")
    } finally {
      setDeletePending(false)
    }
  }

  const tabs: { id: Tab, label: string, icon: any, color: string, accent: string }[] = [
    { id: 'appearance', label: 'Apariencia', icon: Palette, color: 'oklch(0.68 0.17 192)', accent: 'oklch(0.68 0.17 192 / 0.12)' },
    { id: 'security', label: 'Seguridad', icon: Shield, color: 'oklch(0.65 0.19 155)', accent: 'oklch(0.65 0.19 155 / 0.12)' },
    { id: 'notifications', label: 'Notificaciones', icon: Bell, color: 'oklch(0.62 0.20 20)', accent: 'oklch(0.62 0.20 20 / 0.12)' },
    { id: 'integrations', label: 'Integraciones', icon: LinkIcon, color: 'oklch(0.65 0.17 270)', accent: 'oklch(0.65 0.17 270 / 0.12)' },
    { id: 'data', label: 'Datos', icon: Download, color: 'oklch(0.72 0.15 55)', accent: 'oklch(0.72 0.15 55 / 0.12)' },
  ]

  const CustomSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <button
      onClick={onChange}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{
        background: checked
          ? "linear-gradient(135deg, oklch(0.68 0.17 192), oklch(0.65 0.19 155))"
          : "oklch(0.28 0.01 235)",
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  )

  const SettingRow = ({ icon: Icon, title, desc, action, iconColor }: any) => (
    <div
      className="flex items-center justify-between p-4 rounded-2xl mb-2.5 transition-colors group"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex gap-4 items-center">
        <div
          className="p-2.5 rounded-xl flex-shrink-0"
          style={{
            background: "oklch(0.68 0.17 192 / 0.10)",
            border: "1px solid oklch(0.68 0.17 192 / 0.18)",
            color: iconColor || "var(--primary)",
          }}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="pr-4">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</h3>
          <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )

  return (
    <div className="flex flex-col h-full w-full">
      {/* ── Mobile View (iOS Grouped List) ──────────────────────────────── */}
      <div className="md:hidden flex flex-col flex-1 pb-24 bg-background">
        <div className="px-5 pb-2 pt-6 sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/40">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            {t('title')}
          </h1>
        </div>
        
        <div className="flex flex-col gap-6 px-4 pt-6">
          {/* Apariencia */}
          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground ml-2 mb-2">Apariencia</h2>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/50">
              <div className="p-4 flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Palette className="w-5 h-5" /></div>
                  <span className="font-semibold text-[15px]">Tema</span>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-xl">
                  <button onClick={() => setTheme('light')} className={`px-3 py-1 text-sm font-semibold rounded-lg ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>Claro</button>
                  <button onClick={() => setTheme('dark')} className={`px-3 py-1 text-sm font-semibold rounded-lg ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>Oscuro</button>
                </div>
              </div>
                <div className="p-4 flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><EyeOff className="w-5 h-5" /></div>
                    <span className="font-semibold text-[15px]">Ocultar Saldos</span>
                  </div>
                  <CustomSwitch checked={hideBalances} onChange={() => setHideBalances(!hideBalances)} />
                </div>
                <div className="p-4 flex flex-col gap-3 bg-card border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><Palette className="w-5 h-5" /></div>
                    <span className="font-semibold text-[15px]">Color de Acento</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                    {(['blue', 'emerald', 'violet', 'rose', 'amber', 'indigo', 'teal', 'pink'] as const).map((color) => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        className={`flex-shrink-0 w-10 h-10 rounded-full border-[3px] transition-all flex items-center justify-center ${
                          accentColor === color ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105 opacity-80'
                        } ${
                          color === 'blue' ? 'bg-[#3b82f6]' :
                          color === 'emerald' ? 'bg-[#10b981]' :
                          color === 'violet' ? 'bg-[#8b5cf6]' :
                          color === 'rose' ? 'bg-[#f43f5e]' :
                          color === 'amber' ? 'bg-[#f59e0b]' :
                          color === 'indigo' ? 'bg-[#6366f1]' :
                          color === 'teal' ? 'bg-[#14b8a6]' :
                          'bg-[#ec4899]'
                        }`}
                      >
                        {accentColor === color && <Check className="w-4 h-4 text-white shadow-sm" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

          {/* Seguridad */}
          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground ml-2 mb-2">Seguridad</h2>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/50">
              <div className="p-4 flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><Shield className="w-5 h-5" /></div>
                  <span className="font-semibold text-[15px]">Autenticación 2FA</span>
                </div>
                <CustomSwitch checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
              </div>
            </div>
          </section>

          {/* Peligro */}
          <section>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl overflow-hidden">
              <button onClick={() => setDeleteDialogOpen(true)} className="w-full p-4 flex items-center justify-center gap-2 text-rose-500 font-bold active:bg-rose-500/20 transition-colors">
                <Trash2 className="w-5 h-5" /> Borrar Cuenta
              </button>
            </div>
          </section>

          {/* Logout */}
          <section className="mt-4">
            <button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-muted border border-border/50 font-bold text-foreground active:bg-muted/80 transition-colors">
              Cerrar Sesión
            </button>
          </section>
        </div>
      </div>

      {/* ── Desktop View ────────────────────────────────────────────── */}
      <div
        className="hidden md:flex max-w-6xl w-full mx-auto flex-col md:flex-row gap-6 md:gap-8 min-h-[calc(100vh-8rem)] pb-6 md:py-8 px-4 md:px-6 mb-20 md:mb-0 animate-fade-in"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
      
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className="w-full md:w-[240px] shrink-0 flex flex-col">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1.5">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "oklch(0.68 0.17 192 / 0.12)", border: "1px solid oklch(0.68 0.17 192 / 0.20)" }}
            >
              <Settings className="h-4.5 w-4.5" style={{ color: "var(--primary)" }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              {t('title')}
            </h1>
          </div>
          <p className="text-sm pl-12" style={{ color: "var(--muted-foreground)" }}>Preferencias personales</p>
        </div>
        
        <nav className="flex md:flex-col gap-1.5 overflow-x-auto pb-4 md:pb-0 hide-scrollbar snap-x w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="shrink-0 snap-start flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200"
              style={{
                background: activeTab === tab.id ? "var(--card)" : "transparent",
                border: activeTab === tab.id ? "1px solid var(--border)" : "1px solid transparent",
                boxShadow: activeTab === tab.id ? "0 1px 4px oklch(0 0 0 / 0.10)" : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-1.5 rounded-lg"
                  style={{
                    background: activeTab === tab.id ? tab.accent : "transparent",
                    color: activeTab === tab.id ? tab.color : "var(--muted-foreground)",
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                </div>
                <span
                  className="text-[13px] font-semibold whitespace-nowrap"
                  style={{ color: activeTab === tab.id ? "var(--foreground)" : "var(--muted-foreground)" }}
                >
                  {tab.label}
                </span>
              </div>
              {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 hidden md:block" style={{ color: "var(--muted-foreground)" }} />}
            </button>
          ))}
        </nav>

        <div className="hidden md:block pt-6 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "oklch(0.62 0.20 20 / 0.08)",
              border: "1px solid oklch(0.62 0.20 20 / 0.20)",
              color: "oklch(0.62 0.20 20)",
            }}
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-full overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {/* APARIENCIA Y VISUALIZACIÓN */}
            {activeTab === 'appearance' && (
              <div className="space-y-8 pb-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Apariencia y Visualización</h2>
                  <p className="text-muted-foreground">Personaliza la interfaz para adaptarla a tu estilo.</p>
                </div>

                <div className="space-y-6">
                  {/* Theme */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 ml-2">Tema de la aplicación</label>
                    <div className="grid grid-cols-3 gap-3 p-1.5 bg-muted/30 rounded-2xl border border-border/40">
                      {(['light', 'dark', 'system'] as const).map((mode) => (
                        <button 
                          key={mode}
                          onClick={() => setTheme(mode)} 
                          className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${theme === mode ? 'bg-background shadow-md text-foreground border border-border/50 scale-100' : 'text-muted-foreground hover:bg-background/50 hover:text-foreground scale-95'}`}
                        >
                          {mode === 'light' ? <Sun className="w-4 h-4" /> : mode === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />} 
                          <span className="hidden sm:inline capitalize">{mode === 'system' ? 'Automático' : mode === 'light' ? 'Claro' : 'Oscuro'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Specifics */}
                  {theme === 'dark' && (
                    <SettingRow 
                      icon={Zap} title="Modo AMOLED Puro" desc="Fondo totalmente negro para pantallas OLED."
                      iconColor="text-yellow-500"
                      action={<CustomSwitch checked={amoled} onChange={() => setAmoled(!amoled)} />} 
                    />
                  )}

                  {/* Accent Color */}
                  <div className="space-y-3 pt-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 ml-2">Color de Acento</label>
                    <div className="flex gap-4 p-4 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-sm overflow-x-auto hide-scrollbar">
                      {(['blue', 'emerald', 'violet', 'rose', 'amber', 'indigo', 'teal', 'pink'] as const).map((color) => (
                        <button
                          key={color}
                          onClick={() => setAccentColor(color)}
                          className={`flex-shrink-0 w-12 h-12 rounded-full border-[3px] transition-all flex items-center justify-center ${
                            accentColor === color ? 'border-foreground scale-110 shadow-lg' : 'border-transparent hover:scale-105 opacity-80'
                          } ${
                            color === 'blue' ? 'bg-[#3b82f6]' :
                            color === 'emerald' ? 'bg-[#10b981]' :
                            color === 'violet' ? 'bg-[#8b5cf6]' :
                            color === 'rose' ? 'bg-[#f43f5e]' :
                            color === 'amber' ? 'bg-[#f59e0b]' :
                            color === 'indigo' ? 'bg-[#6366f1]' :
                            color === 'teal' ? 'bg-[#14b8a6]' :
                            'bg-[#ec4899]'
                          }`}
                        >
                          {accentColor === color && <Check className="w-5 h-5 text-white shadow-sm" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3 pt-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 ml-2">Visualización</label>
                    
                    {/* Language Selector */}
                    <div className="flex items-center justify-between p-4 bg-card/40 hover:bg-card/60 backdrop-blur-md border border-border/40 transition-colors rounded-2xl mb-3">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-blue-500/10 text-blue-500`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">Idioma de la aplicación</h4>
                          <p className="text-xs text-muted-foreground mt-1">Selecciona tu idioma preferido.</p>
                        </div>
                      </div>
                      <select 
                        value={language} 
                        onChange={(e) => handleLanguageChange(e.target.value as Language)}
                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                      >
                        <option value="es">🇪🇸 Español</option>
                        <option value="en">🇬🇧 English</option>
                        <option value="fr">🇫🇷 Français</option>
                        <option value="de">🇩🇪 Deutsch</option>
                      </select>
                    </div>
                    
                    <SettingRow 
                      icon={hideBalances ? EyeOff : Eye} title="Ocultar Saldos" desc="Oculta tus números totales para mantener la privacidad."
                      iconColor="text-blue-500"
                      action={<CustomSwitch checked={hideBalances} onChange={() => setHideBalances(!hideBalances)} />} 
                    />
                    
                    <div className="flex items-center justify-between p-4 bg-card/40 hover:bg-card/60 backdrop-blur-md border border-border/40 transition-colors rounded-2xl mb-3">
                      <div className="pr-4">
                        <h3 className="text-[15px] font-semibold text-foreground/90">Densidad de las Tablas</h3>
                        <p className="text-[13px] text-muted-foreground/80 mt-0.5">Controla el espaciado en la vista de cartera.</p>
                      </div>
                      <div className="flex bg-muted/50 p-1 rounded-xl">
                        <button onClick={() => setTableDensity('relaxed')} className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${tableDensity === 'relaxed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Relajada</button>
                        <button onClick={() => setTableDensity('compact')} className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${tableDensity === 'compact' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Compacta</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SEGURIDAD */}
            {activeTab === 'security' && (
              <div className="space-y-8 pb-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Seguridad y Privacidad</h2>
                  <p className="text-muted-foreground">Asegura tu cuenta de accesos no autorizados.</p>
                </div>

                <div className="space-y-3">
                  <SettingRow 
                    icon={Smartphone} title="Autenticación 2FA" desc="Protege tu cuenta con un código temporal (Authenticator)."
                    iconColor="text-emerald-500"
                    action={<CustomSwitch checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />} 
                  />

                </div>

                <div className="pt-6">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 ml-2 mb-3 block">Sesiones Activas</label>
                  <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border/30">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-background/50 border border-border/50 text-foreground">
                          <Monitor className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground/90">Windows PC - Chrome</p>
                          <p className="text-xs text-muted-foreground/80 mt-0.5">Madrid, España • Activo ahora</p>
                        </div>
                      </div>
                      <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md">Actual</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/10">
                      <div className="flex items-center gap-4 opacity-70">
                        <div className="p-2.5 rounded-xl bg-background/50 border border-border/50 text-foreground">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground/90">iPhone 14 Pro - App iOS</p>
                          <p className="text-xs text-muted-foreground/80 mt-0.5">Madrid, España • Hace 2 días</p>
                        </div>
                      </div>
                      <button onClick={() => toast.success("Sesión revocada")} className="text-xs font-semibold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors">Revocar</button>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button className="w-full sm:w-auto px-5 py-3 rounded-xl bg-muted/40 hover:bg-muted border border-border/50 text-sm font-semibold transition-colors">
                    Cambiar Contraseña
                  </button>
                </div>
              </div>
            )}

            {/* NOTIFICACIONES */}
            {activeTab === 'notifications' && (
              <div className="space-y-8 pb-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Notificaciones</h2>
                  <p className="text-muted-foreground">Configura qué tipo de alertas quieres recibir.</p>
                </div>

                <div className="space-y-3">
                  <SettingRow 
                    icon={Bell} title="Notificaciones Push" desc="Recibe alertas directamente en tu dispositivo."
                    iconColor="text-rose-500"
                    action={<CustomSwitch checked={pushNotifs} onChange={() => { setPushNotifs(!pushNotifs); toast.success("Preferencia actualizada") }} />} 
                  />
                  <SettingRow 
                    icon={Zap} title="Alertas de Precio" desc="Avisos cuando un activo sube o baja drásticamente."
                    iconColor="text-amber-500"
                    action={<CustomSwitch checked={priceAlerts} onChange={() => { setPriceAlerts(!priceAlerts); toast.success("Preferencia actualizada") }} />} 
                  />
                  <SettingRow 
                    icon={Download} title="Cobro de Dividendos" desc="Notificar cuando se reciba un dividendo de una empresa."
                    iconColor="text-emerald-500"
                    action={<CustomSwitch checked={dividendAlerts} onChange={() => { setDividendAlerts(!dividendAlerts); toast.success("Preferencia actualizada") }} />} 
                  />
                  <SettingRow 
                    icon={LogOut} title="Resumen Semanal" desc="Email cada domingo con el estado de tu cartera."
                    iconColor="text-blue-500"
                    action={<CustomSwitch checked={weeklyReport} onChange={() => { setWeeklyReport(!weeklyReport); toast.success("Preferencia actualizada") }} />} 
                  />
                </div>
              </div>
            )}

            {/* INTEGRACIONES */}
            {activeTab === 'integrations' && (
              <div className="space-y-8 pb-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Integraciones de Brókers</h2>
                  <p className="text-muted-foreground">Sincroniza tus posiciones automáticamente.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* MyInvestor (Connected) */}
                  <div className="p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-emerald-500/30 relative overflow-hidden group shadow-sm">
                    <div className="absolute top-0 right-0 p-3">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sincronizado
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm border border-border/20">
                      <span className="text-xl font-bold text-slate-800">MYI</span>
                    </div>
                    <h3 className="text-lg font-bold">MyInvestor</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Sincronización diaria de fondos indexados y efectivo.</p>
                    <button className="w-full py-2.5 rounded-xl border border-border/50 bg-background/50 hover:bg-background text-sm font-semibold transition-colors text-muted-foreground">Configurar</button>
                  </div>

                  {/* Revolut */}
                  <div className="p-5 rounded-2xl bg-card/30 hover:bg-card/50 backdrop-blur-md border border-border/40 transition-colors shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mb-4 shadow-sm border border-zinc-700">
                      <span className="text-xl font-bold text-white">R</span>
                    </div>
                    <h3 className="text-lg font-bold">Revolut</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Importa tu extracto PDF para sincronizar operaciones.</p>
                    <RevolutSync className="w-full flex items-center justify-center py-2.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:shadow-md text-sm font-semibold transition-all">
                      Subir Extracto (CSV)
                    </RevolutSync>
                  </div>

                  {/* DeGiro */}
                  <div className="p-5 rounded-2xl bg-card/30 hover:bg-card/50 backdrop-blur-md border border-border/40 transition-colors shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-white">DE</span>
                    </div>
                    <h3 className="text-lg font-bold">DeGiro</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Sincroniza tus ETFs y acciones europeas.</p>
                    <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:shadow-md text-sm font-semibold transition-all">Conectar</button>
                  </div>
                </div>
              </div>
            )}

            {/* DATOS */}
            {activeTab === 'data' && (
              <div className="space-y-8 pb-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Datos y Privacidad</h2>
                  <p className="text-muted-foreground">Controla tu información personal e historial.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-5 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                      <h3 className="font-bold text-foreground">Exportar Historial</h3>
                      <p className="text-sm text-muted-foreground mt-1">Descarga todas tus transacciones en formato CSV.</p>
                    </div>
                    <button onClick={() => toast.success("Exportación iniciada")} className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted border border-border/50 rounded-xl text-sm font-semibold transition-colors">
                      <Download className="w-4 h-4" /> CSV Export
                    </button>
                  </div>
                </div>

                <div className="pt-8">
                  <label className="text-xs font-bold uppercase tracking-widest text-rose-500/70 ml-2 mb-3 block">Zona Peligrosa</label>
                  <div className="p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                      <h3 className="font-bold text-rose-500">Eliminar Cuenta</h3>
                      <p className="text-sm text-rose-500/70 mt-1 max-w-md">Esta acción es irreversible y borrará todos tus datos, transacciones y configuraciones.</p>
                    </div>
                    <button
                      onClick={() => setDeleteDialogOpen(true)}
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white shadow-sm hover:bg-rose-600 rounded-xl text-sm font-bold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Borrar Cuenta
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (deletePending) return
        setDeleteDialogOpen(open)
        if (!open) setDeleteConfirmation("")
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Borrar cuenta definitivamente</DialogTitle>
            <DialogDescription>
              Esta acción eliminará tu usuario y todos tus activos, transacciones, alertas, historial y configuración. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="delete-account-confirmation" className="text-sm font-medium text-foreground">
              Escribe BORRAR para confirmar
            </label>
            <input
              id="delete-account-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deletePending}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletePending}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deletePending || deleteConfirmation !== "BORRAR"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletePending && <Loader2 className="h-4 w-4 animate-spin" />}
              Borrar definitivamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
