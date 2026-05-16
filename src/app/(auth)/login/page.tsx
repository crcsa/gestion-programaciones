import Image from 'next/image'
import { LoginHero } from '@/features/auth/components/login-hero'
import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <LoginHero />
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 w-full max-w-sm space-y-6 duration-500">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <div className="relative h-16 w-48">
              <Image
                src="/logo-full.svg"
                alt="Cruz Roja Colombiana Seccional Antioquia"
                fill
                priority
                className="object-contain dark:hidden"
              />
              <Image
                src="/logo-full-dark.svg"
                alt="Cruz Roja Colombiana Seccional Antioquia"
                fill
                priority
                className="hidden object-contain dark:block"
              />
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
