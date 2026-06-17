-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "showOnPublicPage" BOOLEAN NOT NULL DEFAULT true;
