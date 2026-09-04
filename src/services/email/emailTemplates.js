import { formatDate } from '../../utils/format.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraph(text) {
  const safe = escapeHtml(text).replace(/\r\n|\n/g, '<br />')
  return safe
}

function absoluteUrl(url, appUrl) {
  const value = String(url ?? '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value
  const origin = String(appUrl ?? '').replace(/\/$/, '')
  if (!origin) return value
  return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`
}

/**
 * Transactional HTML + text for a proposal send.
 * Table layout for Outlook; color-scheme meta for dark/light clients.
 *
 * @param {object} input
 */
export function renderProposalEmail(input = {}) {
  const studio = input.studioName || 'Studio'
  const title = input.proposalTitle || 'Proposal'
  const sender = input.senderName || studio
  const message = String(input.message ?? '').trim()
  const buttonUrl = input.trackingUrl || input.proposalUrl || '#'
  const expiry = input.expiresAt ? formatDate(input.expiresAt) : ''
  const supportEmail = input.supportEmail || ''
  const logoUrl = absoluteUrl(input.logoUrl, input.appUrl)
  const pixelUrl = input.openPixelUrl || ''
  const accent = input.accentColor || '#14b8a6'
  const year = new Date().getFullYear()

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .shell { background-color: #111111 !important; }
      .card { background-color: #1c1c1c !important; border-color: #2a2a2a !important; }
      .title, .body, .sender { color: #f4f4f5 !important; }
      .muted, .footer { color: #a1a1aa !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;" class="shell">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:560px;max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 36px 8px 36px;">
              ${
                logoUrl
                  ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(studio)}" width="140" style="display:block;max-width:140px;height:auto;margin-bottom:24px;border:0;" />`
                  : `<p style="margin:0 0 24px;font-family:Inter,Arial,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${accent};font-weight:700;">${escapeHtml(studio)}</p>`
              }
              <p class="muted" style="margin:0 0 8px;font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;">Proposal</p>
              <h1 class="title" style="margin:0 0 12px;font-family:Inter,Arial,sans-serif;font-size:24px;line-height:1.25;letter-spacing:-0.03em;color:#111111;">${escapeHtml(title)}</h1>
              <p class="sender" style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#3f3f46;">
                ${escapeHtml(sender)} sent you this proposal${studio && studio !== sender ? ` from ${escapeHtml(studio)}` : ''}.
              </p>
              ${
                message
                  ? `<p class="body" style="margin:0 0 24px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#27272a;">${paragraph(message)}</p>`
                  : ''
              }
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:${accent};">
                    <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:12px 22px;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:700;color:#04211d;text-decoration:none;">View Proposal</a>
                  </td>
                </tr>
              </table>
              ${
                expiry
                  ? `<p class="muted" style="margin:0 0 8px;font-family:Inter,Arial,sans-serif;font-size:13px;color:#71717a;">Valid until ${escapeHtml(expiry)}</p>`
                  : ''
              }
              <p class="muted" style="margin:0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.5;color:#a1a1aa;">If the button does not work, copy this link:<br />
                <a href="${escapeHtml(buttonUrl)}" style="color:${accent};word-break:break-all;">${escapeHtml(buttonUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer" style="padding:20px 36px 28px;border-top:1px solid #e4e4e7;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.5;color:#71717a;">
              ${escapeHtml(studio)} · ProposalForge
              ${supportEmail ? `<br />Questions? ${escapeHtml(supportEmail)}` : ''}
              <br />© ${year} ${escapeHtml(studio)}. This email was sent because a proposal was shared with you.
            </td>
          </tr>
        </table>
        ${
          pixelUrl
            ? `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
            : ''
        }
      </td>
    </tr>
  </table>
</body>
</html>`

  const textLines = [
    title,
    '',
    `${sender} sent you this proposal${studio && studio !== sender ? ` from ${studio}` : ''}.`,
    message ? `\n${message}\n` : '',
    `View proposal: ${buttonUrl}`,
    expiry ? `Valid until ${expiry}` : '',
    '',
    supportEmail ? `Questions? ${supportEmail}` : '',
    `${studio} · ProposalForge`,
  ].filter((line) => line !== '')

  return {
    subject: input.subject || `${title} — proposal from ${studio}`,
    html,
    text: textLines.join('\n'),
  }
}

export function defaultProposalSubject(proposalTitle, studioName) {
  const title = String(proposalTitle || 'Proposal').trim() || 'Proposal'
  const studio = String(studioName || 'Studio').trim()
  return `${title} — proposal from ${studio}`
}
