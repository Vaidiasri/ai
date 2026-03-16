"use client";

import { CheckCircleIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Essential dental appointment booking",
    features: [
      "Unlimited appointment booking",
      "Find dentists in your area",
      "Basic text chat support",
      "Appointment reminders",
    ],
    buttonText: "Current Plan",
    buttonVariant: "outline" as const,
    isPopular: false,
  },
  {
    name: "AI Basic",
    price: "$9",
    description: "AI consultations + appointment booking",
    features: [
      "Everything in Free",
      "10 AI voice calls per month",
      "AI dental guidance & advice",
      "Symptom assessment",
      "Priority support",
      "Call history & recordings",
    ],
    buttonText: "Start AI Basic",
    buttonVariant: "default" as const,
    isPopular: true,
  },
  {
    name: "AI Pro",
    price: "$19",
    description: "Unlimited AI consultations",
    features: [
      "Everything in AI Basic",
      "Unlimited AI voice calls",
      "Advanced AI dental analysis",
      "Personalized care plans",
      "24/7 priority AI support",
      "Detailed health reports",
    ],
    buttonText: "Upgrade to AI Pro",
    buttonVariant: "outline" as const,
    isPopular: false,
  },
];

export function PricingCards() {
  const handleUpgrade = (planName: string) => {
    toast.success(`Upgrade to ${planName} initiated!`, {
      description:
        "Checkout flows are currently being integrated with Clerk Billing.",
    });
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            "relative flex flex-col p-8 rounded-3xl border transition-all duration-300",
            plan.isPopular
              ? "bg-card border-primary ring-1 ring-primary shadow-xl scale-105 z-10"
              : "bg-card/50 border-border hover:border-primary/30",
          )}
        >
          {plan.isPopular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center gap-1 shadow-lg">
              <SparklesIcon className="w-3 h-3" />
              Most Popular
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          </div>

          <div className="space-y-4 mb-8 flex-1">
            {plan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <Button
            variant={plan.buttonVariant}
            className={cn(
              "w-full py-6 rounded-xl font-semibold transition-all duration-300",
              plan.isPopular &&
                "bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/20",
            )}
            disabled={plan.name === "Free"}
            onClick={() => plan.name !== "Free" && handleUpgrade(plan.name)}
          >
            {plan.buttonText}
          </Button>
        </div>
      ))}
    </div>
  );
}
