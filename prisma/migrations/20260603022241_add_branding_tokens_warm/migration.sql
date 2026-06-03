-- AlterTable
ALTER TABLE "BrandingConfig" ADD COLUMN     "borderColor" TEXT NOT NULL DEFAULT '#e8ddd3',
ADD COLUMN     "foregroundColor" TEXT NOT NULL DEFAULT '#3d2b1f',
ADD COLUMN     "mutedColor" TEXT NOT NULL DEFAULT '#8a7060',
ALTER COLUMN "primaryColor" SET DEFAULT '#c8916a',
ALTER COLUMN "secondaryColor" DROP NOT NULL,
ALTER COLUMN "secondaryColor" DROP DEFAULT,
ALTER COLUMN "accentColor" SET DEFAULT '#fdf0e8',
ALTER COLUMN "backgroundColor" SET DEFAULT '#faf7f4';
