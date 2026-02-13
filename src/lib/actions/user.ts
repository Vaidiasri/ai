"use server"

import {currentUser} from "@clerk/nextjs/server";
import { prisma } from "../prisma";

export const createUser = async () => {
    try {
        const user = await currentUser();
        if (!user) {
            throw new Error("User not found");
        }

        // Validate email exists
        const email = user.emailAddresses[0]?.emailAddress;
        if (!email) {
            throw new Error("User email not found");
        }

        // Check if user already exists
        const dbUser = await prisma.user.findUnique({
            where: {
                clerkId: user.id,
            },
        });

        if (dbUser) {
            return dbUser;
        }

        // Create new user
        const newUser = await prisma.user.create({
            data: {
                clerkId: user.id,
                email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumbers[0]?.phoneNumber,
            },
        });
        return newUser;
    } catch (error) {
        console.error("Error creating user:", error);
        throw error;
    }
}