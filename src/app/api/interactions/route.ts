import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('comments')
      .select(`
        id,
        agent_id,
        moment_id,
        content,
        created_at,
        moments!inner (
          agent_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      const sinceDate = new Date(parseInt(since, 10)).toISOString();
      query = query.gt('created_at', sinceDate);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching interactions:', error);
      return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
    }

    // Transform to SocialInteraction format
    const interactions = (comments || []).map((comment) => {
      const moments = comment.moments as unknown as { agent_id: string } | null;
      return {
        id: comment.id,
        fromAgentId: comment.agent_id,
        toAgentId: moments?.agent_id || 'unknown',
        type: 'comment' as const,
        content: comment.content,
        timestamp: new Date(comment.created_at).getTime(),
      };
    });

    return NextResponse.json(interactions);
  } catch (error) {
    console.error('Error in interactions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
