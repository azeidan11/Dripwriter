"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useMemo } from "react";
import AppSidebar from "@/components/AppSidebar";

type Plan = "FREE" | "STARTER" | "PRO" | "DAYPASS" | "DEV";

export default function AccountPage() {
  const { data: session } = useSession();
  const PLAN: Plan = useMemo(() => {
    const raw = (session as any)?.plan as Plan | undefined;
    return (raw === "FREE" || raw === "STARTER" || raw === "PRO" || raw === "DAYPASS" || raw === "DEV") ? raw : "FREE";
  }, [session]);

  const planDisplay =
    PLAN === "FREE" ? "Free Plan"
      : PLAN === "STARTER" ? "Starter Plan"
      : PLAN === "PRO" ? "Pro Plan"
      : PLAN === "DAYPASS" ? "Day Pass"
      : "Dev";

  // can wire this later
  const email = session?.user?.email ?? "";

  return (
    <main className="min-h-screen text-black">
      {/* white background */}
      <div className="fixed inset-0 -z-10 bg-white" />

      <section className="relative mx-auto w-full px-6 md:px-8 pt-10 pb-20 lg:pl-[255px]">
        <AppSidebar userName={session?.user?.name} plan={PLAN} active="account" />

        {/* vertical divider */}
        <div className="hidden lg:block fixed left-[239px] top-0 bottom-0 w-px bg-white/40" />

        {/* Content */}
        <div className="px-6 lg:pl-8 lg:pr-4">
          <h1 className="text-left text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 lg:mb-6 drop-shadow text-black">
            Settings
          </h1>

          {/* Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Email Settings */}
            <div className="rounded-lg bg-white text-card-foreground border border-gray-200 shadow-lg">
              <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="tracking-tight text-xl font-semibold flex items-center text-black">
                  {/* mail icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       className="mr-2 h-5 w-5">
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                  Email 
                </h3>
                <label className="block text-sm font-medium text-black/80 mt-2 mb-2">Current Email:</label>
                <input
                  className="text-black flex h-10 w-full rounded-md bg-white pl-0 py-2 text-sm"
                  id="email"
                  value={email}
                  readOnly
                />
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-lg bg-white text-card-foreground border border-gray-200 shadow-lg">
              <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="tracking-tight text-xl font-semibold flex items-center text-black">
                  {/* card icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       className="mr-2 h-5 w-5">
                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                    <line x1="2" x2="22" y1="10" y2="10"></line>
                  </svg>
                  Subscription
                </h3>
                <p className="text-sm text-black/70">Manage your subscription details</p>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <p className="text-sm text-black/70">
                  You are not currently subscribed.
                </p>
                <button className="inline-flex items-center justify-center rounded-md bg-black text-white h-10 px-4 py-2 w-full text-sm font-medium cursor-pointer">
                  Subscribe Now
                </button>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="rounded-lg bg-white text-card-foreground border border-gray-200 shadow-lg mt-6">
            <div className="p-6 pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="mb-4 sm:mb-0">
                  <h3 className="text-lg font-semibold text-black">Need Help?</h3>
                  <p className="text-sm text-black/70">
                    If you have any questions or need assistance, please don't hesitate to contact us.
                  </p>
                </div>
                <div className="flex items-center text-black">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       className="h-5 w-5 mr-2 text-black/60">
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                  <a className="underline" href="mailto:team@lumrid.com">team@lumrid.com</a>
                </div>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="rounded-lg bg-white text-card-foreground border border-gray-200 shadow-lg mt-6">
            <div className="p-6 pt-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-black">Logout</h3>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex items-center rounded-md bg-red-600 text-white h-10 px-4 py-2 text-sm font-medium hover:bg-red-700 cursor-pointer"
              >
                {/* logout icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="h-4 w-4">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" x2="9" y1="12" y2="12"></line>
                </svg>
                <span className="ml-2">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}