import { isQuestionnaireSubmitted, hasQuestionnaire } from './questionnaire.js'
import { countOpenThreads } from '../collaboration/threads.js'
import { listActiveUploads } from './upload.js'
import { SIGNATURE_STATUS } from './signature.js'
import { PAYMENT_STATUS } from './payment.js'

export const PORTAL_PROGRESS_STEP = Object.freeze({
  VIEWED: 'viewed',
  QUESTIONNAIRE: 'questionnaire',
  FILES: 'files',
  DISCUSSION: 'discussion',
  SIGNATURE: 'signature',
  PAYMENT: 'payment',
})

export const PORTAL_PROGRESS_LABELS = Object.freeze({
  [PORTAL_PROGRESS_STEP.VIEWED]: 'Proposal viewed',
  [PORTAL_PROGRESS_STEP.QUESTIONNAIRE]: 'Questionnaire completed',
  [PORTAL_PROGRESS_STEP.FILES]: 'Files uploaded',
  [PORTAL_PROGRESS_STEP.DISCUSSION]: 'Discussion completed',
  [PORTAL_PROGRESS_STEP.SIGNATURE]: 'Signature',
  [PORTAL_PROGRESS_STEP.PAYMENT]: 'Payment',
})

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 */
export function buildPortalProgress(proposal) {
  if (!proposal) return { steps: [], complete: 0, total: 0, percent: 0 }

  const hasForm = hasQuestionnaire(proposal.questionnaire)
  const uploads = listActiveUploads(proposal.uploads)
  const openThreads = countOpenThreads(proposal.comments, { clientVisibleOnly: true })
  const comments = proposal.comments ?? []
  const signature = proposal.signature
  const payment = proposal.payment

  const steps = [
    {
      id: PORTAL_PROGRESS_STEP.VIEWED,
      label: PORTAL_PROGRESS_LABELS[PORTAL_PROGRESS_STEP.VIEWED],
      done: Boolean(proposal.lastViewedAt),
      pendingLabel: 'Pending',
    },
    {
      id: PORTAL_PROGRESS_STEP.QUESTIONNAIRE,
      label: hasForm
        ? PORTAL_PROGRESS_LABELS[PORTAL_PROGRESS_STEP.QUESTIONNAIRE]
        : 'Questionnaire',
      done: !hasForm || isQuestionnaireSubmitted(proposal.questionnaire),
      skipped: !hasForm,
      pendingLabel: hasForm ? 'Pending' : 'Not on this proposal',
    },
    {
      id: PORTAL_PROGRESS_STEP.FILES,
      label: PORTAL_PROGRESS_LABELS[PORTAL_PROGRESS_STEP.FILES],
      done: uploads.length > 0,
      pendingLabel: 'Pending',
    },
    {
      id: PORTAL_PROGRESS_STEP.DISCUSSION,
      label: PORTAL_PROGRESS_LABELS[PORTAL_PROGRESS_STEP.DISCUSSION],
      done: comments.length > 0 && openThreads === 0,
      pendingLabel: openThreads > 0 ? `${openThreads} open` : 'Pending',
    },
    {
      id: PORTAL_PROGRESS_STEP.SIGNATURE,
      label:
        signature?.status === SIGNATURE_STATUS.WAITING
          ? 'Signature pending'
          : PORTAL_PROGRESS_LABELS[PORTAL_PROGRESS_STEP.SIGNATURE],
      done: signature?.status === SIGNATURE_STATUS.SIGNED,
      pendingLabel: 'Pending',
    },
    {
      id: PORTAL_PROGRESS_STEP.PAYMENT,
      label:
        payment?.status === PAYMENT_STATUS.PAID
          ? 'Payment completed'
          : PORTAL_PROGRESS_LABELS[PORTAL_PROGRESS_STEP.PAYMENT],
      done: payment?.status === PAYMENT_STATUS.PAID,
      pendingLabel: 'Pending',
    },
  ]

  const complete = steps.filter((step) => step.done).length
  return {
    steps,
    complete,
    total: steps.length,
    percent: Math.round((complete / steps.length) * 100),
  }
}
