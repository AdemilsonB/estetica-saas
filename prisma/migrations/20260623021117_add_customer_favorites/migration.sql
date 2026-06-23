-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "favoritePackageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "favoriteServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
