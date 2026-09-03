import Icon from '../Icon/Icon.jsx'
import { FONT_OPTIONS } from '../../theme/tokens.js'
import { useProposalTheme } from '../../theme/ProposalThemeContext.jsx'
import SettingsSection from './SettingsSection.jsx'
import ThemePicker from './ThemePicker.jsx'
import {
  AreaField,
  ColorField,
  FileField,
  SelectField,
  SliderField,
  TextField,
  ToggleField,
} from './SettingsFields.jsx'
import styles from './ProposalSettingsPanel.module.css'

const FONTS = FONT_OPTIONS.map((font) => ({ id: font.id, label: font.label }))

function ProposalSettingsPanel({ open, onClose }) {
  const { design, patch, applyTheme } = useProposalTheme()
  if (!open) return null

  const d = design

  return (
    <aside className={styles.panel} aria-label="Proposal settings">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Design</p>
          <h2 className={styles.title}>Proposal settings</h2>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close settings">
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.scroll}>
        <SettingsSection title="Branding">
          <FileField
            label="Logo"
            value={d.branding.logo}
            onChange={(value) => patch('branding.logo', value)}
          />
          <FileField
            label="Light logo"
            value={d.branding.logoLight}
            onChange={(value) => patch('branding.logoLight', value)}
          />
          <FileField
            label="Dark logo"
            value={d.branding.logoDark}
            onChange={(value) => patch('branding.logoDark', value)}
          />
          <FileField
            label="Brand icon"
            value={d.branding.icon}
            onChange={(value) => patch('branding.icon', value)}
          />
          <FileField
            label="Favicon"
            hint="Placeholder — stored locally."
            value={d.branding.favicon}
            onChange={(value) => patch('branding.favicon', value)}
          />
          <SliderField
            label="Logo size"
            min={16}
            max={96}
            value={d.branding.logoSize}
            unit="px"
            onChange={(value) => patch('branding.logoSize', value)}
          />
          <SelectField
            label="Logo alignment"
            value={d.branding.logoAlign}
            onChange={(value) => patch('branding.logoAlign', value)}
            options={[
              { id: 'start', label: 'Start' },
              { id: 'center', label: 'Center' },
              { id: 'end', label: 'End' },
            ]}
          />
          <SliderField
            label="Logo spacing"
            min={0}
            max={40}
            value={d.branding.logoSpacing}
            unit="px"
            onChange={(value) => patch('branding.logoSpacing', value)}
          />
          <ColorField
            label="Brand / accent"
            value={d.colors.accent}
            onChange={(value) => patch('colors.accent', value)}
          />
          <ColorField
            label="Primary button"
            value={d.colors.buttonPrimary}
            onChange={(value) => patch('colors.buttonPrimary', value)}
          />
        </SettingsSection>

        <SettingsSection title="Theme" defaultOpen>
          <ThemePicker value={d.themeId} onChange={applyTheme} />
        </SettingsSection>

        <SettingsSection title="Typography">
          <SelectField
            label="Heading font"
            value={d.typography.headingFont}
            onChange={(value) => patch('typography.headingFont', value)}
            options={FONTS}
          />
          <SelectField
            label="Body font"
            value={d.typography.bodyFont}
            onChange={(value) => patch('typography.bodyFont', value)}
            options={FONTS}
          />
          <SliderField
            label="Font scale"
            min={0.85}
            max={1.25}
            step={0.01}
            value={d.typography.scale}
            onChange={(value) => patch('typography.scale', value)}
          />
          <SliderField
            label="Letter spacing"
            min={-0.06}
            max={0.08}
            step={0.005}
            value={d.typography.letterSpacing}
            unit="em"
            onChange={(value) => patch('typography.letterSpacing', value)}
          />
          <SliderField
            label="Paragraph spacing"
            min={0.6}
            max={2}
            step={0.05}
            value={d.typography.paragraphSpacing}
            unit="em"
            onChange={(value) => patch('typography.paragraphSpacing', value)}
          />
          <SliderField
            label="Line height"
            min={1.3}
            max={1.9}
            step={0.05}
            value={d.typography.lineHeight}
            onChange={(value) => patch('typography.lineHeight', value)}
          />
          <SliderField
            label="Button weight"
            min={400}
            max={800}
            step={50}
            value={d.typography.buttonWeight}
            onChange={(value) => patch('typography.buttonWeight', value)}
          />
        </SettingsSection>

        <SettingsSection title="Colors">
          <ColorField label="Background" value={d.colors.background} onChange={(v) => patch('colors.background', v)} />
          <ColorField label="Surface" value={d.colors.surface} onChange={(v) => patch('colors.surface', v)} />
          <ColorField label="Cards" value={d.colors.card} onChange={(v) => patch('colors.card', v)} />
          <ColorField label="Accent" value={d.colors.accent} onChange={(v) => patch('colors.accent', v)} />
          <ColorField label="Primary button" value={d.colors.buttonPrimary} onChange={(v) => patch('colors.buttonPrimary', v)} />
          <ColorField label="Secondary button" value={d.colors.buttonSecondary} onChange={(v) => patch('colors.buttonSecondary', v)} />
          <ColorField label="Text" value={d.colors.text} onChange={(v) => patch('colors.text', v)} />
          <ColorField label="Muted text" value={d.colors.muted} onChange={(v) => patch('colors.muted', v)} />
          <ColorField label="Links" value={d.colors.link} onChange={(v) => patch('colors.link', v)} />
          <ColorField label="Borders" value={d.colors.border} onChange={(v) => patch('colors.border', v)} />
          <ColorField label="Success" value={d.colors.success} onChange={(v) => patch('colors.success', v)} />
          <ColorField label="Warning" value={d.colors.warning} onChange={(v) => patch('colors.warning', v)} />
          <ColorField label="Error" value={d.colors.error} onChange={(v) => patch('colors.error', v)} />
          <ColorField label="Hover" value={d.colors.hover} onChange={(v) => patch('colors.hover', v)} />
        </SettingsSection>

        <SettingsSection title="Cover">
          <SelectField
            label="Hero layout"
            value={d.cover.layout}
            onChange={(v) => patch('cover.layout', v)}
            options={[
              { id: 'stacked', label: 'Stacked' },
              { id: 'split', label: 'Split' },
              { id: 'full-bleed', label: 'Full bleed' },
              { id: 'minimal', label: 'Minimal' },
            ]}
          />
          <SelectField
            label="Image position"
            value={d.cover.imagePosition}
            onChange={(v) => patch('cover.imagePosition', v)}
            options={[
              { id: 'top', label: 'Top' },
              { id: 'bottom', label: 'Bottom' },
              { id: 'background', label: 'Background' },
            ]}
          />
          <SliderField label="Image size" min={40} max={140} value={d.cover.imageSize} unit="%" onChange={(v) => patch('cover.imageSize', v)} />
          <SliderField label="Overlay strength" min={0} max={0.7} step={0.02} value={d.cover.overlay} onChange={(v) => patch('cover.overlay', v)} />
          <FileField
            label="Background image"
            value={d.cover.backgroundImage}
            onChange={(v) => patch('cover.backgroundImage', v)}
          />
          <ToggleField label="Gradient wash" checked={d.cover.gradient} onChange={(v) => patch('cover.gradient', v)} />
          <SelectField
            label="Pattern"
            value={d.cover.pattern}
            onChange={(v) => patch('cover.pattern', v)}
            options={[
              { id: 'none', label: 'None' },
              { id: 'dots', label: 'Dots' },
              { id: 'grid', label: 'Grid' },
            ]}
          />
          <SelectField
            label="Alignment"
            value={d.cover.align}
            onChange={(v) => patch('cover.align', v)}
            options={[
              { id: 'start', label: 'Start' },
              { id: 'center', label: 'Center' },
              { id: 'end', label: 'End' },
            ]}
          />
          <SliderField label="Content width" min={60} max={100} value={d.cover.contentWidth} unit="%" onChange={(v) => patch('cover.contentWidth', v)} />
          <SliderField label="Padding" min={12} max={80} value={d.cover.padding} unit="px" onChange={(v) => patch('cover.padding', v)} />
        </SettingsSection>

        <SettingsSection title="Header & Footer">
          <ToggleField label="Show logo" checked={d.chrome.showLogo} onChange={(v) => patch('chrome.showLogo', v)} />
          <ToggleField label="Show company info" checked={d.chrome.showCompany} onChange={(v) => patch('chrome.showCompany', v)} />
          <ToggleField label="Show proposal number" checked={d.chrome.showNumber} onChange={(v) => patch('chrome.showNumber', v)} />
          <ToggleField label="Show page numbers" checked={d.chrome.showPageNumbers} onChange={(v) => patch('chrome.showPageNumbers', v)} />
          <ToggleField label="Show footer notes" checked={d.chrome.showFooterNotes} onChange={(v) => patch('chrome.showFooterNotes', v)} />
          <ToggleField label="Show confidentiality badge" checked={d.chrome.showConfidential} onChange={(v) => patch('chrome.showConfidential', v)} />
          <ToggleField label="Show expiry" checked={d.chrome.showExpiry} onChange={(v) => patch('chrome.showExpiry', v)} />
          <SelectField
            label="Footer alignment"
            value={d.chrome.footerAlign}
            onChange={(v) => patch('chrome.footerAlign', v)}
            options={[
              { id: 'space-between', label: 'Spread' },
              { id: 'center', label: 'Center' },
              { id: 'flex-start', label: 'Start' },
            ]}
          />
          <SliderField label="Spacing" min={8} max={40} value={d.chrome.spacing} unit="px" onChange={(v) => patch('chrome.spacing', v)} />
        </SettingsSection>

        <SettingsSection title="Layout">
          <SliderField label="Container width" min={36} max={64} value={d.layout.containerWidth} unit="rem" onChange={(v) => patch('layout.containerWidth', v)} />
          <SliderField label="Section spacing" min={24} max={80} value={d.layout.sectionSpacing} unit="px" onChange={(v) => patch('layout.sectionSpacing', v)} />
          <SliderField label="Content spacing" min={8} max={32} value={d.layout.contentSpacing} unit="px" onChange={(v) => patch('layout.contentSpacing', v)} />
          <SliderField label="Card radius" min={0} max={32} value={d.layout.radius} unit="px" onChange={(v) => patch('layout.radius', v)} />
          <SliderField label="Shadow intensity" min={0} max={0.6} step={0.02} value={d.layout.shadow} onChange={(v) => patch('layout.shadow', v)} />
          <SliderField label="Grid spacing" min={8} max={32} value={d.layout.gridGap} unit="px" onChange={(v) => patch('layout.gridGap', v)} />
          <SliderField label="Column width" min={48} max={80} value={d.layout.columnWidth} unit="ch" onChange={(v) => patch('layout.columnWidth', v)} />
          <SelectField
            label="Animation density"
            value={d.layout.motionDensity}
            onChange={(v) => patch('layout.motionDensity', v)}
            options={[
              { id: 'quiet', label: 'Quiet' },
              { id: 'normal', label: 'Normal' },
              { id: 'expressive', label: 'Expressive' },
            ]}
          />
          <SliderField label="Margins" min={8} max={64} value={d.layout.margin} unit="px" onChange={(v) => patch('layout.margin', v)} />
          <SliderField label="Padding" min={8} max={64} value={d.layout.padding} unit="px" onChange={(v) => patch('layout.padding', v)} />
        </SettingsSection>

        <SettingsSection title="Components">
          <p className={styles.note}>
            Cards, buttons, pricing, testimonials, timelines, FAQs, tables, galleries and badges all read the same tokens. Change colors, radius, spacing or motion — the components follow.
          </p>
        </SettingsSection>

        <SettingsSection title="Motion">
          <SelectField
            label="Speed"
            value={d.motion.speed}
            onChange={(v) => patch('motion.speed', v)}
            options={[
              { id: 'fast', label: 'Fast (120–160ms)' },
              { id: 'normal', label: 'Normal (160–200ms)' },
              { id: 'slow', label: 'Slow (200–220ms)' },
            ]}
          />
          <SliderField
            label="Hover duration"
            min={120}
            max={220}
            step={10}
            value={Number.parseInt(d.motion.hover, 10) || 160}
            unit="ms"
            onChange={(v) => patch('motion.hover', `${v}ms`)}
          />
          <SliderField
            label="Button transition"
            min={120}
            max={220}
            step={10}
            value={Number.parseInt(d.motion.button, 10) || 180}
            unit="ms"
            onChange={(v) => patch('motion.button', `${v}ms`)}
          />
          <SliderField
            label="Card transition"
            min={120}
            max={220}
            step={10}
            value={Number.parseInt(d.motion.card, 10) || 160}
            unit="ms"
            onChange={(v) => patch('motion.card', `${v}ms`)}
          />
          <SliderField
            label="Section reveal"
            min={120}
            max={220}
            step={10}
            value={Number.parseInt(d.motion.reveal, 10) || 200}
            unit="ms"
            onChange={(v) => patch('motion.reveal', `${v}ms`)}
          />
          <SliderField
            label="Page transition"
            min={120}
            max={220}
            step={10}
            value={Number.parseInt(d.motion.page, 10) || 220}
            unit="ms"
            onChange={(v) => patch('motion.page', `${v}ms`)}
          />
        </SettingsSection>

        <SettingsSection title="Page behavior">
          <ToggleField label="Sticky header" checked={d.page.stickyHeader} onChange={(v) => patch('page.stickyHeader', v)} />
          <ToggleField label="Reading progress" checked={d.page.showProgress} onChange={(v) => patch('page.showProgress', v)} />
          <ToggleField label="Compact on mobile" checked={d.page.compactMobile} onChange={(v) => patch('page.compactMobile', v)} />
        </SettingsSection>

        <SettingsSection title="Proposal metadata">
          <TextField label="Proposal number" value={d.metadata.number} onChange={(v) => patch('metadata.number', v)} />
          <TextField label="Version" value={d.metadata.version} onChange={(v) => patch('metadata.version', v)} />
          <TextField label="Issue date" type="date" value={d.metadata.issueDate} onChange={(v) => patch('metadata.issueDate', v)} />
          <TextField label="Expiry date" type="date" value={d.metadata.expiryDate} onChange={(v) => patch('metadata.expiryDate', v)} />
          <TextField label="Prepared by" value={d.metadata.preparedBy} onChange={(v) => patch('metadata.preparedBy', v)} />
          <TextField label="Prepared for" value={d.metadata.preparedFor} onChange={(v) => patch('metadata.preparedFor', v)} />
          <ToggleField label="Confidential" checked={d.metadata.confidential} onChange={(v) => patch('metadata.confidential', v)} />
          <ToggleField label="Draft watermark" checked={d.metadata.draftWatermark} onChange={(v) => patch('metadata.draftWatermark', v)} />
          <AreaField
            label="Internal notes (editor only)"
            value={d.metadata.internalNotes}
            onChange={(v) => patch('metadata.internalNotes', v)}
            placeholder="Never shown to the client."
          />
        </SettingsSection>
      </div>
    </aside>
  )
}

export default ProposalSettingsPanel
