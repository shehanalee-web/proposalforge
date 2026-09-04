import { useEffect, useId, useRef } from 'react'
import { useNavigate } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import { PATH } from '../../workspace/paths.js'
import { useCreateProposalDialog } from '../../hooks/useCreateProposalDialog.js'
import styles from './StartProposalDialog.module.css'

function StartProposalDialog() {
  const navigate = useNavigate()
  const { startOpen, closeStart } = useCreateProposalDialog()
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return

    if (startOpen && !node.open) {
      node.showModal()
    } else if (!startOpen && node.open) {
      node.close()
    }
  }, [startOpen])

  function handleNativeClose() {
    if (startOpen) closeStart()
  }

  function go(path) {
    closeStart()
    navigate(path)
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={handleNativeClose}
      onCancel={handleNativeClose}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <p className={styles.kicker}>New document</p>
          <h2 id={titleId} className={styles.title}>
            Create a proposal
          </h2>
          <p className={styles.lede}>
            Draft with AI, or start from a service in the library.
          </p>
        </header>

        <div className={styles.choices}>
          <button
            type="button"
            className={`${styles.choice} ${styles.choicePrimary}`}
            onClick={() => go(PATH.PROPOSAL_AI)}
          >
            <span className={styles.choiceMark} aria-hidden="true">
              <Icon name="spark" size={22} />
            </span>
            <span className={styles.choiceBody}>
              <span className={styles.choiceKicker}>Recommended</span>
              <span className={styles.choiceTitle}>Generate with AI</span>
              <span className={styles.choiceText}>
                Answer a few questions. We will draft the proposal and open it
                in the editor, ready to refine.
              </span>
            </span>
            <span className={styles.choiceHint}>Start chat</span>
          </button>

          <button
            type="button"
            className={styles.choice}
            onClick={() => go(PATH.NEW_PROPOSAL)}
          >
            <span className={styles.choiceMark} aria-hidden="true">
              <Icon name="templates" size={22} />
            </span>
            <span className={styles.choiceBody}>
              <span className={styles.choiceKicker}>Library</span>
              <span className={styles.choiceTitle}>Start from Template</span>
              <span className={styles.choiceText}>
                Pick a workspace, brand and service. We copy that service’s
                template into a new document.
              </span>
            </span>
            <span className={styles.choiceHint}>Choose service</span>
          </button>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancel} onClick={closeStart}>
            Cancel
          </button>
        </footer>
      </div>
    </dialog>
  )
}

export default StartProposalDialog
