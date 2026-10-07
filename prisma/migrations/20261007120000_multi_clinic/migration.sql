-- Spec 0003: multi clinic data model. Hand ordered: add nullable, backfill into
-- the Demo clinic, then tighten. Keeps appointments_doctorId_date_time_active_key.

-- 1. Enums, new tables, new columns (nullable for now)
CREATE TYPE "public"."ClinicStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "public"."ClinicRole" AS ENUM ('OWNER', 'DOCTOR', 'RECEPTIONIST');

CREATE TABLE "public"."specialties" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHi" TEXT,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."branches" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."clinic_members" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."ClinicRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."clinic_specialties" (
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,

    CONSTRAINT "clinic_specialties_pkey" PRIMARY KEY ("clinicId","specialtyId")
);

CREATE TABLE "public"."clinic_patients" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_patients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "specialties_slug_key" ON "public"."specialties"("slug");

ALTER TABLE "public"."clinics"
ADD COLUMN "slug" TEXT,
ADD COLUMN "status" "public"."ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "suspendedAt" TIMESTAMP(3);

ALTER TABLE "public"."doctors"
ADD COLUMN "branchId" TEXT,
ADD COLUMN "specialtyId" TEXT,
ADD COLUMN "userId" TEXT;

ALTER TABLE "public"."appointments"
ADD COLUMN "branchId" TEXT,
ADD COLUMN "clinicId" TEXT,
ADD COLUMN "clinicPatientId" TEXT;

-- 2. Backfill
-- Demo clinic: the oldest old clinic becomes Demo; with none, create one.
INSERT INTO "public"."clinics" ("id", "name", "latitude", "longitude", "updatedAt")
SELECT 'demo-clinic', 'Demo Clinic', 28.6139, 77.2090, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "public"."clinics");

UPDATE "public"."clinics" SET "slug" = 'demo'
WHERE "id" = (SELECT "id" FROM "public"."clinics" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);

INSERT INTO "public"."branches" ("id", "clinicId", "name", "address", "city", "latitude", "longitude")
SELECT gen_random_uuid()::text, "id", 'Main',
       CASE WHEN "id" = 'demo-clinic' THEN 'Demo address' ELSE "name" END,
       'Delhi', "latitude", "longitude"
FROM "public"."clinics" WHERE "slug" = 'demo';

UPDATE "public"."doctors" SET
  "clinicId" = (SELECT "id" FROM "public"."clinics" WHERE "slug" = 'demo'),
  "branchId" = (SELECT b."id" FROM "public"."branches" b JOIN "public"."clinics" c ON c."id" = b."clinicId" WHERE c."slug" = 'demo');

-- The other old clinics were "near me" listings, not customers.
DELETE FROM "public"."clinics" WHERE "slug" IS NULL;

-- Specialty catalog: common Indian OPD specialties, then every speciality in use.
INSERT INTO "public"."specialties" ("id", "slug", "name", "nameHi") VALUES
  (gen_random_uuid()::text, 'general-physician', 'General Physician', 'सामान्य चिकित्सक'),
  (gen_random_uuid()::text, 'dentist', 'Dentist', 'दंत चिकित्सक'),
  (gen_random_uuid()::text, 'pediatrics', 'Pediatrics', 'बाल रोग'),
  (gen_random_uuid()::text, 'gynecology', 'Gynecology', 'स्त्री रोग'),
  (gen_random_uuid()::text, 'orthopedics', 'Orthopedics', 'हड्डी रोग'),
  (gen_random_uuid()::text, 'dermatology', 'Dermatology', 'त्वचा रोग'),
  (gen_random_uuid()::text, 'ent', 'ENT', 'नाक, कान, गला'),
  (gen_random_uuid()::text, 'ophthalmology', 'Ophthalmology', 'नेत्र रोग'),
  (gen_random_uuid()::text, 'cardiology', 'Cardiology', 'हृदय रोग'),
  (gen_random_uuid()::text, 'psychiatry', 'Psychiatry', 'मनोरोग'),
  (gen_random_uuid()::text, 'neurology', 'Neurology', 'तंत्रिका रोग'),
  (gen_random_uuid()::text, 'gastroenterology', 'Gastroenterology', 'पेट रोग'),
  (gen_random_uuid()::text, 'pulmonology', 'Pulmonology', 'फेफड़े के रोग'),
  (gen_random_uuid()::text, 'urology', 'Urology', 'मूत्र रोग'),
  (gen_random_uuid()::text, 'endocrinology', 'Endocrinology', 'हार्मोन रोग'),
  (gen_random_uuid()::text, 'physiotherapy', 'Physiotherapy', 'फिजियोथेरेपी');

-- slug: lowercased, non alphanumerics to "-", trimmed; empty falls back to general-physician
CREATE TEMP TABLE "_doctor_specialty" AS
SELECT "id" AS "doctorId", trim("speciality") AS "name",
       COALESCE(NULLIF(trim(BOTH '-' FROM regexp_replace(lower(trim("speciality")), '[^a-z0-9]+', '-', 'g')), ''), 'general-physician') AS "slug"
FROM "public"."doctors";

INSERT INTO "public"."specialties" ("id", "slug", "name")
SELECT gen_random_uuid()::text, "slug", min("name")
FROM "_doctor_specialty"
GROUP BY "slug"
ON CONFLICT ("slug") DO NOTHING;

UPDATE "public"."doctors" d SET "specialtyId" = s."id"
FROM "_doctor_specialty" ds JOIN "public"."specialties" s ON s."slug" = ds."slug"
WHERE ds."doctorId" = d."id";

DROP TABLE "_doctor_specialty";

