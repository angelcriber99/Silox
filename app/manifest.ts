import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Silox — Gestión Patrimonial',
    short_name: 'Silox',
    description: 'Plataforma profesional de tracking de inversiones. Monitoriza tu cartera de fondos, ETFs y acciones en tiempo real.',
    start_url: '/',
    display: 'standalone',
    background_color: '#18181b',
    theme_color: '#18181b',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
  }
}
