import { listEnabledBlocks } from './instance.js'

/**
 * Place enabled blocks into layout regions without mutating the proposal.
 *
 * A region's `accept` lists content types. `'*'` takes leftover types that no
 * region claimed explicitly. Array order on the proposal is preserved inside
 * each region.
 *
 * @param {import('./instance.js').BlockInstance[]} blocks
 * @param {{ id: string, columns?: number, accept?: string[] }[]} regions
 */
export function placeBlocks(blocks, regions = []) {
  const enabled = listEnabledBlocks(blocks)
  const reserved = new Set()

  for (const region of regions) {
    for (const type of region.accept ?? []) {
      if (type !== '*') reserved.add(type)
    }
  }

  const taken = new Set()

  return regions.map((region) => {
    const accept = region.accept ?? ['*']
    const wantsStar = accept.includes('*')
    const wants = new Set(accept.filter((type) => type !== '*'))
    const instances = []

    for (const block of enabled) {
      if (taken.has(block.id)) continue

      const explicit = wants.has(block.type)
      const leftover = wantsStar && !reserved.has(block.type)

      if (explicit || leftover) {
        instances.push(block)
        taken.add(block.id)
      }
    }

    return {
      id: region.id,
      columns: region.columns ?? 1,
      chrome: region.chrome ?? [],
      instances,
    }
  })
}

/**
 * Attach enabled content blocks to PDF sequence steps. Chrome ids stay on
 * the step; `accept` / `skip` choose Block Engine instances.
 */
export function placePdfSequence(blocks, sequence = []) {
  const enabled = listEnabledBlocks(blocks)
  const reserved = new Set()

  for (const step of sequence) {
    for (const type of step.accept ?? []) {
      if (type !== '*') reserved.add(type)
    }
  }

  const taken = new Set()

  return sequence.map((step) => {
    const accept = step.accept ?? []
    const skip = new Set(step.skip ?? [])
    const wantsStar = accept.includes('*')
    const wants = new Set(accept.filter((type) => type !== '*'))
    const instances = []

    if (accept.length > 0) {
      for (const block of enabled) {
        if (taken.has(block.id) || skip.has(block.type)) continue

        const explicit = wants.has(block.type)
        const leftover = wantsStar && !reserved.has(block.type)

        if (explicit || leftover) {
          instances.push(block)
          taken.add(block.id)
        }
      }
    }

    return {
      ...step,
      instances,
    }
  })
}
