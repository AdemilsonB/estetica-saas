'use client'

import { useVitrineInteraction } from './vitrine-interaction-context'
import { EntityImage } from '@/components/domain/shared/entity-image'

type TeamMember = {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
  avatarCropX?: number | null
  avatarCropY?: number | null
  avatarCropZoom?: number | null
  bio?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
}

export function VitrineTeam({ members, id }: { members: TeamMember[]; id?: string }) {
  const { openProfessional } = useVitrineInteraction()

  if (members.length === 0) return null

  return (
    <section id={id} className="mx-auto max-w-3xl px-4 pt-8">
      <h2 className="mb-5 text-lg font-bold">Nossa Equipe</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-x-visible">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => openProfessional(m.id)}
            aria-label={`Ver perfil de ${m.name}`}
            className="flex min-w-[140px] shrink-0 flex-col items-center gap-2 rounded-2xl bg-card p-4 text-center shadow-sm sm:min-w-0"
          >
            <EntityImage
              src={m.avatarUrl}
              alt={m.name}
              shape="circle"
              cropX={m.avatarCropX}
              cropY={m.avatarCropY}
              cropZoom={m.avatarCropZoom}
              className="size-16"
              fallback={<span className="text-xl font-semibold">{m.name[0]?.toUpperCase()}</span>}
            />
            <div>
              <p className="text-sm font-medium leading-tight">{m.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</p>
            </div>
            {m.bio && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
