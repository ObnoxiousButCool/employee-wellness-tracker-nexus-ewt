-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('VERY_LOW', 'LOW', 'NEUTRAL', 'GOOD', 'GREAT');

-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- AlterTable
-- wellness_entries was created empty in 20260810120000_init_roles_departments_users_wellness
-- ("foundation only; future stories add fields") and has never been written to, so these
-- columns can be added NOT NULL without a backfill default.
ALTER TABLE "wellness_entries"
  ADD COLUMN "stress_level" INTEGER NOT NULL,
  ADD COLUMN "work_hours" DECIMAL(4,2) NOT NULL,
  ADD COLUMN "sleep_hours" DECIMAL(4,2) NOT NULL,
  ADD COLUMN "mood" "Mood" NOT NULL,
  ADD COLUMN "energy_level" "EnergyLevel" NOT NULL,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "wellness_entries_user_id_entry_date_key" ON "wellness_entries"("user_id", "entry_date");
