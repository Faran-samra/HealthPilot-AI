/** Adapt JSON Schema tool definitions for Gemini function calling. */

function upperType(value: unknown): unknown {
  if (typeof value === 'string' && ['object', 'string', 'array', 'number', 'integer', 'boolean'].includes(value)) {
    return value.toUpperCase()
  }
  return value
}

function stripUnsupported(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(node)) {
    if (key === 'maxItems' || key === 'minItems' || key === 'additionalProperties') continue
    if (key === 'type') {
      out.type = upperType(val)
      continue
    }
    if (key === 'properties' && val && typeof val === 'object') {
      const props: Record<string, unknown> = {}
      for (const [pk, pv] of Object.entries(val as Record<string, unknown>)) {
        props[pk] = typeof pv === 'object' && pv !== null && !Array.isArray(pv)
          ? stripUnsupported(pv as Record<string, unknown>)
          : pv
      }
      out.properties = props
      continue
    }
    if (key === 'items' && val && typeof val === 'object' && !Array.isArray(val)) {
      out.items = stripUnsupported(val as Record<string, unknown>)
      continue
    }
    out[key] = val
  }
  return out
}

export function toolSchemaForGemini(inputSchema: Record<string, unknown>): Record<string, unknown> {
  return stripUnsupported({ ...inputSchema, type: inputSchema.type ?? 'object' })
}
