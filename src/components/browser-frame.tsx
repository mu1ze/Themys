"use client";

import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type BrowserFrameProps = {
  url?: string;
  children: ReactNode;
  className?: string;
  variant?: "light" | "dark";
};

export function BrowserFrame({
  url = "themys.ca",
  children,
  className,
  variant = "light",
}: BrowserFrameProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-2xl",
        isDark
          ? "border-white/10 bg-[#1a1a2e]"
          : "border-slate-200 bg-white",
        className
      )}
    >
      {/* Title bar */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          isDark ? "bg-[#12122b]" : "bg-slate-100"
        )}
      >
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <div className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-4 flex-1">
          <div
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs",
              isDark
                ? "bg-white/5 text-slate-400"
                : "border border-slate-200 bg-white text-slate-500"
            )}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span>{url}</span>
          </div>
        </div>
        <div className="w-16" />
      </div>
      {/* Content */}
      <div className={cn(isDark ? "bg-[#0f0f23]" : "bg-white")}>
        {children}
      </div>
    </div>
  );
}

type DemoTab = {
  label: string;
  description: string;
  url: string;
  content: ReactNode;
};

type ProductShowcaseProps = {
  tabs: DemoTab[];
  className?: string;
};

export function ProductShowcase({ tabs, className }: ProductShowcaseProps) {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [tabs.length]);

  return (
    <div className={className}>
      {/* Tab buttons */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
              i === activeTab
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="mb-6 text-center text-sm text-slate-500">
        {tabs[activeTab].description}
      </p>

      {/* Browser frame */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative">
          <BrowserFrame url={tabs[activeTab].url}>
            <div className="relative overflow-hidden" style={{ minHeight: 400 }}>
              {tabs.map((tab, i) => (
                <div
                  key={tab.label}
                  className={cn(
                    "transition-all duration-500",
                    i === activeTab
                      ? "relative opacity-100"
                      : "absolute inset-0 opacity-0"
                  )}
                >
                  {tab.content}
                </div>
              ))}
            </div>
          </BrowserFrame>
        </div>
      </div>
    </div>
  );
}
