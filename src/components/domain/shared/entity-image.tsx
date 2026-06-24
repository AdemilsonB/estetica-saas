import { cn } from '@/lib/utils'

type Shape = 'circle' | 'portrait' | 'square'

type Props = {
  src?: string | null
  alt: string
  cropX?: number | null
  cropY?: number | null
  cropZoom?: number | null
  shape: Shape
  fallback?: React.ReactNode
  className?: string
}

const SHAPE_CLASSES: Record<Shape, string> = {
  circle: 'aspect-square rounded-full',
  portrait: 'aspect-[4/5] rounded-2xl',
  square: 'aspect-square rounded-2xl',
}

export function EntityImage({ src, alt, cropX, cropY, cropZoom, shape, fallback, className }: Props) {
  const x = (cropX ?? 0.5) * 100
  const y = (cropY ?? 0.5) * 100
  const zoom = cropZoom ?? 1

  return (
    <div className={cn('relative overflow-hidden bg-muted', SHAPE_CLASSES[shape], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 size-full"
          style={{
            objectFit: 'cover',
            objectPosition: `${x}% ${y}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${x}% ${y}%`,
          }}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">{fallback}</div>
      )}
    </div>
  )
}
