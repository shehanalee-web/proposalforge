import { BLOCK_VARIABLES, defaultBlockSettings } from '../../models/contentBlock.js'
import { getBlockMeta } from '../../blocks/editor/blockMeta.js'
import Icon from '../Icon/Icon.jsx'
import SettingsSection from '../ProposalSettings/SettingsSection.jsx'
import {
  ColorField,
  SelectField,
  SliderField,
  ToggleField,
} from '../ProposalSettings/SettingsFields.jsx'
import styles from './BlockInspector.module.css'

function BlockInspector({
  block,
  open,
  onClose,
  onSettings,
  onEnabled,
}) {
  if (!open || !block) return null

  const meta = getBlockMeta(block.type)
  const settings = defaultBlockSettings(block.settings ?? {})

  return (
    <aside className={styles.panel} aria-label="Block inspector">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Inspector</p>
          <h2 className={styles.title}>{meta.short}</h2>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close inspector">
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.scroll}>
        <SettingsSection title="General" defaultOpen>
          <p className={styles.note}>{meta.description}</p>
          <ToggleField
            label="Visible on proposal"
            checked={block.enabled !== false && settings.visible}
            onChange={(value) => {
              onEnabled?.(value)
              onSettings({ visible: value })
            }}
          />
          {block.libraryId ? (
            <p className={styles.note}>Linked library block · {block.libraryId}</p>
          ) : (
            <p className={styles.note}>Local instance — not linked to the library.</p>
          )}
        </SettingsSection>

        <SettingsSection title="Style">
          <ColorField
            label="Background"
            value={settings.background || '#171717'}
            onChange={(value) => onSettings({ background: value })}
          />
          <ColorField
            label="Text"
            value={settings.color || '#f4f4f5'}
            onChange={(value) => onSettings({ color: value })}
          />
          <ToggleField
            label="Border"
            checked={settings.border}
            onChange={(value) => onSettings({ border: value })}
          />
          <SliderField
            label="Radius"
            min={0}
            max={32}
            value={settings.radius ?? 14}
            unit="px"
            onChange={(value) => onSettings({ radius: value })}
          />
        </SettingsSection>

        <SettingsSection title="Spacing">
          <SliderField
            label="Padding"
            min={0}
            max={64}
            value={settings.padding ?? 24}
            unit="px"
            onChange={(value) => onSettings({ padding: value })}
          />
        </SettingsSection>

        <SettingsSection title="Typography">
          <SliderField
            label="Letter spacing"
            min={-0.06}
            max={0.08}
            step={0.005}
            value={settings.letterSpacing ?? -0.02}
            unit="em"
            onChange={(value) => onSettings({ letterSpacing: value })}
          />
          <SliderField
            label="Line height"
            min={1.3}
            max={1.9}
            step={0.05}
            value={settings.lineHeight ?? 1.6}
            onChange={(value) => onSettings({ lineHeight: value })}
          />
        </SettingsSection>

        <SettingsSection title="Visibility">
          <ToggleField
            label="Hide when empty"
            checked={settings.hideWhenEmpty}
            onChange={(value) => onSettings({ hideWhenEmpty: value })}
          />
        </SettingsSection>

        <SettingsSection title="Conditions">
          <SelectField
            label="Show this block"
            value={settings.condition}
            onChange={(value) => onSettings({ condition: value })}
            options={[
              { id: 'always', label: 'Always (if enabled)' },
              { id: 'has_amount', label: 'Only if project value is set' },
              { id: 'has_client', label: 'Only if client name is set' },
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Variables">
          <p className={styles.note}>
            Tokens in this block’s copy update live in preview, the client viewer and PDF.
          </p>
          <ul className={styles.tokens}>
            {BLOCK_VARIABLES.map((item) => (
              <li key={item.id}>
                <code>{`{{${item.id}}}`}</code>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>

        <SettingsSection title="Animations">
          <SelectField
            label="Reveal"
            value={settings.animation}
            onChange={(value) => onSettings({ animation: value })}
            options={[
              { id: 'quiet', label: 'Quiet' },
              { id: 'normal', label: 'Normal' },
              { id: 'expressive', label: 'Expressive' },
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Advanced">
          <p className={styles.note}>
            Future AI can read this block’s type, category and expected inputs without a UI change.
          </p>
        </SettingsSection>
      </div>
    </aside>
  )
}

export default BlockInspector
