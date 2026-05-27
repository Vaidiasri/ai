-- One active booking per doctor/date/time (cancelled slots may be rebooked)
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_doctorId_date_time_active_key"
ON "appointments"("doctorId", "date", "time")
WHERE "status" <> 'CANCELLED';
