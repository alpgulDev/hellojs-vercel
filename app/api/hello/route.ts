export async function GET() {
  const response = await fetch("https://api.vercel.app/products", {
    headers: { accept: "application/json" },
  })

  if (!response.ok) {
    return Response.json(
      { error: "Unable to fetch products" },
      { status: response.status },
    )
  }

  return Response.json(await response.json())
}
