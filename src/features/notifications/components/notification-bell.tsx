'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getNotifications } from '../actions/notification-actions'
import type { AppNotification } from '../actions/notification-actions'

const STORAGE_KEY = 'read-notification-ids'

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // storage unavailable
  }
}

const TYPE_ICON: Record<AppNotification['type'], string> = {
  campaign_cancelled: 'x',
  missing_coordinator: '!',
  balance_warning: '+',
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setReadIds(getReadIds())
  }, [])

  useEffect(() => {
    if (open && notifications.length === 0) {
      setLoading(true)
      getNotifications()
        .then((data) => setNotifications(data))
        .catch(() => undefined)
        .finally(() => setLoading(false))
    }
  }, [open, notifications.length])

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  const markAllRead = useCallback(() => {
    const newIds = new Set([...readIds, ...notifications.map((n) => n.id)])
    setReadIds(newIds)
    saveReadIds(newIds)
  }, [readIds, notifications])

  const handleNotificationClick = useCallback(
    (notification: AppNotification) => {
      const newIds = new Set([...readIds, notification.id])
      setReadIds(newIds)
      saveReadIds(newIds)
      if (notification.campaignId) {
        router.push(`/campanas/${notification.campaignId}`)
      }
      setOpen(false)
    },
    [readIds, router],
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={markAllRead}
            >
              Marcar todas leidas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Cargando...
            </p>
          )}
          {!loading && notifications.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin notificaciones
            </p>
          )}
          {!loading &&
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  'w-full px-4 py-3 text-left hover:bg-muted/50 border-b last:border-0 transition-colors',
                  !readIds.has(n.id) && 'bg-muted/20',
                )}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {TYPE_ICON[n.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                  {!readIds.has(n.id) && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              </button>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
