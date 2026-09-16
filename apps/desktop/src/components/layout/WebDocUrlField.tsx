import type { ChangeEvent, KeyboardEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface WebDocUrlFieldProps {
  onOpen: (url: string) => void
  className?: string
  placeholder?: string
}

export function WebDocUrlField({
  onOpen,
  className,
  placeholder = 'https://react.dev/learn',
}: WebDocUrlFieldProps) {
  const [value, setValue] = useState('')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      toast.error('请输入文档 URL')
      return
    }
    onOpen(trimmed)
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <input
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
        className={cn(
          'flex h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs',
          'shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
        placeholder={placeholder}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') submit()
        }}
      />
      <Button type="button" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={submit}>
        打开
      </Button>
    </div>
  )
}
