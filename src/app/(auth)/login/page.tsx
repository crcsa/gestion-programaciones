import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <span className="text-xl font-bold text-primary-foreground">+</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Programaciones CRCA</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cruz Roja Colombiana Seccional Antioquia</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
