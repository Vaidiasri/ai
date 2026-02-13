import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import React from "react";

const Dashboard = async () => {
  const user = await currentUser();
  if (!user) {
    return redirect("/");
  }

  return (
    <div className="pt-20 px-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
    </div>
  );
};

export default Dashboard;
