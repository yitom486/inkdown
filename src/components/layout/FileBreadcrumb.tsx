import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface FileBreadcrumbProps {
  filePath?: string
  isDirty: boolean
}

function splitPath(filePath?: string): string[] {
  if (!filePath) return ['未命名文档']
  return filePath.split(/[/\\]/).filter(Boolean)
}

export function FileBreadcrumb({ filePath, isDirty }: FileBreadcrumbProps) {
  const segments = splitPath(filePath)

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm">
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1

            return (
              <Fragment key={`${segment}-${index}`}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="font-medium">
                      {segment}
                      {isDirty ? ' •' : ''}
                    </BreadcrumbPage>
                  ) : (
                    <span className="text-muted-foreground">{segment}</span>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
