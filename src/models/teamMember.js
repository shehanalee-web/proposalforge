import { createRecordId } from './ids.js'

/**
 * Team library record.
 *
 * People who can appear on a proposal Team block. Proposals store member
 * ids (or a snapshot in a later phase), not a private staff list per layout.
 */

/**
 * @typedef {object} TeamMember
 * @property {string} id
 * @property {string} name
 * @property {string} role
 * @property {string} bio
 * @property {string | null} portraitAssetId
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<TeamMember>} [input]
 * @returns {TeamMember}
 */
export function makeTeamMember(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createRecordId('member'),
    name: input.name ?? '',
    role: input.role ?? '',
    bio: input.bio ?? '',
    portraitAssetId: input.portraitAssetId ?? null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * @param {Partial<TeamMember>} member
 * @returns {{ field: string, message: string }[]}
 */
export function validateTeamMember(member) {
  const errors = []

  if (!member.name || !member.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' })
  }

  return errors
}
