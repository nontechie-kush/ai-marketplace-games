// lib/promptOps.ts
export type GenerateOps = {
  forceSingleFile: boolean
  inlineCSS: boolean
  inlineJS: boolean
  preferCanvas: boolean
  requireGameStates: boolean
  targetFPS: number
  allowCDNAssets: boolean,
}

const DEFAULT_OPS: GenerateOps = {
  forceSingleFile: true,
  inlineCSS: true,
  inlineJS: true,
  preferCanvas: true,
  requireGameStates: true,
  targetFPS: 60,
  allowCDNAssets: true,
}

/**
 * Very simple mapper: we could parse the prompt for hints later,
 * but for now we just enforce solid defaults that emulate “Claude chat”.
 */
export function overrideOpsFromPrompt(_prompt: string): GenerateOps {
  return { ...DEFAULT_OPS }
}
