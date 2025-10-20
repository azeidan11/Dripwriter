"use client";

import Link from "next/link";
import React from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

type Plan = "FREE" | "STARTER" | "PRO" | "DAYPASS" | "DEV";
type Active =
  | "dashboard"
  | "account"
  | "changelog"
  | "feedback"
  | "upgrade"
  | null;

export function planLabel(plan?: Plan) {
  if (!plan) return "Free Plan";
  return plan === "FREE"
    ? "Free Plan"
    : plan === "STARTER"
    ? "Starter Plan"
    : plan === "PRO"
    ? "Pro Plan"
    : plan === "DAYPASS"
    ? "Day Pass"
    : "Dev";
}

export default function AppSidebar({
  userName,
  plan,
  active = null,
  comingSoon = plan !== "DEV", // same behavior you had in dashboard
  upgradeCta,
}: {
  userName?: string | null;
  plan?: Plan;
  active?: Active;
  /** When true, show the "coming soon" disabled state for some items (matches dashboard). */
  comingSoon?: boolean;
  /** Custom CTA text for the bottom Upgrade button. */
  upgradeCta?: string;
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const next = pathname && pathname !== "/" ? pathname : "/dashboard";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return null;
  }

  const planDisplay = planLabel(plan);
  const cta = upgradeCta
    ?? (plan === "FREE" ? "Upgrade Now" : plan === "STARTER" ? "Upgrade to Pro" : "Browse Plans");

  return (
    <>
      {/* Fixed left dashboard rail */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[239px] select-none bg-[#b35c8f]">
        <nav className="flex-1 px-4 py-6 flex flex-col">
          <div>
            <div className="text-white font-extrabold drop-shadow mb-4 text-2xl md:text-3xl">
              Dripwriter
            </div>

            <div className="ml-[-16px] w-[239px] my-6 h-px bg-black/10" />

            <ul className="-mt-3 space-y-2 text-white/90">
              {/* Insert Text (Dashboard) */}
              <li>
                <Link
                  href="/dashboard"
                  className={`group block w-[215px] h-10 rounded-lg px-3 text-base flex items-center gap-2 ${
                    active === "dashboard" ? "bg-white/15" : "hover:bg-white/10"
                  }`}
                >
                  {/* icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 flex-shrink-0"
                  >
                    <rect x="3" y="3" width="18" height="14" rx="2" />
                    <path d="M7 7h10" />
                    <path d="M7 11h6" />
                    <path d="M5 21h14" />
                  </svg>
                  <span className="truncate">Insert Text</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`ml-auto h-4 w-4 transition-opacity duration-300 ease-out ${
                      active === "dashboard" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </li>

              {/* Upload File (disabled until ready) */}
              <li>
                {comingSoon ? (
                  <div
                    className="relative cursor-not-allowed opacity-60 select-none"
                    aria-disabled="true"
                    title="Coming soon…"
                  >
                    <div className="w-[215px] h-10 text-left rounded-lg px-3 text-base flex items-center gap-2 select-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 flex-shrink-0"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" x2="12" y1="3" y2="15" />
                      </svg>
                      <span className="truncate">Upload File</span>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/upload"
                    className="group block w-[215px] h-10 rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 flex-shrink-0"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    <span className="truncate">Upload File</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                )}
              </li>

              {/* Text Scan (disabled until ready) */}
              <li>
                {comingSoon ? (
                  <div
                    className="relative cursor-not-allowed opacity-60 select-none"
                    aria-disabled="true"
                    title="Coming soon…"
                  >
                    <div className="w-[215px] h-10 text-left rounded-lg px-3 text-base flex items-center gap-2 select-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 flex-shrink-0"
                      >
                        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                        <rect x="7" y="8" width="10" height="8" rx="2" />
                      </svg>
                      <span className="truncate">Text Scan</span>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/scan"
                    className="group block w-[215px] h-10 rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 flex-shrink-0"
                    >
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      <rect x="7" y="8" width="10" height="8" rx="2" />
                    </svg>
                    <span className="truncate">Text Scan</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                )}
              </li>

              {/* Recent Drips (disabled until ready) */}
              <li>
                {comingSoon ? (
                  <div
                    className="relative cursor-not-allowed opacity-60 select-none"
                    aria-disabled="true"
                    title="Coming soon…"
                  >
                    <div className="w-[215px] h-10 text-left rounded-lg px-3 text-base flex items-center gap-2 select-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 flex-shrink-0"
                      >
                        <path d="M3 3v5h5" />
                        <path d="M3.05 13A9 9 0 1 0 8 3.46" />
                        <path d="M12 7v5l3 3" />
                      </svg>
                      <span className="truncate">Recent Drips</span>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/history"
                    className="group block w-[215px] h-10 rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 flex-shrink-0"
                    >
                      <path d="M3 3v5h5" />
                      <path d="M3.05 13A9 9 0 1 0 8 3.46" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                    <span className="truncate">Recent Drips</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                )}
              </li>

              {/* Upgrade (regular list link—there's also a big CTA at bottom) */}
              <li>
                <Link
                  href="/upgrade"
                  className={`group block w-[215px] h-10 rounded-lg px-3 text-base flex items-center gap-2 ${
                    active === "upgrade" ? "bg-white/15" : "hover:bg-white/10"
                  }`}
                >
                  {/* Rocket icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 flex-shrink-0"
                  >
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                  </svg>
                  <span className="truncate">Upgrade</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </li>
            </ul>
          </div>

          <div className="mt-auto pt-2">
            <div className="ml-[-16px] w-[239px] h-px bg-black/10" />

            {/* Quick Links */}
            <div className="mt-3 text-xs uppercase tracking-wide text-white/70">
              Quick Links
            </div>
            <ul className="mt-2 space-y-2 text-white/90">
              <li>
                <Link
                  href="/changelog"
                  className={`group block w-[215px] h-10 rounded-lg px-3 text-base flex items-center gap-2 ${
                    active === "changelog" ? "bg-white/15" : "hover:bg-white/10"
                  }`}
                >
                  {/* File/Text icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 flex-shrink-0"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                  </svg>
                  <span className="truncate">Changelog</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </li>
              <li>
                <Link
                  href="/feedback"
                  className={`group block w-[215px] h-10 rounded-lg px-3 text-base flex items-center gap-2 ${
                    active === "feedback" ? "bg-white/15" : "hover:bg-white/10"
                  }`}
                >
                  {/* Feedback/Message icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 flex-shrink-0"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="truncate">Feedback</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </li>
            </ul>

            <div className="ml-[-16px] w-[239px] my-3 h-px bg-black/10" />

            {/* My Account (active style when on /account) */}
            <Link
              href="/account"
              className="w-[215px] h-10 text-left rounded-lg px-3 flex items-center gap-3 text-white/90 hover:bg-white/10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="25"
                height="25"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6.5 w-6.5"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="9.5" r="3"></circle>
                <path d="M6.5 18a7 7 0 0 1 11 0"></path>
              </svg>
              <span className="leading-tight">
                <span className="block text-white font-medium -mb-0.5">
                  {userName || "My Account"}
                </span>
                <span className="block text-white/70 text-xs mt-0.5">
                  {planDisplay}
                </span>
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>

            <div className="ml-[-16px] w-[239px] my-3 h-px bg-black/10" />

            {/* Bottom Upgrade CTA */}
            <Link
              href="/upgrade"
              className="w-[215px] h-12 mx-auto block inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-lg shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 bg-white hover:bg-white/80 text-black px-4 mt-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 16V8"></path>
                <path d="m8.5 11.5 3.5-3.5 3.5 3.5"></path>
              </svg>
              <span>{cta}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Fixed vertical divider to the right of the rail (matches dashboard) */}
      <div className="hidden lg:block fixed left-[239px] top-0 bottom-0 w-px bg-white/40" />
    </>
  );
}