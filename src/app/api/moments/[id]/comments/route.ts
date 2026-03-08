import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Comment = Database["public"]["Tables"]["comments"]["Row"];
type CommentInsert = Database["public"]["Tables"]["comments"]["Insert"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("moment_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    return NextResponse.json((data ?? []) as Comment[]);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify moment exists
    const { data: moment, error: momentError } = await supabase
      .from("moments")
      .select("id")
      .eq("id", id)
      .single();

    if (momentError || !moment) {
      return NextResponse.json({ error: "Moment not found" }, { status: 404 });
    }

    const insertData: CommentInsert = {
      moment_id: id,
      author_type: body.author_type || "visitor",
      author_id: body.author_id || "anonymous",
      content: body.content.trim(),
    };

    const { data, error } = await supabase
      .from("comments")
      .insert(insertData as never)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    return NextResponse.json(data as Comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
