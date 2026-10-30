import dgram from "node:dgram"

export const runtime = "nodejs"

const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 } as const

type QueryType = keyof typeof TYPES

type Answer = { name: string; type: number; ttl: number; data: string }

function buildQuery(name: string, type: QueryType) {
  const id = Math.floor(Math.random() * 65536)
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(0x0100, 2)
  header.writeUInt16BE(1, 4)
  const labels = name.split(".").filter(Boolean).map((label) => {
    const bytes = Buffer.from(label)
    if (bytes.length > 63) throw new Error("DNS label is too long")
    return Buffer.concat([Buffer.from([bytes.length]), bytes])
  })
  const tail = Buffer.from([0, TYPES[type] >> 8, TYPES[type] & 255, 0, 1])
  return { id, packet: Buffer.concat([header, ...labels, tail]) }
}

function readName(buffer: Buffer, offset: number): [string, number] {
  const parts: string[] = []
  let end = -1
  let jumps = 0
  for (;;) {
    if (offset >= buffer.length || jumps++ > 20) throw new Error("Invalid DNS name")
    const length = buffer[offset]
    if (length === 0) return [parts.join("."), end < 0 ? offset + 1 : end]
    if ((length & 0xc0) === 0xc0) {
      if (offset + 1 >= buffer.length) throw new Error("Invalid DNS pointer")
      if (end < 0) end = offset + 2
      offset = ((length & 0x3f) << 8) | buffer[offset + 1]
      continue
    }
    if (length > 63 || offset + 1 + length > buffer.length) throw new Error("Invalid DNS label")
    parts.push(buffer.toString("utf8", offset + 1, offset + 1 + length))
    offset += 1 + length
  }
}

function parseResponse(buffer: Buffer) {
  if (buffer.length < 12) throw new Error("DNS response is too short")
  const flags = buffer.readUInt16BE(2)
  const rcode = flags & 0xf
  const truncated = Boolean(flags & 0x0200)
  const questionCount = buffer.readUInt16BE(4)
  const answerCount = buffer.readUInt16BE(6)
  let offset = 12

  for (let index = 0; index < questionCount; index++) offset = readName(buffer, offset)[1] + 4

  const answers: Answer[] = []
  for (let index = 0; index < answerCount; index++) {
    const [name, nextOffset] = readName(buffer, offset)
    offset = nextOffset
    if (offset + 10 > buffer.length) throw new Error("Invalid DNS answer")
    const type = buffer.readUInt16BE(offset)
    const ttl = buffer.readUInt32BE(offset + 4)
    const dataLength = buffer.readUInt16BE(offset + 8)
    const dataOffset = offset + 10
    if (dataOffset + dataLength > buffer.length) throw new Error("Invalid DNS record data")

    let data: string
    if (type === 1 && dataLength === 4) data = [...buffer.subarray(dataOffset, dataOffset + 4)].join(".")
    else if (type === 28 && dataLength === 16) {
      const groups: string[] = []
      for (let index = 0; index < 16; index += 2) groups.push(buffer.readUInt16BE(dataOffset + index).toString(16))
      data = groups.join(":")
    } else if (type === 2 || type === 5) data = readName(buffer, dataOffset)[0]
    else if (type === 15) data = `${buffer.readUInt16BE(dataOffset)} ${readName(buffer, dataOffset + 2)[0]}`
    else if (type === 16) {
      const values: string[] = []
      for (let position = dataOffset; position < dataOffset + dataLength;) {
        const length = buffer[position]
        values.push(buffer.toString("utf8", position + 1, position + 1 + length))
        position += 1 + length
      }
      data = values.join("")
    } else data = `(type ${type}, ${dataLength} bytes)`

    answers.push({ name, type, ttl, data })
    offset = dataOffset + dataLength
  }

  return { rcode, truncated, answers }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const name = url.searchParams.get("name") || "example.com"
  const requestedType = (url.searchParams.get("type") || "A").toUpperCase() as QueryType
  const server = url.searchParams.get("server") || process.env.DNS_SERVER_HOST || "1.1.1.1"
  const port = Number(url.searchParams.get("port") || process.env.DNS_SERVER_PORT || "53")

  if (!(requestedType in TYPES) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Response.json({ ok: false, error: "Use a supported type and a valid UDP port" }, { status: 400 })
  }

  const result = await new Promise<Record<string, unknown>>((resolve) => {
    const socket = dgram.createSocket("udp4")
    const started = process.hrtime.bigint()
    let query
    try {
      query = buildQuery(name, requestedType)
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : "Invalid DNS query" })
      socket.close()
      return
    }

    const timer = setTimeout(() => finish({ ok: false, error: "Timeout: UDP response not received" }), 3000)
    const finish = (value: Record<string, unknown>) => {
      clearTimeout(timer)
      try { socket.close() } catch {}
      resolve(value)
    }

    socket.once("error", (error) => finish({ ok: false, error: error.message }))
    socket.once("message", (message) => {
      try {
        if (message.readUInt16BE(0) !== query.id) return
        finish({ ok: true, server, port, size: message.length, ms: Number(process.hrtime.bigint() - started) / 1e6, ...parseResponse(message) })
      } catch (error) {
        finish({ ok: false, error: error instanceof Error ? error.message : "Invalid DNS response" })
      }
    })
    socket.send(query.packet, port, server, (error) => {
      if (error) finish({ ok: false, error: error.message })
    })
  })

  return Response.json(result)
}
