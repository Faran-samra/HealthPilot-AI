import type { SupabaseClient } from '@supabase/supabase-js'
import type { DoctorSource } from '../lib/normalize.ts'
import { HamariWebConnector } from './hamariweb/connector.ts'
import { MarhamConnector } from './marham/connector.ts'
import { OladocConnector } from './oladoc/connector.ts'
import type { BaseSourceConnector } from './base-connector.ts'

export function getConnector(source: DoctorSource, supabase: SupabaseClient): BaseSourceConnector {
  switch (source) {
    case 'marham':
      return new MarhamConnector(supabase)
    case 'oladoc':
      return new OladocConnector(supabase)
    case 'hamariweb':
      return new HamariWebConnector(supabase)
    default:
      throw new Error(`No sitemap connector for source: ${source}`)
  }
}

export const SITEMAP_SOURCES: DoctorSource[] = ['marham', 'oladoc', 'hamariweb']
