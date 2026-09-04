import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import { fetchBrandKit } from '../services/brandKitService.js'
import { fetchSettings } from '../services/settingsService.js'
import { embedBrandKitImages, embedProposalImages } from './embedPdfImages.js'
import ProposalDocument from './ProposalDocument.jsx'
import { toPdfFilename } from './pdfFormat.js'
import { prepareProposalForPdf } from './prepareProposalPdf.js'

/**
 * Compose a PDF after uploaded images have been fetched from their public
 * URLs and encoded as data URIs. Attachment links keep those public URLs.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 * @param {import('../models/settings.js').Settings} settings
 * @param {import('../models/brandKit.js').BrandKit | null} kit
 */
export async function renderProposalPdfBlob(proposal, settings, kit) {
  const [embeddedProposal, embeddedKit] = await Promise.all([
    embedProposalImages(proposal),
    embedBrandKitImages(kit),
  ])
  const document = createElement(ProposalDocument, {
    proposal: embeddedProposal,
    settings,
    kit: embeddedKit,
  })
  return pdf(document).toBlob()
}

/**
 * @param {import('../models/proposal.js').Proposal} proposal
 * @param {{
 *   audience?: string,
 *   version?: import('../models/proposalVersion.js').ProposalVersion | null,
 * }} [options]
 */
export async function loadProposalPdfContext(proposal, options = {}) {
  const prepared = prepareProposalForPdf(proposal, options)
  const [settings, kit] = await Promise.all([fetchSettings(), fetchBrandKit()])
  const blob = await renderProposalPdfBlob(prepared, settings, kit)

  return {
    blob,
    filename: toPdfFilename(prepared, {
      versionNumber: prepared.currentVersion,
    }),
  }
}

export async function downloadProposalPdf(proposal, options = {}) {
  const { blob, filename } = await loadProposalPdfContext(proposal, options)
  const { recordPdfDownloaded } = await import('../services/activityService.js')
  recordPdfDownloaded(proposal, options)
  const url = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
}

export async function printProposalPdf(proposal, options = {}) {
  const { blob } = await loadProposalPdfContext(proposal, options)
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', 'Print proposal')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url

  const cleanup = () => {
    iframe.remove()
    URL.revokeObjectURL(url)
  }

  iframe.addEventListener('load', () => {
    const frameWindow = iframe.contentWindow

    if (!frameWindow) {
      cleanup()
      return
    }

    frameWindow.focus()
    frameWindow.print()
    frameWindow.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60_000)
  })

  document.body.append(iframe)
}
