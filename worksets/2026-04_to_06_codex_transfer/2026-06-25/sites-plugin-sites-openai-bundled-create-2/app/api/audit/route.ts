import { getAuditPayload } from "@/lib/review-store";

export async function GET(request: Request) {
  try {
    return Response.json(await getAuditPayload(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
