const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  const email = "vaibhavghildiyal2101@gmail.com";
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (user) {
    console.log("Found User in DB:");
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log(`User with email ${email} NOT FOUND in DB.`);
    
    // List all users to see what's there
    const allUsers = await prisma.user.findMany();
    console.log(`Current Users in DB (${allUsers.length}):`);
    allUsers.forEach(u => console.log(`- ${u.email} (clerkId: ${u.clerkId})`));
  }
}

checkUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
