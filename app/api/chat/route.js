export async function POST() {
  return Response.json(
    {
      error: "AI chat is not enabled for this prototype yet."
    },
    { status: 501 }
  );
}
