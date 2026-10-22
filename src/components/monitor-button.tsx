"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import {
  createMonitoringSubscription,
  deleteMonitoringSubscription,
  listMonitoringSubscriptions,
} from "@/lib/monitoring-client";

export interface MonitorButtonProps {
  url: string;
  domain: string;
  title?: string;
  isMonitored: boolean;
  onToggle?: (nowMonitored: boolean) => void;
}

export function MonitorButton({
  url,
  domain,
  title,
  isMonitored: initialMonitored,
  onToggle,
}: MonitorButtonProps) {
  const [isMonitored, setIsMonitored] = useState(initialMonitored);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        if (isMonitored) {
          const subsData = await listMonitoringSubscriptions();
          const sub = subsData.subscriptions?.find((s) => s.url === url);
          if (sub) {
            await deleteMonitoringSubscription(sub.id);
          }
          setIsMonitored(false);
          onToggle?.(false);
        } else {
          await createMonitoringSubscription({ url, domain, title });
          setIsMonitored(true);
          onToggle?.(true);
        }
      } catch (err) {
        console.error("Monitor toggle failed:", err);
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={
        isMonitored
          ? "group relative inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ds-success)]/25 bg-[var(--ds-success-bg)] px-4 text-[15px] font-medium text-[var(--ds-success)] transition disabled:opacity-60"
          : "group relative inline-flex h-9 items-center gap-2 rounded-full bg-[var(--ds-accent)] px-4 text-[15px] font-medium text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-60"
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {isPending ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isMonitored ? "Unsubscribing..." : "Subscribing..."}</span>
          </motion.span>
        ) : isMonitored ? (
          <motion.span
            key="monitoring"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            <span>Monitoring</span>
            <BellOff className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.span>
        ) : (
          <motion.span
            key="subscribe"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            <span>Monitor</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
