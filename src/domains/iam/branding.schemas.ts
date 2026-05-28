import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser um hex válido (#rrggbb)')

export const UpdateBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  fontFamily: z
    .enum(['inter', 'manrope', 'geist', 'dm-sans', 'plus-jakarta-sans', 'lato'])
    .optional(),
  borderRadius: z.enum(['none', 'medium', 'full']).optional(),
  colorScheme: z.enum(['light', 'dark']).optional(),
})

export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>

export const OnboardingBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
})

export type OnboardingBrandingInput = z.infer<typeof OnboardingBrandingSchema>
