import { auth } from "@clerk/nextjs/server";
import Navbar from "@/components/Navbar";
import FeatureCards from "@/components/voice/FeatureCards";
import ProPlanRequired from "@/components/voice/ProPlanRequired";
import VapiWidget from "@/components/voice/VapiWidget";
import WelcomeSection from "@/components/voice/WelcomeSection";

async function VoicePage() {
  const { has } = await auth();

  // Temporarily Bypass for testing
  // const hasProPlan = has({ plan: "ai_basic" }) || has({ plan: "ai_pro" });
  // if (!hasProPlan) return <ProPlanRequired />;
  const hasProPlan = true;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 pt-24">
        <WelcomeSection />
        <FeatureCards />
      </div>

      <VapiWidget />
    </div>
  );
}

export default VoicePage;
