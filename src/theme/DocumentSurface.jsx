import { useProposalTheme } from './ProposalThemeContext.jsx'
import styles from './DocumentSurface.module.css'

function DocumentSurface({ children, className = '', as: Tag = 'div' }) {
  const { cssVars, tokens } = useProposalTheme()

  return (
    <Tag
      className={`${styles.surface} ${className}`.trim()}
      style={cssVars}
      data-theme={tokens.themeId}
      data-cover-layout={tokens.cover.layout}
      data-cover-image={tokens.cover.imagePosition}
      data-cover-pattern={tokens.cover.pattern}
      data-cover-gradient={tokens.cover.gradient ? 'true' : undefined}
      data-motion={tokens.layout.motionDensity}
      data-compact={tokens.page.compactMobile ? 'true' : undefined}
      data-watermark={tokens.metadata.draftWatermark ? 'draft' : undefined}
    >
      {tokens.metadata.draftWatermark ? (
        <p className={styles.watermark} aria-hidden="true">
          Draft
        </p>
      ) : null}
      {children}
    </Tag>
  )
}

export default DocumentSurface
