'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, Link2, Link2Off, UserX, UserCheck, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { IconButton } from '@/components/ui/icon-button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateCredentialsModal } from './create-credentials-modal'
import { ResetPasswordModal } from './reset-password-modal'
import { LinkStaffModal } from './link-staff-modal'
import {
  unlinkUserFromStaff,
  deactivateUser,
  activateUser,
  deleteUser,
} from '../actions/user-actions'
import { ROLE_LABELS, VALID_ROLES, type Role } from '@/types/roles'
import { AREA_LABELS, type Area } from '@/types/areas'
import type { UserRow } from '../actions/user-actions'
import type { StaffMember } from '@/lib/db/schema/staff-members'

type RoleFilter = Role | 'todos'
type StatusFilter = 'todos' | 'activo' | 'inactivo'
type LinkFilter = 'todos' | 'vinculado' | 'sin_vincular'

interface UsersListClientProps {
  users: UserRow[]
  unlinkedStaff: StaffMember[]
  callerRole: Role
  callerArea: Area | null
}

export function UsersListClient({
  users,
  unlinkedStaff,
  callerRole,
  callerArea,
}: UsersListClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [credentialsTarget, setCredentialsTarget] = useState<StaffMember | null>(null)
  const [resetTarget, setResetTarget] = useState<{ profileId: string; email: string } | null>(null)
  const [linkTarget, setLinkTarget] = useState<{ profileId: string; email: string } | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('todos')
  const [staffSearch, setStaffSearch] = useState('')

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(({ profile, staffMember }) => {
      if (q) {
        const haystack = `${profile.fullName} ${profile.email} ${staffMember?.cedula ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (roleFilter !== 'todos' && profile.role !== roleFilter) return false
      if (statusFilter === 'activo' && !profile.isActive) return false
      if (statusFilter === 'inactivo' && profile.isActive) return false
      if (linkFilter === 'vinculado' && !staffMember) return false
      if (linkFilter === 'sin_vincular' && staffMember) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter, linkFilter])

  const filteredUnlinkedStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase()
    if (!q) return unlinkedStaff
    return unlinkedStaff.filter((s) =>
      `${s.firstName} ${s.lastName} ${s.cedula} ${s.email ?? ''}`.toLowerCase().includes(q),
    )
  }, [unlinkedStaff, staffSearch])

  const hasActiveUserFilters =
    search.trim() !== '' ||
    roleFilter !== 'todos' ||
    statusFilter !== 'todos' ||
    linkFilter !== 'todos'

  function clearUserFilters() {
    setSearch('')
    setRoleFilter('todos')
    setStatusFilter('todos')
    setLinkFilter('todos')
  }

  async function handleUnlink(staffMemberId: string) {
    if (!confirm('¿Desvincular este colaborador del usuario? El login seguirá funcionando pero perderá visibilidad de sus turnos.')) return
    setBusyId(staffMemberId)
    setError(null)
    try {
      await unlinkUserFromStaff({ staffMemberId })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desvincular')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(profileId: string, email: string) {
    if (
      !confirm(
        `¿Eliminar permanentemente la cuenta ${email}? Esta acción no se puede deshacer. El personal vinculado (si lo hay) se preservará y quedará sin acceso.`,
      )
    ) {
      return
    }
    setBusyId(profileId)
    setError(null)
    try {
      await deleteUser({ profileId })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el usuario')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(profileId: string, isActive: boolean) {
    const verb = isActive ? 'desactivar' : 'activar'
    if (!confirm(`¿Seguro que quieres ${verb} este usuario?`)) return
    setBusyId(profileId)
    setError(null)
    try {
      if (isActive) await deactivateUser({ profileId })
      else await activateUser({ profileId })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${verb}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona credenciales de acceso y vinculación con personal.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/usuarios/nuevo" />} className="gap-2">
          <UserPlus className="size-4" />
          Crear usuario
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">Con acceso</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mostrando {filteredUsers.length} de {users.length}{' '}
                {users.length === 1 ? 'usuario' : 'usuarios'}.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-48">
              <Label htmlFor="user-search" className="mb-1.5 text-xs">
                Buscar
              </Label>
              <Input
                id="user-search"
                placeholder="Nombre, correo o cédula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="user-role" className="mb-1.5 text-xs">
                Rol
              </Label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter((v ?? 'todos') as RoleFilter)}>
                <SelectTrigger id="user-role" className="h-9 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {VALID_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-40">
              <Label htmlFor="user-status" className="mb-1.5 text-xs">
                Estado
              </Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? 'todos') as StatusFilter)}>
                <SelectTrigger id="user-status" className="h-9 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="user-link" className="mb-1.5 text-xs">
                Vínculo
              </Label>
              <Select value={linkFilter} onValueChange={(v) => setLinkFilter((v ?? 'todos') as LinkFilter)}>
                <SelectTrigger id="user-link" className="h-9 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vinculado">Con personal</SelectItem>
                  <SelectItem value="sin_vincular">Sin vincular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveUserFilters && (
              <button
                type="button"
                onClick={clearUserFilters}
                className="h-9 self-end rounded-md border border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Personal vinculado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  {users.length === 0
                    ? 'Aún no hay usuarios.'
                    : 'Sin coincidencias para los filtros aplicados.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map(({ profile, staffMember }) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.fullName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {profile.area ? (
                      <Badge variant="outline">{AREA_LABELS[profile.area]}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Global</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {staffMember ? (
                      <span>
                        {staffMember.firstName} {staffMember.lastName}
                        <span className="text-muted-foreground"> · CC {staffMember.cedula}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Sin vincular</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge isActive={profile.isActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <IconButton
                        label="Cambiar contraseña"
                        onClick={() => setResetTarget({ profileId: profile.id, email: profile.email })}
                      >
                        <KeyRound className="h-4 w-4" />
                      </IconButton>
                      {staffMember ? (
                        <IconButton
                          label="Desvincular personal"
                          disabled={busyId === staffMember.id}
                          onClick={() => handleUnlink(staffMember.id)}
                        >
                          <Link2Off className="h-4 w-4" />
                        </IconButton>
                      ) : (
                        <IconButton
                          label={
                            unlinkedStaff.length === 0
                              ? 'No hay colaboradores sin acceso disponibles'
                              : 'Vincular personal'
                          }
                          disabled={unlinkedStaff.length === 0}
                          onClick={() => setLinkTarget({ profileId: profile.id, email: profile.email })}
                        >
                          <Link2 className="h-4 w-4" />
                        </IconButton>
                      )}
                      <IconButton
                        label={profile.isActive ? 'Desactivar' : 'Activar'}
                        disabled={busyId === profile.id}
                        onClick={() => handleToggleActive(profile.id, profile.isActive)}
                        className={
                          profile.isActive
                            ? 'hover:bg-destructive/10 hover:text-destructive'
                            : 'hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                        }
                      >
                        {profile.isActive ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </IconButton>
                      <IconButton
                        label="Eliminar usuario"
                        disabled={busyId === profile.id}
                        onClick={() => handleDelete(profile.id, profile.email)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-3 space-y-3">
          <div>
            <h2 className="text-base font-semibold">Sin acceso</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mostrando {filteredUnlinkedStaff.length} de {unlinkedStaff.length} colaboradores
              activos sin credenciales.
            </p>
          </div>
          <Input
            placeholder="Buscar por nombre, cédula o correo..."
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnlinkedStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  {unlinkedStaff.length === 0
                    ? 'Todos los colaboradores activos tienen acceso.'
                    : 'Sin coincidencias para la búsqueda.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUnlinkedStaff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.firstName} {s.lastName}
                  </TableCell>
                  <TableCell className="text-sm">{s.cedula}</TableCell>
                  <TableCell className="text-sm capitalize">{s.staffProfile}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.email ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setCredentialsTarget(s)}>
                      Crear credenciales
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {credentialsTarget && (
        <CreateCredentialsModal
          open={!!credentialsTarget}
          onOpenChange={(o) => !o && setCredentialsTarget(null)}
          staffMember={credentialsTarget}
          callerRole={callerRole}
          callerArea={callerArea}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          open={!!resetTarget}
          onOpenChange={(o) => !o && setResetTarget(null)}
          profileId={resetTarget.profileId}
          email={resetTarget.email}
        />
      )}

      {linkTarget && (
        <LinkStaffModal
          open={!!linkTarget}
          onOpenChange={(o) => !o && setLinkTarget(null)}
          profileId={linkTarget.profileId}
          email={linkTarget.email}
          unlinkedStaff={unlinkedStaff}
        />
      )}
    </div>
  )
}
