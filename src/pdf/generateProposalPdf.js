import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import { fetchBrandKit } from '../services/brandKitService.js'
import { fetchSettings } from '../services/settingsService.js'
import ProposalDocument from './ProposalDocument.jsx'
import { toPdfFilename } from './pdfFormat.js'

export async function renderProposalPdfBlob(proposal, settings, kit) {
  const document = createElement(ProposalDocument, { proposal, settings, kit })
  return pdf(document).toBlob()
}

export async function loadProposalPdfContext(proposal) {
  const [settings, kit] = await Promise.all([fetchSettings(), fetchBrandKit()])
  const blob = await renderProposalPdfBlob(proposal, settings, kit)

  return { blob, filename: toPdfFilename(proposal) }
}

export async function downloadProposalPdf(proposal) {
  const { blob, filename } = await loadProposalPdfContext(proposal)
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

export async function printProposalPdf(proposal) {
  const { blob } = await loadProposalPdfContext(proposal)
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
