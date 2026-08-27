"use client";

import { useState } from "react";
import { Palette, MapPin, Sparkles } from "lucide-react";
import { displayFontFamily } from "@/lib/fonts";

export interface DefaultCompanyTabsProps {
  brandingContent: React.ReactNode;
  recommendationsContent: React.ReactNode;
  recommendationsCount: number;
}

export default function DefaultCompanyTabs({
  brandingContent,
  recommendationsContent,
  recommendationsCount,
}: DefaultCompanyTabsProps) {
  const [activeTab, setActiveTab] = useState<"branding" | "recommendations">("branding");

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex border-b border-[var(--admin-border)] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "branding"
              ? "border-[var(--admin-accent)] text-[var(--admin-accent)]"
              : "border-transparent text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
          }`}
        >
          <Palette className="size-4" />
          Branding & Identity
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recommendations")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "recommendations"
              ? "border-[var(--admin-accent)] text-[var(--admin-accent)]"
              : "border-transparent text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
          }`}
        >
          <MapPin className="size-4" />
          Recommendations
          <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {recommendationsCount}
          </span>
        </button>
      </div>

      {/* Subtab Content */}
      <div>
        {activeTab === "branding" ? brandingContent : recommendationsContent}
      </div>
    </div>
  );
}
