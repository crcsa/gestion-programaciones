import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  )
}
