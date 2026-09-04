import {
  isValidEmailAddress,
  makeEmailMessage,
  MAIL_ERROR_CODE,
} from '../../models/emailDelivery.js'
import { MailError } from '../errors.js'
import { defaultProposalSubject, renderProposalEmail } from './emailTemplates.js'
import { getMailProvider } from './mailProvider.js'

/**
 * Build and dispatch a proposal email through the configured provider.
 * Does not mutate proposal status — `sendProposal()` owns that.
 *
 * Payload is shaped for scheduled send, CC/BCC, and bulk later:
 * `scheduledAt`, `cc`, `bcc`, and `to` as a list are already accepted.
 *
 * @param {object} input
 */
export async function sendProposalEmail(input, provider = getMailProvider()) {
  const to = Array.isArray(input.to) ? input.to : [input.to]
  const recipients = to.map((item) => String(item ?? '').trim()).filter(Boolean)

  if (recipients.length === 0) {
    throw new MailError('Add a recipient email.', {
      code: MAIL_ERROR_CODE.INVALID_EMAIL,
      retryable: false,
      errors: [{ field: 'to', message: 'Recipient email is required.' }],
    })
  }

  const invalid = recipients.find((email) => !isValidEmailAddress(email))
  if (invalid) {
    throw new MailError(`“${invalid}” is not a valid email address.`, {
      code: MAIL_ERROR_CODE.INVALID_EMAIL,
      retryable: false,
      errors: [{ field: 'to', message: 'Enter a valid recipient email.' }],
    })
  }

  if (!isValidEmailAddress(input.fromEmail)) {
    throw new MailError('Sender email is not valid.', {
      code: MAIL_ERROR_CODE.INVALID_EMAIL,
      retryable: false,
      errors: [{ field: 'fromEmail', message: 'Enter a valid sender email.' }],
    })
  }

  const message = makeEmailMessage({
    id: input.id,
    proposalId: input.proposalId,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    to: recipients,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject || defaultProposalSubject(input.proposalTitle, input.studioName),
    message: input.message,
    proposalUrl: input.proposalUrl,
    trackingUrl: input.trackingUrl,
    expiresAt: input.expiresAt,
    scheduledAt: input.scheduledAt,
  })

  const rendered = renderProposalEmail({
    studioName: input.studioName,
    proposalTitle: input.proposalTitle,
    senderName: message.fromName,
    message: message.message,
    trackingUrl: message.trackingUrl || message.proposalUrl,
    proposalUrl: message.proposalUrl,
    expiresAt: message.expiresAt,
    supportEmail: input.supportEmail || message.fromEmail,
    logoUrl: input.logoUrl,
    appUrl: input.appUrl,
    openPixelUrl: input.openPixelUrl,
    accentColor: input.accentColor,
    subject: message.subject,
  })

  const result = await provider.send({
    id: message.id,
    proposalId: message.proposalId,
    fromName: message.fromName,
    fromEmail: message.fromEmail,
    to: message.to,
    cc: message.cc,
    bcc: message.bcc,
    subject: message.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: message.fromEmail,
    scheduledAt: message.scheduledAt,
    proposalUrl: message.proposalUrl,
    personalMessage: message.message,
    headers: {
      'X-Proposal-Id': message.proposalId,
      'X-Email-Message-Id': message.id,
      'X-Proposal-Url': message.proposalUrl,
    },
    tags: {
      proposal_id: message.proposalId,
      email_id: message.id,
    },
  })

  return {
    ...message,
    provider: result.provider || message.provider,
    providerMessageId: result.providerMessageId ?? null,
    status: result.status || (message.scheduledAt ? 'queued' : 'sent'),
    sentAt: new Date().toISOString(),
    subject: message.subject,
  }
}
