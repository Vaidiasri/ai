import { Button } from "@/components/ui/button";
import {
  SignUpButton,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
export default function Home() {
  return (
    <>
      <div>
        <h1>DetWise-AI Powered Dental Assistant</h1>
        <p>
          AI-powered dental assistant that helps dentists diagnose and treat
          dental problems.
        </p>
        <SignedOut>
          <SignUpButton mode="modal">
            <Button>Sign Up</Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button>Sign In</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </>
  );
}
