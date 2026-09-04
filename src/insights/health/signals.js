/**
 * Deterministic copy signals used by Horizon 2 diagnostics.
 * These are document-wide — a rich-text "Timeline" section counts, not only
 * a dedicated timeline block.
 */

export const SIGNAL = Object.freeze({
  TIMELINE:
    /\b(timeline|schedule|milestones?|kick-?off|week\s+\d|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+weeks?|weeks?\s+from|phased?|deadline|go-live|handover date|review checkpoints?)\b/i,
  OBJECTIVES:
    /\b(objectives?|goals?|needs?|needed|challenge|problem|brief|looking to|so that|want to|priorit(?:y|ies)|pain point)\b/i,
  VALUE:
    /\b(value|outcome|result|so you|so your|increase|reduce|save|return|roi|helps? (?:you|the)|complete \w+ engagement)\b/i,
  EXCLUSION:
    /\b(exclusion|exclusions|not included|out of scope|does not include|excluded|outside the scope)\b/i,
  WARRANTY:
    /\b(warranty|warranties|guarantee|guaranteed|defects liability)\b/i,
  DELIVERABLE:
    /\b(deliverables?|you (?:will )?receive|what(?:'s| is) included|outputs?|final asset)\b/i,
  PAYMENT:
    /\b(payment terms|deposit|invoice|net\s*\d+|due on|due within|payable|payment schedule)\b/i,
})

/**
 * @param {string} [text]
 * @param {RegExp} pattern
 */
export function hasSignal(text, pattern) {
  return pattern.test(String(text ?? ''))
}

/**
 * @param {object} [block]
 */
export function blockCopy(block = {}) {
  const data = block.data ?? {}
  return [data.kicker, data.heading, data.subheading, data.body, data.notes]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
}
