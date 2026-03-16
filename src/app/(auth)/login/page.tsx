import Image from 'next/image'
import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-24 w-64">
            <Image
              src="/logo-full.svg"
              alt="Cruz Roja Colombiana Seccional Antioquia"
              fill
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/logo-full-dark.svg"
              alt="Cruz Roja Colombiana Seccional Antioquia"
              fill
              className="hidden object-contain dark:block"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Programaciones CRCSA</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cruz Roja Colombiana Seccional Antioquia</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
