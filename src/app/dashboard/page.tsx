import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ActivityOverview from "@/components/dashboard/ActivityOverview";
import MainActions from "@/components/dashboard/MainActions";
import WelcomeSection from "@/components/dashboard/WelcomeSection";
import Navbar from "@/components/Navbar";

export const dynamic = "force-dynamic";

async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  return (
    <>
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 pt-24">
        <WelcomeSection />
        <MainActions />
        <ActivityOverview />
      </div>
    </>
  );
}
export default DashboardPage;
