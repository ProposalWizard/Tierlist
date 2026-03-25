export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** DELETE — remove a saved profile image */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS ensures only the owner can delete
  const { error } = await supabase
    .from("saved_profile_images")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
