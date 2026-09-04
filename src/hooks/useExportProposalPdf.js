import { useCallback, useRef, useState } from 'react'
import { PDF_AUDIENCE } from '../pdf/pdfFormat.js'

/**
 * Run PDF Engine download / print from any surface.
 *
 * The hook owns busy and error state. Pages must not import the PDF renderer
 * or mutate proposal fields for export; pass `audience` and optional `version`
 * instead.
 *
 * @returns {{
 *   runExport: (
 *     proposal: import('../models/proposal.js').Proposal,
 *     action: 'download' | 'print',
 *     options?: {
 *       audience?: string,
 *       version?: import('../models/proposalVersion.js').ProposalVersion | null,
 *     },
 *   ) => Promise<void>,
 *   exporting: 'download' | 'print' | null,
 *   error: Error | null,
 * }}
 */
export function useExportProposalPdf() {
  const [exporting, setExporting] = useState(null)
  const [error, setError] = useState(null)
  const inflight = useRef(false)

  const runExport = useCallback(async (proposal, action, options = {}) => {
    if (!proposal || inflight.current) return false

    inflight.current = true
    setError(null)
    setExporting(action)

    try {
      const { downloadProposalPdf, printProposalPdf } = await import(
        '../pdf/generateProposalPdf.js'
      )

      if (action === 'download') {
        await downloadProposalPdf(proposal, options)
      } else {
        await printProposalPdf(proposal, options)
      }

      return true
    } catch (caught) {
      setError(caught)
      return false
    } finally {
      inflight.current = false
      setExporting(null)
    }
  }, [])

  return { runExport, exporting, error }
}

export { PDF_AUDIENCE }
