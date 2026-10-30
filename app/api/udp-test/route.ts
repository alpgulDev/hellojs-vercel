import dgram from "node:dgram"

export const runtime = "nodejs"

export async function GET() {
  const host = process.env.UDP_SERVER_HOST
  const port = Number(process.env.UDP_SERVER_PORT ?? "12345")

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Response.json(
      { ok: false, error: "UDP_SERVER_HOST and a valid UDP_SERVER_PORT are required" },
      { status: 500 },
    )
  }

  const result = await new Promise<{ ok: boolean; reply?: string; error?: string }>((resolve) => {
    const socket = dgram.createSocket("udp4")
    const timeout = setTimeout(() => finish({ ok: false, error: "Timeout" }), 5000)

    function finish(value: { ok: boolean; reply?: string; error?: string }) {
      clearTimeout(timeout)
      try {
        socket.close()
      } catch {}
      resolve(value)
    }

    socket.once("error", (error) => finish({ ok: false, error: error.message }))
    socket.once("message", (message) => finish({ ok: true, reply: message.toString() }))
    socket.send("vercel-udp-test", port, host, (error) => {
      if (error) finish({ ok: false, error: error.message })
    })
  })

  return Response.json(result)
}
