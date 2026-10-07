// Seeds the Demo clinic's doctors (spec 0003). Run after the multi clinic migration.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// same rule as the migration backfill
const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general-physician';

async function main() {
  const doctors = [
    {
      name: "Dr. Sarah Mitchell",
      email: "sarah.mitchell@dentwise.com",
      phone: "+1-555-0101",
      speciality: "General Dentistry",
      bio: "Highly experienced in restorative procedures and patient comfort.",
      imageUrl: "https://images.unsplash.com/photo-1559839734-2b71f1536783?auto=format&fit=crop&q=80&w=200&h=200",
      gender: "FEMALE",
      isActive: true,
    },
    {
      name: "Dr. James Wilson",
      email: "james.wilson@dentwise.com",
      phone: "+1-555-0102",
      speciality: "Orthodontics",
      bio: "Specializing in braces and clear aligners for all ages.",
      imageUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200&h=200",
      gender: "MALE",
      isActive: true,
    },
    {
      name: "Dr. Elena Rodriguez",
      email: "elena.rodriguez@dentwise.com",
      phone: "+1-555-0103",
      speciality: "Pediatric Dentistry",
      bio: "Gentle care specifically tailored for children's dental health.",
      imageUrl: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=200&h=200",
      gender: "FEMALE",
      isActive: true,
    },
    {
      name: "Dr. Michael Chen",
      email: "michael.chen@dentwise.com",
      phone: "+1-555-0104",
      speciality: "Endodontics",
      bio: "Expert in root canal therapy and preserving natural teeth.",
      imageUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200&h=200",
      gender: "MALE",
      isActive: true,
    },
    {
      name: "Dr. David Kumar",
      email: "david.kumar@dentwise.com",
      phone: "+1-555-0105",
      speciality: "Periodontics",
      bio: "Specialist in gum disease treatment and dental implants.",
      imageUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200&h=200",
      gender: "MALE",
      isActive: true,
    }
  ];

  const clinic = await prisma.clinic.findUnique({
    where: { slug: 'demo' },
    include: { branches: { take: 1, orderBy: { createdAt: 'asc' } } },
  });
  if (!clinic?.branches[0]) throw new Error('Demo clinic or its branch is missing; run npm run db:migrate first');
  const branchId = clinic.branches[0].id;

  console.log("Seeding doctors...");
  for (const { speciality, ...doctor } of doctors) {
    const specialty = await prisma.specialty.upsert({
      where: { slug: slugify(speciality) },
      update: {},
      create: { slug: slugify(speciality), name: speciality },
    });
    await prisma.clinicSpecialty.upsert({
      where: { clinicId_specialtyId: { clinicId: clinic.id, specialtyId: specialty.id } },
      update: {},
      create: { clinicId: clinic.id, specialtyId: specialty.id },
    });
    const data = { ...doctor, clinicId: clinic.id, branchId, specialtyId: specialty.id };
    await prisma.doctor.upsert({
      where: { clinicId_email: { clinicId: clinic.id, email: doctor.email } },
      update: data,
      create: data,
    });
  }
  console.log("Doctors seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