INSERT INTO "public"."clinic_specialties" ("clinicId", "specialtyId")
SELECT DISTINCT "clinicId", "specialtyId" FROM "public"."doctors";

-- One Demo patient record per user with an appointment.
INSERT INTO "public"."clinic_patients" ("id", "clinicId", "userId", "name", "phone")
SELECT gen_random_uuid()::text, c."id", u."id",
       COALESCE(NULLIF(trim(concat_ws(' ', u."firstName", u."lastName")), ''), NULLIF(split_part(u."email", '@', 1), ''), u."email"),
       u."phone"
FROM "public"."users" u CROSS JOIN "public"."clinics" c
WHERE c."slug" = 'demo'
  AND u."id" IN (SELECT DISTINCT "userId" FROM "public"."appointments");

UPDATE "public"."appointments" a SET
  "clinicId" = d."clinicId",
  "branchId" = d."branchId",
  "clinicPatientId" = cp."id"
FROM "public"."doctors" d, "public"."clinic_patients" cp
WHERE d."id" = a."doctorId" AND cp."clinicId" = d."clinicId" AND cp."userId" = a."userId";

-- ADMIN_EMAIL at build time (spec 0003: a literal, not read from env).
INSERT INTO "public"."clinic_members" ("id", "clinicId", "userId", "role")
SELECT gen_random_uuid()::text, c."id", u."id", 'OWNER'
FROM "public"."users" u CROSS JOIN "public"."clinics" c
WHERE c."slug" = 'demo' AND lower(u."email") = 'vaibhavghildiyal21@gmail.com';

-- 3. Tighten: fails loudly if any row was missed by the backfill
ALTER TABLE "public"."clinics" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "public"."doctors"
ALTER COLUMN "clinicId" SET NOT NULL,
ALTER COLUMN "branchId" SET NOT NULL,
ALTER COLUMN "specialtyId" SET NOT NULL;
ALTER TABLE "public"."appointments"
ALTER COLUMN "clinicId" SET NOT NULL,
ALTER COLUMN "branchId" SET NOT NULL,
ALTER COLUMN "clinicPatientId" SET NOT NULL;

DROP INDEX "public"."doctors_email_key";
DROP INDEX "public"."clinics_googlePlaceId_key";
DROP INDEX "public"."appointments_userId_idx";

-- 4. Indexes
CREATE UNIQUE INDEX "clinics_slug_key" ON "public"."clinics"("slug");
CREATE UNIQUE INDEX "doctors_id_clinicId_key" ON "public"."doctors"("id", "clinicId");
CREATE UNIQUE INDEX "branches_id_clinicId_key" ON "public"."branches"("id", "clinicId");
CREATE UNIQUE INDEX "clinic_patients_id_clinicId_key" ON "public"."clinic_patients"("id", "clinicId");
CREATE UNIQUE INDEX "doctors_clinicId_email_key" ON "public"."doctors"("clinicId", "email");
CREATE UNIQUE INDEX "clinic_members_clinicId_userId_key" ON "public"."clinic_members"("clinicId", "userId");
CREATE UNIQUE INDEX "clinic_patients_clinicId_userId_key" ON "public"."clinic_patients"("clinicId", "userId");
CREATE INDEX "branches_clinicId_idx" ON "public"."branches"("clinicId");
CREATE INDEX "clinic_members_userId_idx" ON "public"."clinic_members"("userId");
CREATE INDEX "clinic_patients_clinicId_phone_idx" ON "public"."clinic_patients"("clinicId", "phone");
CREATE INDEX "clinic_patients_userId_idx" ON "public"."clinic_patients"("userId");
CREATE INDEX "appointments_clinicId_idx" ON "public"."appointments"("clinicId");
CREATE INDEX "appointments_clinicPatientId_idx" ON "public"."appointments"("clinicPatientId");

-- 5. Foreign keys: old single column ones out, composite ones in.
-- Composite FKs are NO ACTION (a direct delete is refused, a clinic cascade still works).
ALTER TABLE "public"."doctors" DROP CONSTRAINT "doctors_clinicId_fkey";
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_doctorId_fkey";
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_userId_fkey";

ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."clinic_specialties" ADD CONSTRAINT "clinic_specialties_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."clinic_specialties" ADD CONSTRAINT "clinic_specialties_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "public"."specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."doctors" ADD CONSTRAINT "doctors_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."doctors" ADD CONSTRAINT "doctors_branchId_clinicId_fkey" FOREIGN KEY ("branchId", "clinicId") REFERENCES "public"."branches"("id", "clinicId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "public"."doctors" ADD CONSTRAINT "doctors_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "public"."specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."doctors" ADD CONSTRAINT "doctors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."clinic_patients" ADD CONSTRAINT "clinic_patients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."clinic_patients" ADD CONSTRAINT "clinic_patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_branchId_clinicId_fkey" FOREIGN KEY ("branchId", "clinicId") REFERENCES "public"."branches"("id", "clinicId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_doctorId_clinicId_fkey" FOREIGN KEY ("doctorId", "clinicId") REFERENCES "public"."doctors"("id", "clinicId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_clinicPatientId_clinicId_fkey" FOREIGN KEY ("clinicPatientId", "clinicId") REFERENCES "public"."clinic_patients"("id", "clinicId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- 6. Drop old columns (the slot index stays)
ALTER TABLE "public"."appointments" DROP COLUMN "userId";
ALTER TABLE "public"."doctors" DROP COLUMN "speciality";
ALTER TABLE "public"."clinics"
DROP COLUMN "googlePlaceId",
DROP COLUMN "isPartner",
DROP COLUMN "latitude",
DROP COLUMN "longitude";
