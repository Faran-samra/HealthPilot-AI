import { describe, expect, it } from 'vitest'
import { looksLikeHindiRomanUrdu } from './roman-urdu-quality.ts'
import {
  applySafetyRules,
  buildGuidedFallbackAnalysis,
  buildGuidedFollowUpFallback,
  shouldUseGuidedFastPath,
} from './safety.ts'
import type { SymptomAnalysis } from './schemas.ts'

const baseAnalysis: SymptomAnalysis = {
  brief_summary: 'Fatigue and weakness',
  possible_conditions: ['Dehydration', 'Dengue fever', 'Typhoid', 'Anemia'],
  recommended_specialty: 'General Physician',
  recommended_specialty_slug: 'general',
  severity_level: 'mild',
  explanation: 'Fatigue may be dehydration or dengue fever in Pakistan.',
  first_aid_tips: ['Rest'],
  red_flags: ['See a doctor if worse'],
  disclaimer: 'Guidance only.',
  urdu_summary: 'کمزوری کی وجہ مختلف ہو سکتی ہے۔',
}

describe('applySafetyRules', () => {
  it('removes infection differentials when user did not report fever', () => {
    const userText = 'kamzori feel hoti handpractice ki wajah se'
    const out = applySafetyRules(baseAnalysis, userText)
    expect(out.possible_conditions.some((c) => /dengue|typhoid/i.test(c))).toBe(false)
    expect(out.severity_level).toBe('moderate')
  })

  it('removes malaria when user only said yellow fever disease without real fever', () => {
    const userText = 'yellow fever disease no travel africa'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        possible_conditions: ['Viral Hepatitis', 'Malaria', 'Gallstones'],
      },
      userText
    )
    expect(out.possible_conditions.some((c) => /malaria/i.test(c))).toBe(false)
  })

  it('relabels arboviral Yellow Fever when user has jaundice without fever', () => {
    const userText =
      'yellow fever yellow eyes three days no fever jaundice yellowing skin'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        primary_condition: 'Yellow Fever',
        brief_summary: 'Yellow Fever',
        possible_conditions: ['Yellow Fever', 'Viral Hepatitis'],
      },
      userText
    )
    expect(out.primary_condition).toMatch(/jaundice/i)
    expect(out.possible_conditions.some((c) => /^yellow fever$/i.test(c.trim()))).toBe(false)
    expect(out.possible_conditions.some((c) => /hepatitis/i.test(c))).toBe(true)
  })

  it('removes breakthrough/medication-failure language when user never mentioned medicine', () => {
    const userText =
      'mujhe epilepsy hai meri ankhien band hona start ho jati jisam per control b nhi rehta pechle 3 dino mein 6 bar ho chuka aaj 3 bar'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        primary_condition: 'Epilepsy (Breakthrough Seizures)',
        brief_summary:
          'User with known epilepsy reporting breakthrough seizures; medication may need dose adjustment.',
        possible_conditions: [
          'Breakthrough Seizures',
          'Medication Non-effectiveness',
          'Cluster Seizures',
        ],
        explanation:
          'Your current medication may not be working. The neurologist should check your prescription and adjust the dose.',
        urdu_summary:
          'Aap ki mojooda dawai shayad sahi kaam nahi kar rahi. Neurologist dose adjust karein.',
        recommended_specialty_slug: 'neurology',
        recommended_specialty: 'Neurologist',
        severity_level: 'moderate',
      },
      userText
    )
    const combined = `${out.explanation} ${out.brief_summary} ${out.urdu_summary} ${out.possible_conditions?.join(' ')}`
    expect(combined).not.toMatch(/breakthrough/i)
    expect(combined).not.toMatch(/medication non/i)
    expect(combined).not.toMatch(/mojooda dawai/i)
    expect(combined).not.toMatch(/dose adjust/i)
    expect(out.severity_level).toBe('severe')
    expect(out.possible_conditions?.some((c) => /cluster|seizure|epilepsy/i.test(c))).toBe(true)
    expect(out.possible_conditions?.some((c) => /sleep deprivation/i.test(c))).toBe(false)
  })

  it('replaces Hindi-style urdu_summary for seizures with Pakistani Roman Urdu', () => {
    const userText =
      'mujhe epilepsy hai dawai ni doctor k pass nahi 2 se 3 dfa 3 se 5 minute'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        urdu_summary:
          'Aapko shikaarpurn neurologist se jhanknay ke liye samasya karein lagbhag 3 minute.',
        possible_conditions: ['Epilepsy', 'Sleep deprivation or stress'],
        recommended_specialty_slug: 'neurology',
        recommended_specialty: 'Neurologist',
        severity_level: 'severe',
      },
      userText
    )
    expect(looksLikeHindiRomanUrdu(out.urdu_summary)).toBe(false)
    expect(out.urdu_summary).toMatch(/neurologist|dora|dawai/i)
  })

  it('uses guided fast path for acromegaly with substantive chat', () => {
    const lines = [
      'mujhe Acromegaly hai',
      'mere haath aur face ka size barh raha hai',
      '3-4 months se changes ho rahe hain',
    ]
    expect(shouldUseGuidedFastPath(lines, lines.join(' '))).toBe(true)
  })

  it('builds emergency fallback for peanut anaphylaxis when LLM fails', () => {
    const userText =
      'After eating peanuts swelling lips face itching all over difficulty breathing dizziness within minutes'
    const out = buildGuidedFallbackAnalysis(userText)
    expect(out).not.toBeNull()
    expect(out?.severity_level).toBe('emergency')
    expect(out?.explanation).toMatch(/anaphyla|epinephrine|Rescue 1122/i)
    expect(out?.urdu_summary).toMatch(/emergency|1122|anaphyla/i)
  })

  it('builds guided fallback for acromegaly when LLM fails', () => {
    const userText =
      'mujhe Acromegaly hai haath aur face barh raha hai han User answered yes to shoe size vision'
    const out = buildGuidedFallbackAnalysis(userText)
    expect(out).not.toBeNull()
    expect(out?.recommended_specialty_slug).toBe('endocrinology')
    expect(out?.explanation).toMatch(/excess growth hormone/i)
    expect(out?.urdu_summary).not.toMatch(/sharamadi/i)
  })

  it('fixes prolonged fever: no jaundice, clean Roman Urdu, Pakistan differentials', () => {
    const userText =
      'Mujhe 2 hafton se bukhar hai kamzori Nahi dhoop ya barish se masla diet nahi shaam ko bukhar thand body aches appetite kam'
    const bad = {
      ...baseAnalysis,
      primary_condition: 'Fever',
      possible_conditions: ['jaundice', 'Typhoid', 'Dengue', 'Viral illness'],
      explanation:
        'Aapka description dhoop ya barish se juda nahi hai. samananoj ho sakta hai hospital visit.',
      urdu_summary:
        'آپ کو بخار کا samananoj ہے. dhoop ya barish se تعلق. shayad rest lena.',
      first_aid_tips: ['Shayad rest lena', 'Sudharay diet apna lena'],
      severity_level: 'mild' as const,
    }
    const out = applySafetyRules(bad, userText)
    expect(out.possible_conditions.some((c) => /jaundice/i.test(c))).toBe(false)
    expect(out.possible_conditions.some((c) => /typhoid/i.test(c))).toBe(true)
    expect(out.urdu_summary).toMatch(/typhoid|malaria|dengue/i)
    expect(out.urdu_summary).not.toMatch(/samananoj|shayad rest/i)
    expect(out.explanation).not.toMatch(/samananoj/i)
    expect(out.severity_level).toBe('moderate')
    expect(out.first_aid_tips.some((t) => /shayad/i.test(t))).toBe(false)
  })

  it('replaces Tumhe/dismissive fever LLM output with curated Pakistani Roman Urdu', () => {
    const userText =
      'mujhe 2 hafton se bukhar hai kamzori nhi rash ji nahi paseena nahi shaam ko bukhar body aches'
    const bad = {
      ...baseAnalysis,
      primary_condition: 'Bukhar aur Kamzori ke sambandh me aapke masle ka diagnosis',
      brief_summary: 'Din ya shaam ko bukhar, kamzori, aur body aches.',
      explanation:
        'Kya aapko lagta hai ki aapko kuch jaldi dekhbhaal ki zaroorat hai. Bukhar aajkal bahut aam hain.',
      urdu_summary:
        'Tumhe din ya shaam ko bukhar ho raha hai. Yeh chhoti si tarah ki problem hai.',
      possible_conditions: ['Dengue, Typhoid'],
      severity_level: 'moderate' as const,
    }
    const out = applySafetyRules(bad, userText)
    expect(out.primary_condition).not.toMatch(/diagnosis/i)
    expect(out.urdu_summary).toMatch(/^Aap ne bataya/)
    expect(out.urdu_summary).not.toMatch(/tumhe|Tumhe|chhoti si/i)
    expect(out.explanation).toMatch(/typhoid|malaria|dengue/i)
    expect(out.brief_summary.length).toBeGreaterThan(50)
  })

  it('fixes acromegaly analysis: no insulin myth, no lifestyle filler, clear Urdu', () => {
    const userText =
      'mujhe Acromegaly hai mere haath aur face ka size barh raha hai headache haftay mein 3-4 dafa'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        primary_condition: 'Acromegaly',
        brief_summary: 'Hands and face growing with headaches',
        possible_conditions: ['Sleep deprivation or stress', 'Nutritional deficiency or anemia (needs blood tests)'],
        explanation: 'Acromegaly ek bimari hai jo insulin jaisi hormone ki kami ke kaaran hoti hai.',
        urdu_summary:
          'Sharamadi dawayo ke saath sahi dawai lena. Isse sahyog lena zaroori hai. Sharamadi dawayo ke saath hospital mein jana zaroori.',
        first_aid_tips: ['Apni sharamadi dawayo ke saath sahi dawai lena'],
        recommended_specialty_slug: 'endocrinology',
        recommended_specialty: 'Endocrinologist',
        severity_level: 'severe',
      },
      userText
    )
    expect(out.explanation).toMatch(/excess growth hormone/i)
    expect(out.explanation).not.toMatch(/insulin.*deficien|kami/i)
    expect(out.possible_conditions?.some((c) => /sleep deprivation/i.test(c))).toBe(false)
    expect(out.possible_conditions?.some((c) => /acromegaly|growth hormone|pituitary/i.test(c))).toBe(true)
    expect(out.urdu_summary).not.toMatch(/sharamadi/i)
    expect(out.urdu_summary).toMatch(/endocrinologist|growth hormone|IGF/i)
    expect(out.severity_level).toBe('moderate')
    expect(out.recommended_specialty_slug).toBe('endocrinology')
  })

  it('strips garbage conditions and Hindi explanation for seizures', () => {
    const userText = 'mujhe epilepsy hai docor qareeb dore parte hein'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        primary_condition: 'doray',
        explanation:
          'Thode din kee dawaa khane ke baad jaldi doraay aane par thoda sa doraay aa sakta hai.',
        possible_conditions: [
          'sarcoma, tumor, doraay ki waja bhi kuch aur ho sakati hai.',
          'Epilepsy or seizures — needs proper assessment',
        ],
        red_flags: ['doraay ka andaza achanak se kuch din ho raha ho, anya samasya'],
        recommended_specialty_slug: 'neurology',
        recommended_specialty: 'Neurologist',
        severity_level: 'mild',
      },
      userText
    )
    expect(out.explanation).toMatch(/neurologist/i)
    expect(out.explanation).not.toMatch(/dawaa khane/)
    expect(out.possible_conditions?.some((c) => /sarcoma|sakati/i.test(c))).toBe(false)
    expect(out.severity_level).toBe('moderate')
    expect(out.urdu_summary).toMatch(/qareeb|neurologist|list/i)
  })

  it('builds guided allergy analysis when LLM fails', () => {
    const userText =
      'persistent sneezing runny nose itchy eyes 1 week morning worse outdoors dusty antihistamines not tried'
    const out = buildGuidedFallbackAnalysis(userText)
    expect(out).not.toBeNull()
    expect(out?.primary_condition).toMatch(/allergic rhinitis/i)
    expect(out?.recommended_specialty_slug).toBe('ent')
    expect(out?.severity_level).toBe('mild')
    expect(out?.possible_conditions?.some((c) => /typhoid|malaria/i.test(c))).toBe(false)
  })

  it('builds guided allergy follow-up when LLM fails mid-triage', () => {
    const userLines = [
      'I have sneezing and watery eyes for a week, worse in the morning',
    ]
    const out = buildGuidedFollowUpFallback(userLines, [], 'en')
    expect(out?.message).toMatch(/antihistamine/i)
    expect(out?.quick_severity).toBe('mild')
  })

  it('corrects palpitations analysis to cardiology not neurology', () => {
    const userText =
      'heart beating fast when stressed or after tea less than a minute no chest pain anxious exams poor sleep 6 days'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        primary_condition: 'Fast heartbeat',
        recommended_specialty: 'Neurologist',
        recommended_specialty_slug: 'neurology',
        possible_conditions: ['Anxiety', 'Tachycardia'],
        explanation: 'See a neurologist urgently for your anxiety.',
        urdu_summary: 'Aapko neurologist se takreet karni chahiye.',
        severity_level: 'moderate',
      },
      userText
    )
    expect(out.recommended_specialty_slug).toBe('cardiology')
    expect(out.recommended_specialty).toMatch(/Cardiologist|General Physician/i)
    expect(out.explanation).not.toMatch(/see a neurologist|visit a neurologist|urgent neurologist/i)
    expect(out.urdu_summary).not.toMatch(/neurologist se takreet|neurologist se mil/i)
    expect(out.possible_conditions?.some((c) => /palpitation|tachycardia|anxiety/i.test(c))).toBe(true)
  })

  it('corrects allergy analysis away from fever workup', () => {
    const userText =
      'For 10 days sneezing, watery eyes, blocked nose worse outdoors in dusty wind. Mild cough, no fever.'
    const out = applySafetyRules(
      {
        ...baseAnalysis,
        primary_condition: 'Viral fever',
        possible_conditions: ['Typhoid', 'Dengue fever', 'Viral illness'],
        severity_level: 'moderate',
        explanation: 'Fever with cough needs typhoid and malaria tests.',
      },
      userText
    )
    expect(out.primary_condition).toMatch(/allergic rhinitis|hay fever/i)
    expect(out.possible_conditions?.some((c) => /typhoid|malaria|dengue/i.test(c))).toBe(false)
    expect(out.possible_conditions?.some((c) => /allergic|hay fever|pollen/i.test(c))).toBe(true)
    expect(out.recommended_specialty_slug).toBe('ent')
    expect(out.severity_level).toBe('mild')
  })
})
