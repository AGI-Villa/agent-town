"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  agentIds: string[];
  isDefault?: boolean;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  setCurrentWorkspace: (workspaceId: string) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
  initialWorkspaceId?: string;
}

export function WorkspaceProvider({ children, initialWorkspaceId }: WorkspaceProviderProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(initialWorkspaceId ?? "default");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch workspaces on mount
  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const res = await fetch("/api/workspaces");
        if (res.ok) {
          const data = await res.json();
          setWorkspaces(data.workspaces);
          
          // If initial workspace doesn't exist, fall back to default
          const exists = data.workspaces.some((ws: Workspace) => ws.id === currentWorkspaceId);
          if (!exists && data.workspaces.length > 0) {
            setCurrentWorkspaceId(data.defaultWorkspaceId ?? data.workspaces[0].id);
          }
        }
      } catch (err) {
        console.error("[WorkspaceProvider] Failed to fetch workspaces:", err);
        // Fallback to default workspace
        setWorkspaces([{
          id: "default",
          name: "Default Team",
          agentIds: [],
          isDefault: true,
        }]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkspaces();
  }, [currentWorkspaceId]);

  // Update URL when workspace changes
  const setCurrentWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    
    // Update URL without full page reload
    const url = new URL(window.location.href);
    if (workspaceId === "default") {
      url.searchParams.delete("workspace");
    } else {
      url.searchParams.set("workspace", workspaceId);
    }
    window.history.pushState({}, "", url.toString());
  }, []);

  const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId) ?? {
    id: "default",
    name: "Default Team",
    agentIds: [],
    isDefault: true,
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
