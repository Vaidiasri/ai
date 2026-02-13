"use client";
import { useUser } from "@clerk/nextjs";
import React, { useEffect } from "react";
import { createUser } from "@/lib/actions/user";

const UserSync = () => {
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    const handleUserSync = async () => {
      if (isLoaded && isSignedIn) {
        try {
          await createUser();
        } catch (error) {
          console.error("Error syncing user:", error);
        }
      }
    };

    handleUserSync();
  }, [isLoaded, isSignedIn]);

  return null;
};

export default UserSync;
