"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const search = useSearchParams();
  const nextUrl = search?.get("next") || "/dashboard";

  const handleGoogle = async () => {
    try {
      await signIn("google", { callbackUrl: nextUrl });
    } catch (e) {
      console.error("NextAuth Google sign-in failed:", e);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background font-sans">
      <div className="w-full max-w-lg p-6">
        <div
          className={`relative w-full rounded-2xl border border-gray-200 bg-card text-card-foreground shadow-lg overflow-hidden mx-auto ${
            mounted ? "animate-[riseIn_300ms_ease-out]" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Header */}
          <div className="flex flex-col p-10 space-y-2 pb-10">
            <h3 className="tracking-tight text-5xl font-extrabold text-center">Dripwriter</h3>
            <p className="text-center text-muted-foreground text-2xl">
              Sign in to access your account
            </p>
          </div>

          {/* Google button only */}
          <div className="px-10 pb-10 flex justify-center">
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full h-14 px-6 py-3 inline-flex items-center justify-center rounded-lg text-lg font-semibold bg-primary text-primary-foreground cursor-pointer transition-all duration-300 ease-in-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-[#b35c8f] hover:text-white"
            >
              <svg
                className="mr-3"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                width="28"
                height="28"
              >
                <path
                  fill="#FFC107"
                  d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
                  c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
                  c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657
                  C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
                  c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238
                  C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                />
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes riseIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}