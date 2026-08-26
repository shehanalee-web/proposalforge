import ProposalDocumentView from '../../layouts/screen/ProposalDocumentView.jsx'

/**
 * Screen rendering entry used by the studio detail and the client portal.
 *
 * Layout selection happens in `ProposalDocumentView`. This wrapper keeps the
 * existing import path so pages do not each compose the layout registry.
 */
function ProposalContent({
  proposal,
  settings = null,
  includeCover = false,
  showNotes = true,
  showTags = true,
  showSignature = true,
  status,
}) {
  return (
    <ProposalDocumentView
      proposal={proposal}
      settings={settings}
      includeCover={includeCover}
      showNotes={showNotes}
      showTags={showTags}
      showSignature={showSignature}
      status={status}
    />
  )
}

export default ProposalContent
