"use client";
import { signIn } from "next-auth/react";
import React from "react";

export default function SignInButton({ children = "Get started now" }: { children?: React.ReactNode }) {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="rounded-xl px-5 py-3 bg-white/30 backdrop-blur border border-white/40 shadow-md hover:bg-white/40 transition"
    >
      {children}
    </button>
  );
}