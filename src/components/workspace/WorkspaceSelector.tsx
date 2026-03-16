"use client";

import { useWorkspace } from "./WorkspaceContext";
import { Building2, ChevronDown, Check, Share2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function WorkspaceSelector() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, isLoading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = new URL(window.location.href);
    if (currentWorkspace.id !== "default") {
      url.searchParams.set("workspace", currentWorkspace.id);
    }
    
    try {
      await navigator.clipboard.writeText(url.toString());
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      console.log("Share URL:", url.toString());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 animate-pulse">
        <Building2 className="w-4 h-4 text-slate-500" />
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    );
  }

  // Don't show selector if only one workspace
  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-slate-700/50"
      >
        <Building2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm text-slate-200 max-w-[120px] truncate">
          {currentWorkspace.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Workspaces</span>
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-blue-400 transition-colors"
                title="Copy workspace URL"
              >
                <Share2 className="w-3 h-3" />
                {showCopied ? "Copied!" : "Share"}
              </button>
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => {
                  setCurrentWorkspace(workspace.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/50 transition-colors ${
                  workspace.id === currentWorkspace.id ? "bg-slate-700/30" : ""
                }`}
              >
                <Building2 className={`w-4 h-4 ${
                  workspace.id === currentWorkspace.id ? "text-blue-400" : "text-slate-500"
                }`} />
                <div className="flex-1 text-left">
                  <div className="text-sm text-slate-200">{workspace.name}</div>
                  {workspace.description && (
                    <div className="text-xs text-slate-500 truncate">{workspace.description}</div>
                  )}
                </div>
                {workspace.id === currentWorkspace.id && (
                  <Check className="w-4 h-4 text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
