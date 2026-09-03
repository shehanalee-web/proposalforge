import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import { useEditorLayout } from '../Editor/EditorLayoutContext.jsx'
import { useEditorWorkspace } from '../Editor/EditorWorkspaceContext.jsx'
import HealthScore from './HealthScore.jsx'
import AiSuggestions from './AiSuggestions.jsx'
import QuickActions from './QuickActions.jsx'
import WorkspaceMemory from './WorkspaceMemory.jsx'
import RecentChanges from './RecentChanges.jsx'
import styles from './AiSidebar.module.css'

/**
 * Collapsible AI assistant sidebar for the Proposal Editor.
 *
 * UI-only — no AI provider integration. Each section accepts future
 * data/callback props so connecting a real service requires zero layout work.
 *
 * @param {{
 *   proposal?: object,
 *   blocks?: import('../../blocks/instance.js').BlockInstance[],
 *   onAction?: (action: string, payload?: unknown) => void,
 * }} props
 */
function AiSidebar({ proposal, blocks, onAction }) {
  const { sidebarOpen, setSidebarOpen } = useEditorLayout()
  const { previewMode } = useEditorWorkspace()

  if (previewMode) return null

  return (
    <>
      {/* Toggle tab — always visible on the right edge of the editor */}
      <button
        type="button"
        className={`${styles.toggle} ${sidebarOpen ? styles.toggleOpen : ''}`}
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? 'Close assistant panel' : 'Open assistant panel'}
        title={sidebarOpen ? 'Close panel' : 'Assistant panel'}
      >
        <Icon name="spark" size={18} />
        {!sidebarOpen && <span className={styles.toggleLabel}>Panel</span>}
        {sidebarOpen && <Icon name="close" size={14} />}
      </button>

      {/* Panel */}
      <aside
        className={`${styles.panel} ${sidebarOpen ? styles.panelOpen : ''}`}
        aria-label="Assistant panel"
      >
        <div className={styles.inner}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <Icon name="spark" size={16} className={styles.headerIcon} />
              <span>AI Assistant</span>
            </div>
            <span className={styles.badge}>Beta</span>
          </div>

          {/* Sections */}
          <div className={styles.sections}>
            <HealthScore blocks={blocks} />
            <AiSuggestions />
            <QuickActions onAction={onAction} />
            <WorkspaceMemory />
            <RecentChanges />
          </div>
        </div>
      </aside>
    </>
  )
}

export default AiSidebar
