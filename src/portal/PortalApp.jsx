import { useRef, useState } from 'react'
import { ViewerProvider, useViewer } from '../viewer/ViewerContext.jsx'
import { useFullscreen } from '../viewer/useFullscreen.js'
import { useLivingProposal } from '../hooks/useLivingProposal.js'
import ViewerStage from '../viewer/ViewerStage.jsx'
import ViewerActionBar from '../viewer/ViewerActionBar.jsx'
import { useProposalTheme } from '../theme/ProposalThemeContext.jsx'
import {
  hasCapability,
  PORTAL_CAPABILITY,
} from '../models/portalPermissions.js'
import { PORTAL_MODULE } from '../models/portalModules.js'
import { hasQuestionnaire } from '../models/questionnaire.js'
import { getClientPortalUrl } from '../utils/clientProposal.js'
import { usePortal } from './PortalContext.jsx'
import PortalHeader from './PortalHeader.jsx'
import PortalAside from './PortalAside.jsx'
import PortalQuestionnaire from './PortalQuestionnaire.jsx'
import PortalComments from './PortalComments.jsx'
import PortalRequestChanges from './PortalRequestChanges.jsx'
import PortalFiles from './PortalFiles.jsx'
import PortalDecline from './PortalDecline.jsx'
import PortalSign from './PortalSign.jsx'
import PortalPay from './PortalPay.jsx'
import styles from './PortalShell.module.css'

function PortalAppInner({
  notices,
  busy,
  onAccept,
  onDownload,
  onPrint,
  onProposalChange,
  onDeclined,
}) {
  const { proposal, capabilities } = usePortal()
  const living = useLivingProposal(proposal)
  const { cssVars } = useProposalTheme()
  const { flash, saved, setSaved } = useViewer()
  const shellRef = useRef(null)
  const { active: fullscreen, toggle: toggleFullscreen } = useFullscreen(shellRef)
  const [asideOpen, setAsideOpen] = useState(false)
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const canAccept = hasCapability(capabilities, PORTAL_CAPABILITY.ACCEPT)
  const canDecline = hasCapability(capabilities, PORTAL_CAPABILITY.DECLINE)
  const canComment = hasCapability(capabilities, PORTAL_CAPABILITY.COMMENT)
  const canRequestRevision = hasCapability(
    capabilities,
    PORTAL_CAPABILITY.REQUEST_REVISION,
  )

  function closeDrawers() {
    setQuestionnaireOpen(false)
    setCommentsOpen(false)
    setFilesOpen(false)
    setAsideOpen(false)
  }

  function handleShare() {
    const url = getClientPortalUrl(proposal.shareToken)
    if (!url) {
      flash('Could not copy the link.')
      return
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Link copied'),
        () => flash('Could not copy the link.'),
      )
      return
    }
    flash('Copy the URL from the address bar.')
  }

  function handleSave() {
    setSaved((value) => !value)
    flash(saved ? 'Removed from saved' : 'Saved on this device')
  }

  function openModule(moduleId) {
    if (moduleId === PORTAL_MODULE.QUESTIONNAIRE) {
      if (!hasQuestionnaire(proposal.questionnaire)) return
      closeDrawers()
      setQuestionnaireOpen(true)
      return
    }
    if (moduleId === PORTAL_MODULE.COMMENTS) {
      closeDrawers()
      setCommentsOpen(true)
      return
    }
    if (moduleId === PORTAL_MODULE.UPLOADS) {
      closeDrawers()
      setFilesOpen(true)
      return
    }
    if (moduleId === PORTAL_MODULE.SIGNATURE) {
      setSignOpen(true)
      return
    }
    if (moduleId === PORTAL_MODULE.PAYMENT) {
      setPayOpen(true)
    }
  }

  return (
    <div
      ref={shellRef}
      className={`${styles.shell} ${fullscreen ? styles.fullscreen : ''}`}
      style={cssVars}
      data-surface="client-portal"
      data-experience="living-proposal"
      data-publication-source={living.publication.source}
      data-readonly="true"
    >
      <PortalHeader
        asideOpen={asideOpen}
        onToggleAside={() => setAsideOpen((open) => !open)}
      />

      <div className={styles.body}>
        <ViewerStage
          proposal={proposal}
          sections={living.sections}
          status={proposal.status}
          notices={notices}
          embedded
          living
          onFullscreen={toggleFullscreen}
        />
        <PortalAside
          open={asideOpen}
          onOpenModule={openModule}
          onApprove={onAccept}
          onDecline={() => setDeclineOpen(true)}
          onRequestChanges={() => setRequestOpen(true)}
          onSign={() => setSignOpen(true)}
          onPay={() => setPayOpen(true)}
        />
      </div>

      {asideOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close details"
          onClick={() => setAsideOpen(false)}
        />
      ) : null}

      <ViewerActionBar
        busy={busy}
        canRespond={canAccept || canDecline || canComment || canRequestRevision}
        showAccept={canAccept}
        showReject={canDecline}
        showAsk={canComment}
        showRevision={canRequestRevision}
        acceptLabel="Approve"
        rejectLabel="Decline"
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onAccept={onAccept}
        onReject={() => setDeclineOpen(true)}
        onAskQuestion={() => {
          closeDrawers()
          setCommentsOpen(true)
        }}
        onRequestChanges={() => setRequestOpen(true)}
        onDownload={onDownload}
        onPrint={onPrint}
        onShare={handleShare}
        onSave={handleSave}
      />

      {questionnaireOpen ? (
        <PortalQuestionnaire
          onClose={() => setQuestionnaireOpen(false)}
          onProposalChange={onProposalChange}
        />
      ) : null}

      {commentsOpen ? (
        <PortalComments
          onClose={() => setCommentsOpen(false)}
          onProposalChange={onProposalChange}
        />
      ) : null}

      {filesOpen ? (
        <PortalFiles
          onClose={() => setFilesOpen(false)}
          onProposalChange={onProposalChange}
        />
      ) : null}

      {requestOpen ? (
        <PortalRequestChanges
          onClose={() => setRequestOpen(false)}
          onProposalChange={onProposalChange}
          onSubmitted={() => setCommentsOpen(true)}
        />
      ) : null}

      {declineOpen ? (
        <PortalDecline
          onClose={() => setDeclineOpen(false)}
          onDeclined={onDeclined}
        />
      ) : null}

      {signOpen ? (
        <PortalSign
          onClose={() => setSignOpen(false)}
          onSigned={onProposalChange}
        />
      ) : null}

      {payOpen ? (
        <PortalPay
          onClose={() => setPayOpen(false)}
          onPaid={onProposalChange}
        />
      ) : null}
    </div>
  )
}

function PortalApp(props) {
  return (
    <ViewerProvider>
      <PortalAppInner {...props} />
    </ViewerProvider>
  )
}

export default PortalApp
