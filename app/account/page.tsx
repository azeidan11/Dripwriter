"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function AccountPage() {
  const { data: session } = useSession();
  const [email, setEmail] = React.useState(session?.user?.email ?? "");

  // Keep input updated if session arrives late
  React.useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email);
  }, [session?.user?.email]);

  return (
    <main className="flex-1 overflow-auto p-4">
      <div className="py-4 px-4 sm:py-6 sm:px-6 md:py-8 md:px-8 lg:py-10 lg:px-10 mb-4 sm:mb-6 md:mb-8 lg:mb-10">
        <h1 className="text-4xl font-bold text-black text-center lg:text-left sm:text-5xl sm:tracking-tight lg:text-5xl">
          Settings
        </h1>

        <div>
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            {/* Email Settings Card */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="tracking-tight text-xl font-semibold flex items-center">
                  {/* mail icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-mail mr-2 h-5 w-5"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                  Email Settings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Update your email address
                </p>
              </div>
              <div className="p-6 pt-0">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="email"
                  >
                    Current Email
                  </label>
                  <div className="flex space-x-2">
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-grow"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                      onClick={() => {
                        // Placeholder: wire to your email-change flow or support.
                        // You could POST to /api/account/change-email here.
                        console.log("Change Email clicked:", email);
                        alert("Email change is not yet available.");
                      }}
                    >
                      Change Email
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Card */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="tracking-tight text-xl font-semibold flex items-center">
                  {/* credit card icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-credit-card mr-2 h-5 w-5"
                  >
                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                    <line x1="2" x2="22" y1="10" y2="10"></line>
                  </svg>
                  Subscription
                </h3>
                <p className="text-sm text-muted-foreground">
                  Manage your subscription details
                </p>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  You are not currently subscribed.
                </p>
                <Link
                  href="/upgrade"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                >
                  Subscribe Now
                </Link>
              </div>
            </div>
          </div>

          {/* Help Card */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm mt-6">
            <div className="p-6 pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="mb-4 sm:mb-0">
                  <h3 className="text-lg font-semibold">Need Help?</h3>
                  <p className="text-sm text-muted-foreground">
                    If you have any questions or need assistance, please don't
                    hesitate to contact us.
                  </p>
                </div>
                <div className="flex items-center">
                  {/* mail icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-mail h-5 w-5 mr-2 text-muted-foreground"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                  <a
                    href="mailto:team@lumrid.com"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline p-0 h-auto font-normal text-primary"
                  >
                    team@lumrid.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Logout Card */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm mt-6">
            <div className="p-6 pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="mb-4 sm:mb-0">
                  <h3 className="text-lg font-semibold">Logout</h3>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2 w-full justify-start focus:ring-0"
                  >
                    <div className="flex items-center w-full">
                      {/* log-out icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-log-out h-4 w-4"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" x2="9" y1="12" y2="12"></line>
                      </svg>
                      <span className="ml-3">Logout</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </main>
  );
}