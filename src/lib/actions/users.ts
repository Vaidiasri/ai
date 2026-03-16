"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "../prisma";

export async function syncUser() {
  try {
    const user = await currentUser();
    if (!user) return;

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return; // can't create user without email

    // upsert: create if not exists, update if already present (handles race conditions)
    const dbUser = await prisma.user.upsert({
      where: { clerkId: user.id },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        email,
        phone: user.phoneNumbers[0]?.phoneNumber ?? null,
      },
      create: {
        clerkId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email,
        phone: user.phoneNumbers[0]?.phoneNumber ?? null,
      },
    });

    return dbUser;
  } catch (error) {
    console.log("Error in syncUser server action", error);
  }
}
