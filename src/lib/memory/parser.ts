/**
 * MEMORY.md Parser
 *
 * Parses markdown-formatted memory files into structured data.
 * Supports sections (## headings) and items (- list items).
 */

export interface MemoryItem {
  content: string;
  date?: string;
}

export interface MemorySection {
  title: string;
  items: MemoryItem[];
}

export interface ParsedMemory {
  sections: MemorySection[];
  raw: string;
}

/**
 * Extract date from memory item content.
 * Supports formats like: [2024-03-15], (2024-03-15), 2024-03-15:
 */
function extractDate(content: string): { content: string; date?: string } {
  // Match [YYYY-MM-DD] or (YYYY-MM-DD) at start or end
  const datePatterns = [
    /^\[(\d{4}-\d{2}-\d{2})\]\s*/,
    /^\((\d{4}-\d{2}-\d{2})\)\s*/,
    /^(\d{4}-\d{2}-\d{2}):\s*/,
    /\s*\[(\d{4}-\d{2}-\d{2})\]$/,
    /\s*\((\d{4}-\d{2}-\d{2})\)$/,
  ];

  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        content: content.replace(pattern, '').trim(),
        date: match[1],
      };
    }
  }

  return { content };
}

/**
 * Parse MEMORY.md content into structured sections.
 */
export function parseMemory(content: string): ParsedMemory {
  const lines = content.split('\n');
  const sections: MemorySection[] = [];
  let currentSection: MemorySection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section header (## Title)
    if (trimmed.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: trimmed.slice(3).trim(),
        items: [],
      };
      continue;
    }

    // Check for list item (- content or * content)
    if (currentSection && /^[-*]\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[-*]\s+/, '');
      const { content: cleanContent, date } = extractDate(itemContent);
      currentSection.items.push({
        content: cleanContent,
        date,
      });
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return {
    sections,
    raw: content,
  };
}

/**
 * Serialize structured memory back to markdown format.
 */
export function serializeMemory(memory: ParsedMemory): string {
  const lines: string[] = [];

  for (const section of memory.sections) {
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
}

/**
 * Add a new item to a section (creates section if not exists).
 */
export function addMemoryItem(
  memory: ParsedMemory,
  sectionTitle: string,
  item: MemoryItem
): ParsedMemory {
  const sections = [...memory.sections];
  const existingSection = sections.find((s) => s.title === sectionTitle);

  if (existingSection) {
    existingSection.items = [...existingSection.items, item];
  } else {
    sections.push({
      title: sectionTitle,
      items: [item],
    });
  }

  return {
    sections,
    raw: serializeMemory({ sections, raw: '' }),
  };
}

/**
 * Remove an item from a section by index.
 */
export function removeMemoryItem(
  memory: ParsedMemory,
  sectionTitle: string,
  itemIndex: number
): ParsedMemory {
  const sections = memory.sections.map((section) => {
    if (section.title === sectionTitle) {
      return {
        ...section,
        items: section.items.filter((_, i) => i !== itemIndex),
      };
    }
    return section;
  });

  // Remove empty sections
  const filteredSections = sections.filter((s) => s.items.length > 0);

  return {
    sections: filteredSections,
    raw: serializeMemory({ sections: filteredSections, raw: '' }),
  };
}

/**
 * Update an item in a section.
 */
export function updateMemoryItem(
  memory: ParsedMemory,
  sectionTitle: string,
  itemIndex: number,
  newItem: MemoryItem
): ParsedMemory {
  const sections = memory.sections.map((section) => {
    if (section.title === sectionTitle) {
      return {
        ...section,
        items: section.items.map((item, i) => (i === itemIndex ? newItem : item)),
      };
    }
    return section;
  });

  return {
    sections,
    raw: serializeMemory({ sections, raw: '' }),
  };
}

/**
 * Get recent items across all sections.
 */
export function getRecentItems(memory: ParsedMemory, limit: number = 5): MemoryItem[] {
  const allItems: (MemoryItem & { sectionTitle: string })[] = [];

  for (const section of memory.sections) {
    for (const item of section.items) {
      allItems.push({ ...item, sectionTitle: section.title });
    }
  }

  // Sort by date if available, otherwise keep original order
  allItems.sort((a, b) => {
    if (a.date && b.date) {
      return b.date.localeCompare(a.date);
    }
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  return allItems.slice(0, limit);
}

/**
 * Search items by keyword.
 */
export function searchMemory(
  memory: ParsedMemory,
  query: string
): (MemoryItem & { sectionTitle: string })[] {
  const results: (MemoryItem & { sectionTitle: string })[] = [];
  const lowerQuery = query.toLowerCase();

  for (const section of memory.sections) {
    for (const item of section.items) {
      if (item.content.toLowerCase().includes(lowerQuery)) {
        results.push({ ...item, sectionTitle: section.title });
      }
    }
  }

  return results;
}
