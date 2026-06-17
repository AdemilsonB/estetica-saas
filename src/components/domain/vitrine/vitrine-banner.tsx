// src/components/domain/vitrine/vitrine-banner.tsx
type Props = {
  coverImageUrl?: string | null
  primaryColor: string
  accentColor: string
  bio?: string | null
}

export function VitrineBanner({ coverImageUrl, primaryColor, accentColor, bio }: Props) {
  return (
    <>
      <div className="relative h-40 w-full overflow-hidden sm:h-52">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
            }}
          />
        )}
      </div>
      {bio && (
        <div className="px-4 py-4 max-w-3xl mx-auto">
          <p className="text-sm leading-relaxed text-muted-foreground">{bio}</p>
        </div>
      )}
    </>
  )
}
