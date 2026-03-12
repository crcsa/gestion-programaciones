'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrainingAreaOption {
  id: string
  code: string
  name: string
}

interface TrainingAreaMultiSelectProps {
  options: TrainingAreaOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function TrainingAreaMultiSelect({
  options,
  selected,
  onChange,
  disabled = false,
  placeholder = 'Seleccionar áreas...',
}: TrainingAreaMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedAreas = options.filter((opt) => selected.includes(opt.id))

  function handleToggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id]
    onChange(next)
  }

  function handleRemove(id: string) {
    onChange(selected.filter((s) => s !== id))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
        >
          <span className="truncate">
            {selected.length > 0
              ? `${selected.length} área(s) seleccionada(s)`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar área..." />
            <CommandList>
              <CommandEmpty>No se encontraron áreas.</CommandEmpty>
              <CommandGroup>
                {options.map((area) => (
                  <CommandItem
                    key={area.id}
                    value={area.name}
                    onSelect={() => handleToggle(area.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected.includes(area.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="font-medium">{area.code}</span>
                    <span className="ml-2 text-muted-foreground">{area.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedAreas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedAreas.map((area) => (
            <Badge key={area.id} variant="secondary" className="gap-1">
              {area.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(area.id)}
                  className="ml-1 rounded-full outline-none hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
