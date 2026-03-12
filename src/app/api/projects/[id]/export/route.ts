import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const format: "pdf" | "excel" = body.format ?? "pdf";

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Export generation will be handled client-side using jspdf/xlsx
  // This endpoint provides the structured data needed for export
  return NextResponse.json({
    project: {
      title: project.title,
      confirmed_info: project.confirmed_info,
      monte_carlo: project.monte_carlo,
      selected_scenario: project.selected_scenario,
      risks: project.risks,
      hard_soft_ratio: project.hard_soft_ratio,
      csi_divisions: project.csi_divisions,
      final_hard_cost: project.final_hard_cost,
      final_soft_cost: project.final_soft_cost,
      final_total_cost: project.final_total_cost,
      final_cost_summary: project.final_cost_summary,
      ai_guesses: project.ai_guesses,
      ai_evidence: project.ai_evidence,
    },
    format,
  });
}
