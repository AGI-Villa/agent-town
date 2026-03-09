"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AgentAvatar } from "@/components/feed/AgentAvatar";

interface Notification {
  id: string;
  agent_id: string;
  content: string;
  event_id: string | null;
  read: boolean;
  created_at: string;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN");
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    setIsLoading(true);
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        aria-label={`通知 ${unreadCount > 0 ? `(${unreadCount}条未读)` : ""}`}
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#ff004d] text-white font-pixel text-[8px] rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-[#1d2b53] border-2 border-[#5f574f] rounded-lg shadow-xl z-50">
          <div className="sticky top-0 bg-[#1d2b53] border-b border-[#5f574f] px-3 py-2">
            <h3 className="font-pixel text-[10px] text-[#fff1e8]">通知</h3>
          </div>

          {notifications.length === 0 ? (
            <div className="p-4 text-center">
              <p className="font-pixel text-[9px] text-[#83769c]">暂无通知</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#5f574f]/50">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`p-3 hover:bg-white/5 transition-colors cursor-pointer ${
                    !notification.read ? "bg-[#29adff]/10" : ""
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex gap-2.5">
                    <AgentAvatar agentId={notification.agent_id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-pixel text-[9px] text-[#fff1e8] leading-relaxed break-words">
                        {notification.content}
                      </p>
                      <p className="font-pixel text-[8px] text-[#83769c] mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-[#29adff] rounded-full shrink-0 mt-1" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="font-pixel text-[9px] text-[#fff1e8]">...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
