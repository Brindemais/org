import type { ElementType, ReactNode } from 'react'

interface ResponsiveContainerProps {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Narrower reading-width container, e.g. for legal text pages */
  narrow?: boolean
}

export function ResponsiveContainer({ children, as: Tag = 'div', className = '', narrow = false }: ResponsiveContainerProps) {
  return (
    <Tag className={`w-full ${narrow ? 'max-w-3xl' : 'max-w-content'} mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </Tag>
  )
}
