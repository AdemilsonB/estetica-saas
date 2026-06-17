export type TenantBranding = {
  logoUrl?: string | null
  bannerUrl?: string | null
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
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  imageUrl?: string | null
  description?: string | null
  categoryId?: string | null
  categoryName?: string | null
  anamneseMode: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  anamneseBlocks: string[]
  anamneseValidityDays: number
}

export type PublicProfessional = {
  id: string
  name: string
  avatarUrl: string | null
  serviceIds: string[]
}

export type PublicPackage = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  duration: number
  services: { id: string; name: string; duration: number }[]
}

export type PublicPromotion = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  services: { id: string; name: string; duration: number; originalPrice: number }[]
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
  packages: PublicPackage[]
  promotions: PublicPromotion[]
  allowPublicBooking: boolean
}

export type BookingState = {
  serviceId?: string
  serviceName?: string
  serviceDuration?: number
  servicePrice?: string
  servicePriceNumber?: number
  serviceAnamneseMode?: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  serviceAnamneseBlocks?: string[]
  serviceAnamneseValidityDays?: number
  packageId?: string
  promotionId?: string
  professionalId?: string
  professionalName?: string
  startsAt?: Date
  customerName?: string
  customerPhone?: string
  notes?: string
  anamneseId?: string
  customerId?: string
  identifiedCustomerName?: string
}

export type BookingStep =
  | 'service'
  | 'professional'
  | 'datetime'
  | 'anamnese'
  | 'confirmation'
  | 'success'
