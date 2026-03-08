'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SocialInteraction } from '@/game/systems/SocialInteractionSystem';

interface InteractionHistoryProps {
  maxItems?: number;
  onInteractionClick?: (interaction: SocialInteraction) => void;
}

export function InteractionHistory({
  maxItems = 20,
  onInteractionClick,
}: InteractionHistoryProps) {
  const [interactions, setInteractions] = useState<SocialInteraction[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const addInteraction = useCallback((interaction: SocialInteraction) => {
    setInteractions((prev) => {
      const updated = [interaction, ...prev].slice(0, maxItems);
      return updated;
    });
  }, [maxItems]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInteractionIcon = (type: SocialInteraction['type']) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'like':
        return '❤️';
      case 'mention':
        return '@';
      default:
        return '•';
    }
  };

  const getInteractionText = (interaction: SocialInteraction) => {
    switch (interaction.type) {
      case 'comment':
        return `${interaction.fromAgentId} → ${interaction.toAgentId}: "${interaction.content?.slice(0, 30)}${(interaction.content?.length ?? 0) > 30 ? '...' : ''}"`;
      case 'like':
        return `${interaction.fromAgentId} liked ${interaction.toAgentId}'s post`;
      case 'mention':
        return `${interaction.fromAgentId} mentioned ${interaction.toAgentId}`;
      default:
        return `${interaction.fromAgentId} → ${interaction.toAgentId}`;
    }
  };

  // Expose addInteraction for external use
  useEffect(() => {
    (window as unknown as { addInteraction?: typeof addInteraction }).addInteraction = addInteraction;
    return () => {
      delete (window as unknown as { addInteraction?: typeof addInteraction }).addInteraction;
    };
  }, [addInteraction]);

  return (
    <div className="bg-slate-800/90 rounded-lg text-white text-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/50 rounded-t-lg transition-colors"
      >
        <span className="font-medium">Interactions</span>
        <span className="text-slate-400 text-xs">
          {interactions.length} {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {/* List */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto border-t border-slate-700">
          {interactions.length === 0 ? (
            <div className="px-3 py-4 text-slate-500 text-center text-xs">
              No interactions yet
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/50">
              {interactions.map((interaction) => (
                <li
                  key={interaction.id}
                  onClick={() => onInteractionClick?.(interaction)}
                  className="px-3 py-2 hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base">
                      {getInteractionIcon(interaction.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">
                        {getInteractionText(interaction)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatTime(interaction.timestamp)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to connect to SocialInteractionSystem
export function useInteractionHistory(
  system: { onInteraction?: (cb: (i: SocialInteraction) => void) => () => void } | null
) {
  const [interactions, setInteractions] = useState<SocialInteraction[]>([]);

  useEffect(() => {
    if (!system?.onInteraction) return;

    const unsubscribe = system.onInteraction((interaction) => {
      setInteractions((prev) => [interaction, ...prev].slice(0, 50));
    });

    return unsubscribe;
  }, [system]);

  return interactions;
}
