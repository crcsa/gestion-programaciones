import Image from 'next/image'

export function LoginHero() {
  return (
    <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
      />
      <div
        aria-hidden
        className="animate-mesh-float-1 absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#c8102e]/25 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-mesh-float-2 absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-rose-600/20 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-mesh-float-3 absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-red-500/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />

      <div className="relative z-10">
        <div className="relative inline-block">
          {/* Halo difuminado gris→blanco detrás del logo para legibilidad */}
          <div
            aria-hidden
            className="absolute inset-0 -m-12 rounded-[40%] bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.55)_0%,_rgba(226,232,240,0.25)_45%,_transparent_75%)] blur-md"
          />
          <div className="relative h-20 w-36">
            <Image
              src="/logo-full.svg"
              alt="Cruz Roja Colombiana Seccional Antioquia"
              fill
              priority
              className="object-contain object-center"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-md space-y-4 text-white">
        <h1 className="text-4xl font-bold tracking-tight">
          Gestión de Programaciones
        </h1>
        <p className="text-lg text-slate-300">
          Plataforma institucional para la coordinación de turnos, campañas y
          personal de la Cruz Roja Colombiana Seccional Antioquia.
        </p>
      </div>

      <div className="relative z-10 text-xs text-slate-500">
        © {new Date().getFullYear()} Cruz Roja Colombiana Seccional Antioquia
      </div>
    </div>
  )
}
