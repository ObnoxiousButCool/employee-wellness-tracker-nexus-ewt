-- CreateIndex
CREATE INDEX "users_department_id_is_active_idx" ON "users"("department_id", "is_active");
