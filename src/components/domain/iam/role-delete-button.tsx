'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useDeleteRole } from '@/hooks/iam/use-roles'

type Props = {
  roleId: string
  roleName: string
  userCount: number
  onDeleted: () => void
}

export function RoleDeleteButton({ roleId, roleName, userCount, onDeleted }: Props) {
  const deleteRole = useDeleteRole()
  const hasUsers = userCount > 0

  function handleDelete() {
    deleteRole.mutate(roleId, {
      onSuccess: () => {
        toast.success(`Cargo "${roleName}" excluído`)
        onDeleted()
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir cargo'),
    })
  }

  if (hasUsers) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-slate-300 cursor-not-allowed"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {userCount} usuário(s) vinculado(s). Reatribua-os antes de excluir.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-slate-400 hover:text-red-500"
          onClick={(e) => e.stopPropagation()}
          disabled={deleteRole.isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cargo &quot;{roleName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
