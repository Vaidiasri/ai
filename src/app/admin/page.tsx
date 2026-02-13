import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./AdminDashboardClient";

const Admin = async () => {
  const user = await currentUser();
  if (!user) {
    return redirect("/");
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = user.emailAddresses[0].emailAddress;

  if (userEmail !== adminEmail) {
    return redirect("/dashboard");
  }

  return (
    <>
      <AdminDashboardClient />
    </>
  );
};

export default Admin;
