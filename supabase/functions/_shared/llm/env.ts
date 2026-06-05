export function envGet(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno.env?.get) {
    const v = Deno.env.get(key)
    return v?.trim() || undefined
  }
  return undefined
}

function warnKeyMismatch(name: string, hint: string): void {
  console.warn(`[llm] ${name} ignored: ${hint}`)
}

/** OpenAI keys start with sk-proj- or sk- (not sk-ant-). */
export function openaiEnabled(): boolean {
  const flag = envGet('OPENAI_DISABLED')?.toLowerCase()
  return flag !== 'true' && flag !== '1'
}

export function openaiApiKey(): string | undefined {
  if (!openaiEnabled()) return undefined
  const key = envGet('OPENAI_API_KEY')
  if (!key) return undefined
  if (key.startsWith('sk-ant-')) {
    warnKeyMismatch('OPENAI_API_KEY', 'this is an Anthropic key — use ANTHROPIC_API_KEY')
    return undefined
  }
  if (key.startsWith('AQ.') || key.startsWith('AIza')) {
    warnKeyMismatch('OPENAI_API_KEY', 'this is a Google/Gemini key — use GEMINI_API_KEY')
    return undefined
  }
  if (key.startsWith('gsk_')) {
    warnKeyMismatch('OPENAI_API_KEY', 'this is a Groq key — use GROQ_API_KEY')
    return undefined
  }
  if (!key.startsWith('sk-')) {
    warnKeyMismatch('OPENAI_API_KEY', 'expected OpenAI key starting with sk-')
    return undefined
  }
  return key
}

/** Google AI Studio keys: AIza... or AQ.... */
export function geminiApiKey(): string | undefined {
  const key = envGet('GEMINI_API_KEY') ?? envGet('GOOGLE_API_KEY')
  if (!key) return undefined
  if (key.startsWith('sk-ant-')) {
    warnKeyMismatch('GEMINI_API_KEY', 'this is an Anthropic key')
    return undefined
  }
  if (key.startsWith('sk-') && !key.startsWith('sk-ant-')) {
    warnKeyMismatch('GEMINI_API_KEY', 'this is an OpenAI key — use OPENAI_API_KEY')
    return undefined
  }
  if (key.startsWith('gsk_')) {
    warnKeyMismatch('GEMINI_API_KEY', 'this is a Groq key')
    return undefined
  }
  return key
}

export function groqApiKey(): string | undefined {
  const key = envGet('GROQ_API_KEY')
  if (!key) return undefined
  if (!key.startsWith('gsk_')) {
    warnKeyMismatch('GROQ_API_KEY', 'expected Groq key starting with gsk_')
    return undefined
  }
  return key
}

/** Set ANTHROPIC_DISABLED=true to stop all Claude calls (large cost savings). */
export function anthropicEnabled(): boolean {
  const flag = envGet('ANTHROPIC_DISABLED')?.toLowerCase()
  return flag !== 'true' && flag !== '1'
}

export function anthropicApiKey(): string | undefined {
  if (!anthropicEnabled()) return undefined
  const key = envGet('ANTHROPIC_API_KEY')
  if (!key) return undefined
  if (!key.startsWith('sk-ant-')) {
    warnKeyMismatch('ANTHROPIC_API_KEY', 'expected Anthropic key starting with sk-ant-')
    return undefined
  }
  return key
}

/**
 * Default for Google AI Studio new projects (2026).
 * https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview
 */
export function geminiModelId(): string {
  return envGet('GEMINI_MODEL') ?? 'gemini-2.5-flash'
}

export function geminiModelFallback(): string {
  return envGet('GEMINI_MODEL_FALLBACK') ?? 'gemini-3-flash-preview'
}

export function geminiModelCandidates(): string[] {
  const primary = geminiModelId()
  const fallback = geminiModelFallback()
  return primary === fallback ? [primary] : [primary, fallback]
}

export function providerHasKey(provider: 'openai' | 'gemini' | 'groq' | 'anthropic'): boolean {
  switch (provider) {
    case 'openai':
      return Boolean(openaiApiKey())
    case 'gemini':
      return Boolean(geminiApiKey())
    case 'groq':
      return Boolean(groqApiKey())
    case 'anthropic':
      return Boolean(anthropicApiKey())
  }
}

export function anyLlmProviderConfigured(): boolean {
  return (
    providerHasKey('openai') ||
    providerHasKey('gemini') ||
    providerHasKey('groq') ||
    providerHasKey('anthropic')
  )
}

export function llmConfigError(): string {
  return (
    'No valid LLM API keys configured. Set Supabase secrets with correct key per provider: ' +
    'OPENAI_API_KEY (sk-...), GEMINI_API_KEY (from AI Studio), GROQ_API_KEY (gsk_...), ANTHROPIC_API_KEY (sk-ant-...).'
  )
}

export function forcedProviderFromEnv(): 'openai' | 'gemini' | 'groq' | 'anthropic' | null {
  const raw = envGet('SYMPTOM_LLM_FORCE_PROVIDER')?.toLowerCase()
  if (raw === 'openai' || raw === 'gemini' || raw === 'groq' || raw === 'anthropic') {
    return raw
  }
  return null
}
