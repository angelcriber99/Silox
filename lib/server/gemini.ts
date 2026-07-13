import 'server-only'

import { GoogleGenerativeAI } from '@google/generative-ai'

let gemini: GoogleGenerativeAI | null = null

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  if (!gemini) {
    gemini = new GoogleGenerativeAI(apiKey)
  }

  return gemini
}
