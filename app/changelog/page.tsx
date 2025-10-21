"use client";
import AppSidebar from "@/components/AppSidebar";
import { useState } from "react";

type UpdateType = "major" | "feature" | "improvement" | "bugfix";


interface ChangelogEntry {
  id: string;
  title: string;
  type: UpdateType;
  version: string;
  date: string;
  short: string;
  long: string;
}

function makePreview(text: string, max = 180) {
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return text.slice(0, cut > 0 ? cut : max) + "…";
}

export default function ChangelogPage() {
  const [active, setActive] = useState<"all" | UpdateType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Hardcoded entries; add more later as needed.
  const entries: ChangelogEntry[] = [
    {
      id: "v1.0.0",
      title: "V1 Launch",
      type: "major",
      version: "v1.0.0",
      date: "2024-08-27",
      short:
        "Dripwriter V1 introduces a completely redesigned dashboard and writing interface. The new Pro Plan adds unlimited drips, advanced scheduling controls, and improved document syncing for Google Docs...",
      long:
        "Dripwriter V1 introduces a completely redesigned dashboard and writing interface. The new Pro Plan adds unlimited drips, advanced scheduling controls, and improved document syncing for Google Docs. Performance and reliability have also been optimized for smoother real-time updates.",
    },
    {
      id: "v1.1.0",
      title: "Background Drips for Pro",
      type: "feature",
      version: "v1.1.0",
      date: "2025-10-20",
      short:
        "Run drips in the background—even when your tab is closed. Pacing continues server‑side and your Google Doc stays in sync...",
      long:
        "You can now start a drip and close your browser with Pro. Pacing continues server‑side so your document fills in naturally over time, even if the tab or device goes to sleep. When you return, progress is saved and your Google Doc remains fully in sync.",
    },
    // Example of how future entries would look:
    // {
    //   id: "v1.1.0",
    //   title: "Improved Verification Rate",
    //   type: "improvement",
    //   version: "v1.1.0",
    //   date: "2024-10-09",
    //   short:
    //     "Improved processing throughput and validation accuracy for a smoother experience...",
    //   long:
    //     "Improved processing throughput and validation accuracy across the board. Faster queues, better reliability, and more accurate results.",
    // },
  ];

  const sortedEntries = [...entries].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const typeBadgeClass: Record<UpdateType, string> = {
    major: "bg-purple-100 text-purple-800",
    feature: "bg-blue-100 text-blue-800",
    improvement: "bg-green-100 text-green-800",
    bugfix: "bg-pink-100 text-pink-800",
  };

  const labels: Array<"all" | UpdateType> = ["all", "major", "feature", "improvement", "bugfix"];

  const filtered =
    active === "all" ? sortedEntries : sortedEntries.filter((e) => e.type === active);

  return (
    <div className="flex min-h-screen bg-white text-black">
      <div className="fixed inset-0 -z-10 bg-white" />
      <AppSidebar />
      <main className="flex-1 overflow-auto p-4 overscroll-none bg-white">
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          {/* Keep original title sizing */}
          <h2 className="text-4xl font-bold mb-8">Changelog</h2>

          {/* Keep original button sizing; now interactive + persistent filter */}
          <div className="mb-6 flex flex-wrap gap-2">
            {labels.map((label) => (
              <button
                key={label}
                onClick={() => setActive(label)}
                className={`inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 rounded-md px-3 capitalize cursor-pointer border border-gray-300 ${
                  active === label
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const preview = makePreview(entry.long, 180);
              return (
                <div
                  key={entry.id}
                  className="border-l-4 border-primary pl-4 py-1 transition-opacity duration-300 ease-in-out"
                >
                  <div className="flex items-center justify-between mb-2">
                    {/* Keep original entry title sizing */}
                    <h3 className="text-xl font-semibold">{entry.title}</h3>
                    <div
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-secondary/80 text-xs ${typeBadgeClass[entry.type]}`}
                    >
                      {entry.type}
                    </div>
                  </div>

                  {/* Keep original meta sizing */}
                  <div className="flex items-center text-sm text-gray-500 space-x-4 mb-3">
                    <span className="font-medium">{entry.version}</span>
                    <span>•</span>
                    <span>{entry.date}</span>
                  </div>

                  {/* Keep original description sizing */}
                  <div className="text-sm text-gray-500">
                    {isExpanded ? entry.long : preview}
                  </div>

                  {/* Keep original button sizing; add pointer + toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="inline-flex items-center justify-center whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground rounded-md px-3 mt-2 h-auto text-sm font-medium cursor-pointer"
                  >
                    {isExpanded ? "Show less" : "Read more"}
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
                      className={`lucide lucide-chevron-down ml-2 h-4 w-4 transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}