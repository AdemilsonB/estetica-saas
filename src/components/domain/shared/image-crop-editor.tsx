'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

type Shape = 'circle' | 'portrait' | 'square'

const ASPECT: Record<Shape, number> = {
  circle: 1,
  portrait: 4 / 5,
  square: 1,
}

export type CropValues = { cropX: number; cropY: number; cropZoom: number }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  shape: Shape
  initial?: CropValues | null
  onSave: (values: CropValues) => void
  saving?: boolean
}

function toInitialArea(initial: CropValues | null | undefined): Area | undefined {
  if (!initial) return undefined
  const size = 100 / initial.cropZoom
  return {
    x: initial.cropX * 100 - size / 2,
    y: initial.cropY * 100 - size / 2,
    width: size,
    height: size,
  }
}

export function ImageCropEditor({ open, onOpenChange, imageUrl, shape, initial, onSave, saving }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)

  const handleCropComplete = useCallback((croppedArea: Area) => {
    setArea(croppedArea)
  }, [])

  function handleSave() {
    if (!area) return
    onSave({
      cropX: (area.x + area.width / 2) / 100,
      cropY: (area.y + area.height / 2) / 100,
      cropZoom: 100 / area.width,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar enquadramento</DialogTitle>
        </DialogHeader>

        <div className="relative h-[50vh] max-h-[420px] w-full overflow-hidden rounded-xl bg-black">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT[shape]}
            cropShape={shape === 'circle' ? 'round' : 'rect'}
            initialCroppedAreaPercentages={toInitialArea(initial)}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Slider min={1} max={3} step={0.05} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
        </div>
        <p className="px-1 text-xs text-muted-foreground">Arraste a imagem para reposicionar.</p>

        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="h-11" onClick={handleSave} disabled={!area || saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
