import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Moment = Database["public"]["Tables"]["moments"]["Row"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: momentRaw, error: fetchError } = await supabase
      .from("moments")
      .select("likes")
      .eq("id", id)
      .single();

    if (fetchError || !momentRaw) {
      return NextResponse.json({ error: "Moment not found" }, { status: 404 });
    }

    const moment = momentRaw as Moment;
    const newLikes = moment.likes + 1;

    const { error: updateError } = await supabase
      .from("moments")
      .update({ likes: newLikes } as never)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to like moment" }, { status: 500 });
    }

    return NextResponse.json({ likes: newLikes });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
