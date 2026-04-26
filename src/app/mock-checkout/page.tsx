"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { triggerMockPayment } from "@/lib/actions/mock-stripe";

/**
 * MOCK STRIPE CHECKOUT PAGE
 * Simulates the Stripe experience for development without an account.
 */
export default function MockCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const appointmentId = searchParams.get("appointmentId");
  const amount = searchParams.get("amount");
  const doctor = searchParams.get("doctor");

  if (!appointmentId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Error: Missing appointment ID</p>
      </div>
    );
  }

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Trigger the mock webhook/action
      await triggerMockPayment(appointmentId);
      
      toast.success("Payment Successful! (Mock)");
      router.push(`/appointments?success=true`);
    } catch (error) {
      toast.error("Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Secure Checkout</CardTitle>
          <p className="text-muted-foreground">Mock Payment Gateway for {doctor}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-slate-100 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Appointment Booking</span>
              <span className="font-bold">${amount}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Ref: {appointmentId.slice(0, 12)}...</span>
              <span>Tax: $0.00</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-3 border rounded-md bg-white flex items-center gap-3">
              <div className="w-10 h-6 bg-slate-200 rounded animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-2 w-24 bg-slate-200 rounded" />
                <div className="h-2 w-12 bg-slate-100 rounded" />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            This is a <b>Mock Checkout Page</b>. No real money will be charged.
            Integrated for DentWise Hardened V2.2.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button 
            className="w-full py-6 text-lg" 
            onClick={handlePay} 
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${amount}`
            )}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => router.back()}
            disabled={isProcessing}
          >
            Cancel and return
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
