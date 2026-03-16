'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ParsedMemory, MemorySection, MemoryItem } from '@/lib/memory/parser';

interface MemoryEditorProps {
  agentId: string;
  onClose?: () => void;
}

export function MemoryEditor({ agentId, onClose }: MemoryEditorProps) {
  const [memory, setMemory] = useState<ParsedMemory | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'structured' | 'raw'>('structured');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const fetchMemory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/memory`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setMemory(data.memory);
      setRawContent(data.memory.raw || '');
      // Expand all sections by default
      setExpandedSections(new Set(data.memory.sections.map((s: MemorySection) => s.title)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/memory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rawContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMemory(data.memory);
      setEditMode('structured');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const addItem = (sectionTitle: string) => {
    if (!memory) return;
    const newItem: MemoryItem = { content: '新记忆条目' };
    const updatedSections = memory.sections.map((section) => {
      if (section.title === sectionTitle) {
        return { ...section, items: [...section.items, newItem] };
      }
      return section;
    });
    const newRaw = serializeSections(updatedSections);
    setMemory({ sections: updatedSections, raw: newRaw });
    setRawContent(newRaw);
  };

  const addSection = () => {
    if (!memory) return;
    const newSection: MemorySection = { title: '新分类', items: [] };
    const updatedSections = [...memory.sections, newSection];
    const newRaw = serializeSections(updatedSections);
    setMemory({ sections: updatedSections, raw: newRaw });
    setRawContent(newRaw);
    setExpandedSections((prev) => new Set([...prev, '新分类']));
  };

  const deleteItem = (sectionTitle: string, itemIndex: number) => {
    if (!memory) return;
    const updatedSections = memory.sections
      .map((section) => {
        if (section.title === sectionTitle) {
          return {
            ...section,
            items: section.items.filter((_, i) => i !== itemIndex),
          };
        }
        return section;
      })
      .filter((s) => s.items.length > 0);
    const newRaw = serializeSections(updatedSections);
    setMemory({ sections: updatedSections, raw: newRaw });
    setRawContent(newRaw);
  };

  const updateItem = (sectionTitle: string, itemIndex: number, newContent: string) => {
    if (!memory) return;
    const updatedSections = memory.sections.map((section) => {
      if (section.title === sectionTitle) {
        return {
          ...section,
          items: section.items.map((item, i) =>
            i === itemIndex ? { ...item, content: newContent } : item
          ),
        };
      }
      return section;
    });
    const newRaw = serializeSections(updatedSections);
    setMemory({ sections: updatedSections, raw: newRaw });
    setRawContent(newRaw);
  };

  const serializeSections = (sections: MemorySection[]): string => {
    const lines: string[] = [];
    for (const section of sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      for (const item of section.items) {
        if (item.date) {
          lines.push(`- [${item.date}] ${item.content}`);
        } else {
          lines.push(`- ${item.content}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n').trim() + '\n';
  };

  const filteredSections = memory?.sections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (section.title.toLowerCase().includes(query)) return true;
    return section.items.some((item) => item.content.toLowerCase().includes(query));
  });

  if (loading) {
    return (
      <div className="p-4 text-center">
        <span className="font-pixel text-xs text-[#c2c3c7] animate-pulse">加载中...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#29366f] border-b-2 border-[#5f574f]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <h2 className="font-pixel text-sm text-[#fff1e8]">记忆管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(editMode === 'structured' ? 'raw' : 'structured')}
            className="font-pixel text-[10px] text-[#c2c3c7] hover:text-[#fff1e8] px-2 py-1 bg-[#5f574f]/30 rounded"
          >
            {editMode === 'structured' ? '📝 原始' : '📋 结构'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="font-pixel text-xs text-[#ff004d] hover:text-[#fff1e8] px-2 py-1"
            >
              [X]
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-[#ff004d]/20 border-b border-[#ff004d]">
          <span className="font-pixel text-[10px] text-[#ff004d]">{error}</span>
        </div>
      )}

      {editMode === 'raw' ? (
        /* Raw Editor */
        <div className="flex-1 flex flex-col p-4">
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            className="flex-1 w-full bg-[#000]/30 border border-[#5f574f] rounded p-3 font-mono text-sm text-[#fff1e8] resize-none focus:outline-none focus:border-[#29adff]"
            placeholder="# MEMORY.md&#10;&#10;## 分类名称&#10;- 记忆条目"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setRawContent(memory?.raw || '');
                setEditMode('structured');
              }}
              className="font-pixel text-xs text-[#c2c3c7] hover:text-[#fff1e8] px-3 py-2 bg-[#5f574f]/30 rounded"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="font-pixel text-xs text-[#fff1e8] px-3 py-2 bg-[#29adff] hover:bg-[#29adff]/80 rounded disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        /* Structured View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索记忆..."
              className="w-full bg-[#000]/30 border border-[#5f574f] rounded px-3 py-2 font-pixel text-xs text-[#fff1e8] focus:outline-none focus:border-[#29adff]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sections */}
          {filteredSections && filteredSections.length > 0 ? (
            filteredSections.map((section) => (
              <div
                key={section.title}
                className="bg-[#000]/20 border border-[#5f574f] rounded overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#5f574f]/20 hover:bg-[#5f574f]/30"
                >
                  <span className="font-pixel text-xs text-[#ffa300]">
                    {expandedSections.has(section.title) ? '▼' : '▶'} {section.title}
                  </span>
                  <span className="font-pixel text-[10px] text-[#83769c]">
                    {section.items.length} 条
                  </span>
                </button>

                {/* Section Items */}
                {expandedSections.has(section.title) && (
                  <div className="p-2 space-y-2">
                    {section.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 bg-[#000]/20 rounded p-2 group"
                      >
                        <input
                          type="text"
                          value={item.content}
                          onChange={(e) => updateItem(section.title, idx, e.target.value)}
                          className="flex-1 bg-transparent font-pixel text-[10px] text-[#c2c3c7] focus:outline-none focus:text-[#fff1e8]"
                        />
                        {item.date && (
                          <span className="font-pixel text-[8px] text-[#83769c] shrink-0">
                            {item.date}
                          </span>
                        )}
                        <button
                          onClick={() => deleteItem(section.title, idx)}
                          className="font-pixel text-[10px] text-[#ff004d] opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addItem(section.title)}
                      className="w-full font-pixel text-[10px] text-[#29adff] hover:text-[#fff1e8] py-1 border border-dashed border-[#5f574f] rounded"
                    >
                      + 添加条目
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <span className="font-pixel text-xs text-[#83769c]">
                {searchQuery ? '未找到匹配的记忆' : '暂无记忆'}
              </span>
            </div>
          )}

          {/* Add Section Button */}
          {!searchQuery && (
            <button
              onClick={addSection}
              className="w-full font-pixel text-xs text-[#29adff] hover:text-[#fff1e8] py-2 border border-dashed border-[#5f574f] rounded"
            >
              + 添加分类
            </button>
          )}

          {/* Save Button */}
          {memory && rawContent !== memory.raw && (
            <div className="sticky bottom-0 pt-3 bg-gradient-to-t from-[#1d2b53] to-transparent">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full font-pixel text-xs text-[#fff1e8] py-2 bg-[#29adff] hover:bg-[#29adff]/80 rounded disabled:opacity-50"
              >
                {saving ? '保存中...' : '💾 保存更改'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
