import type { ToolDefinition } from './types.ts'

export const FOLLOW_UP_TOOL: ToolDefinition = {
  name: 'ask_follow_up',
  description:
    'Ask ONE concise follow-up question that directly relates to what the user already said. Never ask unrelated screening questions.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Single follow-up question, conversational tone' },
      quick_severity: {
        type: 'string',
        enum: ['mild', 'moderate', 'severe', 'emergency'],
        description: 'Preliminary severity estimate based on info so far',
      },
    },
    required: ['message', 'quick_severity'],
  },
}

const SPECIALTY_SLUG_ENUM = [
  'general', 'cardiology', 'dermatology', 'orthopedics', 'gynecology',
  'pediatrics', 'neurology', 'ent', 'ophthalmology', 'psychiatry',
  'urology', 'gastroenterology', 'endocrinology', 'pulmonology',
] as const

const LIST_FIELD_HINT =
  'Use a JSON array of strings OR one string with items separated by semicolons (max 5 items). Example: "Tip one; Tip two; Tip three"'

/** Tool schema tolerant of Groq/Llama (strings instead of arrays, optional display specialty). */
export const ANALYSIS_TOOL: ToolDefinition = {
  name: 'submit_symptom_analysis',
  description:
    'Final structured symptom analysis. All list fields must be present; use semicolon-separated strings if arrays are difficult.',
  input_schema: {
    type: 'object',
    properties: {
      primary_condition: { type: 'string', description: 'Main concern in plain language' },
      condition_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      brief_summary: { type: 'string' },
      possible_conditions: {
        type: 'string',
        description: LIST_FIELD_HINT,
      },
      recommended_specialty_slug: {
        type: 'string',
        enum: [...SPECIALTY_SLUG_ENUM],
        description: 'Specialty slug only (e.g. neurology for seizures)',
      },
      recommended_specialty: {
        type: 'string',
        description: 'Optional display name; omit if unsure — slug is enough',
      },
      severity_level: { type: 'string', enum: ['mild', 'moderate', 'severe', 'emergency'] },
      explanation: { type: 'string' },
      first_aid_tips: { type: 'string', description: LIST_FIELD_HINT },
      red_flags: { type: 'string', description: LIST_FIELD_HINT },
      disclaimer: { type: 'string' },
      urdu_summary: { type: 'string', description: '2-4 sentences for the patient in Urdu or Roman Urdu' },
    },
    required: [
      'brief_summary',
      'possible_conditions',
      'recommended_specialty_slug',
      'severity_level',
      'explanation',
      'first_aid_tips',
      'red_flags',
      'disclaimer',
      'urdu_summary',
    ],
  },
}
