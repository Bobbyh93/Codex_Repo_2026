import {
  getAuthenticatedEmail,
  updateReviewItem,
  type ReviewUpdatePayload,
} from "@/lib/review-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const updatedBy = getAuthenticatedEmail(request);

  if (!updatedBy) {
    return Response.json(
      { error: "Authenticated workspace user required." },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as ReviewUpdatePayload;
    const item = await updateReviewItem(id, payload, updatedBy);

    if (!item) {
      return Response.json({ error: "Review item not found." }, { status: 404 });
    }

    return Response.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 400 });
  }
}
