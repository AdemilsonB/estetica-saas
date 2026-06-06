export type TenantBranding = {
  logoUrl?: string | null
  primaryColor?: string | null
  backgroundColor?: string | null
  foregroundColor?: string | null
  accentColor?: string | null
  borderRadius?: string | null
  fontFamily?: string | null
}

export type PublicService = {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  imageUrl?: string | null
}

export type PublicProfessional = {
  id: string
  name: string
}

export type TenantPublicData = {
  name: string
  slug: string
  address?: string | null
  timezone: string
  businessHours?: unknown
  branding?: TenantBranding | null
  services: PublicService[]
  professionals: PublicProfessional[]
  allowPublicBooking: boolean
}

export type BookingState = {
  serviceId?: string
  serviceName?: string
  serviceDuration?: number
  servicePrice?: string
  professionalId?: string
  professionalName?: string
  startsAt?: Date
  customerName?: string
  customerPhone?: string
  notes?: string
}

export type BookingStep =
  | 'service'
  | 'professional'
  | 'datetime'
  | 'personal'
  | 'confirmation'
  | 'success'
