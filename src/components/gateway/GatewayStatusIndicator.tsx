"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface GatewayStatus {
  online: boolean;
  version: string | null;
}

export function GatewayStatusIndicator() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/gateway/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        setStatus({ online: false, version: null });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
      title={status?.online ? `OpenClaw ${status.version} - Online` : "OpenClaw - Offline"}
    >
      <div
        className={`h-2 w-2 rounded-full ${
          status === null
            ? "bg-[#83769c]"
            : status.online
            ? "bg-[#00e436] animate-pulse"
            : "bg-[#ff004d]"
        }`}
      />
      <span className="hidden font-pixel text-[8px] text-[#83769c] sm:inline">
        {status?.online ? "ONLINE" : "OFFLINE"}
      </span>
    </Link>
  );
}
