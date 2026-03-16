
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

  console.log("Seeding doctors...");
  for (const doctor of doctors) {
    await prisma.doctor.upsert({
      where: { email: doctor.email },
      update: doctor,
      create: doctor,
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
