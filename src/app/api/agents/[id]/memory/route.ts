/**
 * Agent Memory API
 *
 * GET: Read agent's MEMORY.md
 * PUT: Update agent's MEMORY.md
 *
 * Memory file locations (in priority order):
 * 1. ~/.openclaw/agents/{agentId}/MEMORY.md
 * 2. ~/.openclaw/workspace-{agentId}/MEMORY.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import { parseMemory, type ParsedMemory } from '@/lib/memory/parser';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME
  ? resolve(process.env.OPENCLAW_HOME.replace(/^~/, homedir()))
  : resolve(homedir(), '.openclaw');

/**
 * Get possible MEMORY.md paths for an agent.
 */
function getMemoryPaths(agentId: string): string[] {
  return [
    resolve(OPENCLAW_HOME, 'agents', agentId, 'MEMORY.md'),
    resolve(OPENCLAW_HOME, `workspace-${agentId}`, 'MEMORY.md'),
  ];
}

/**
 * Find the existing MEMORY.md path or return the preferred path for creation.
 */
async function findMemoryPath(agentId: string): Promise<{ path: string; exists: boolean }> {
  const paths = getMemoryPaths(agentId);

  for (const path of paths) {
    try {
      await access(path);
      return { path, exists: true };
    } catch {
      // Continue to next path
    }
  }

  // Return the first path as the preferred location for new files
  return { path: paths[0], exists: false };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: agentId } = await params;

  if (!agentId) {
    return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
  }

  try {
    const { path, exists } = await findMemoryPath(agentId);

    if (!exists) {
      // Return empty memory structure if file doesn't exist
      const emptyMemory: ParsedMemory = {
        sections: [],
        raw: '',
      };
      return NextResponse.json({
        agentId,
        path,
        exists: false,
        memory: emptyMemory,
      });
    }

    const content = await readFile(path, 'utf-8');
    const memory = parseMemory(content);

    return NextResponse.json({
      agentId,
      path,
      exists: true,
      memory,
    });
  } catch (error) {
    console.error(`[memory] Failed to read memory for ${agentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to read memory file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: agentId } = await params;

  if (!agentId) {
    return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
        { status: 400 }
      );
    }

    const { path } = await findMemoryPath(agentId);

    // Ensure directory exists
    await mkdir(dirname(path), { recursive: true });

    // Write the content
    await writeFile(path, content, 'utf-8');

    // Parse and return the updated memory
    const memory = parseMemory(content);

    return NextResponse.json({
      agentId,
      path,
      success: true,
      memory,
    });
  } catch (error) {
    console.error(`[memory] Failed to write memory for ${agentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to write memory file' },
      { status: 500 }
    );
  }
}
