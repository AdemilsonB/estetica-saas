'use client'

import { useState } from 'react'
import { Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DiscountTypesManager } from '@/components/domain/settings/discount-types-manager'
import { FeatureLock } from '@/components/domain/billing/feature-lock'
import { usePermissions } from '@/hooks/use-permissions'

export function DiscountTypesEntryButton() {
  const [open, setOpen] = useState(false)
  const { can, isLoading } = usePermissions()

  if (isLoading || !can('descontos', 'view')) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Percent className="size-3.5" />
          Descontos
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Descontos</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FeatureLock capability="descontos">
            <DiscountTypesManager readOnly={!can('descontos', 'edit')} />
          </FeatureLock>
        </div>
      </SheetContent>
    </Sheet>
  )
}
