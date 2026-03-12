import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gestion de Programaciones - Cruz Roja Colombiana',
  description:
    'Sistema de gestion de programaciones de personal para Cruz Roja Colombiana Seccional Antioquia',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
