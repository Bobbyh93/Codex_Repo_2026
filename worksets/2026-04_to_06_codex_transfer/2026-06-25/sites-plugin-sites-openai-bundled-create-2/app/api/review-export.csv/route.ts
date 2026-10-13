import { buildReviewCsv } from "@/lib/review-store";

export async function GET() {
  try {
    const csv = await buildReviewCsv();

    return new Response(csv, {
      headers: {
        "content-disposition": 'attachment; filename="pearson-review-state.csv"',
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
