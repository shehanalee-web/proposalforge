import ImageUpload from '../../components/ImageUpload/ImageUpload.jsx'
import {
  BRAND_FONTS,
  HEX_COLOR_PATTERN,
  SOCIAL_NETWORK_LABELS,
  SOCIAL_NETWORKS,
  TAX_MODE,
  TAX_MODES,
  makeAssetRef,
  makeBrandTeamMember,
  makeBrandTestimonial,
  makeSocialLink,
} from '../../models/brandKit.js'
import styles from './BrandKitForm.module.css'

const TAX_MODE_LABELS = {
  [TAX_MODE.NONE]: 'No tax',
  [TAX_MODE.EXCLUSIVE]: 'Exclusive — add tax on top',
  [TAX_MODE.INCLUSIVE]: 'Inclusive — prices already include tax',
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'PF'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function toColorInput(value) {
  const hex = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  return '#14b8a6'
}

function Field({ id, label, error, hint, className, children }) {
  return (
    <div className={`${styles.field} ${className ?? ''}`.trim()}>
      {label ? (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Card({ kicker, title, lede, children }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <p className={styles.cardKicker}>{kicker}</p>
        <h2 className={styles.cardTitle}>{title}</h2>
        {lede ? <p className={styles.cardLede}>{lede}</p> : null}
      </header>
      {children}
    </section>
  )
}

function ColorField({ id, label, value, error, disabled, onChange }) {
  const pickerValue = HEX_COLOR_PATTERN.test(value.trim())
    ? toColorInput(value)
    : '#14b8a6'

  return (
    <Field id={id} label={label} error={error}>
      <div className={styles.colorRow}>
        <input
          id={`${id}-picker`}
          type="color"
          className={styles.colorPicker}
          value={pickerValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label={`${label} picker`}
        />
        <input
          id={id}
          type="text"
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="#14b8a6"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
    </Field>
  )
}

function BrandKitForm({
  values,
  onChange,
  onSubmit,
  submitting,
  fieldErrors,
}) {
  function patch(partial) {
    onChange((current) => ({ ...current, ...partial }))
  }

  function handleAsset(path, url, asset) {
    const ref = url ? makeAssetRef({ assetId: asset?.id ?? null, url }) : makeAssetRef()

    onChange((current) => {
      if (path === 'signature.image') {
        return { ...current, signature: { ...current.signature, image: ref } }
      }

      return {
        ...current,
        logos: { ...current.logos, [path]: ref },
      }
    })
  }

  const previewLogo =
    values.logos.primary.url || values.logos.light.url || values.logos.dark.url

  return (
    <form id="brand-kit-form" className={styles.form} onSubmit={onSubmit} noValidate>
      <Card
        kicker="Identity"
        title="Company"
        lede="This name and description appear on every proposal, template preview and PDF."
      >
        <div className={styles.preview}>
          {previewLogo ? (
            <img src={previewLogo} alt="" className={styles.previewMark} />
          ) : (
            <span className={styles.previewFallback}>
              {initials(values.companyName)}
            </span>
          )}
          <div>
            <p className={styles.previewName}>
              {values.companyName.trim() || 'Your company'}
            </p>
            <p className={styles.previewMeta}>Inherited by all future documents</p>
          </div>
          <div className={styles.swatches} aria-hidden="true">
            {['primary', 'secondary', 'accent'].map((key) => (
              <span
                key={key}
                className={styles.swatch}
                style={{
                  background:
                    HEX_COLOR_PATTERN.test(values.colors[key]?.trim())
                      ? values.colors[key]
                      : 'transparent',
                }}
              />
            ))}
          </div>
        </div>

        <div className={styles.grid}>
          <Field
            id="companyName"
            label="Company name"
            error={fieldErrors.companyName}
            className={styles.span2}
          >
            <input
              id="companyName"
              type="text"
              className={styles.input}
              value={values.companyName}
              onChange={(event) => patch({ companyName: event.target.value })}
              disabled={submitting}
              autoComplete="organization"
              aria-invalid={Boolean(fieldErrors.companyName)}
              required
            />
          </Field>

          <Field
            id="description"
            label="Company description"
            error={fieldErrors.description}
            className={styles.span2}
          >
            <textarea
              id="description"
              className={styles.textarea}
              rows={4}
              value={values.description}
              onChange={(event) => patch({ description: event.target.value })}
              disabled={submitting}
            />
          </Field>
        </div>
      </Card>

      <Card
        kicker="Marks"
        title="Logos & cover"
        lede="Upload files only — light surfaces use the white logo, dark surfaces use the dark logo."
      >
        <div className={styles.grid3}>
          <ImageUpload
            id="logo-primary"
            label="Company logo"
            value={values.logos.primary.url}
            size="logo"
            disabled={submitting}
            onChange={(url, asset) => handleAsset('primary', url, asset)}
          />
          <ImageUpload
            id="logo-light"
            label="White logo"
            value={values.logos.light.url}
            size="logo"
            tone="dark"
            disabled={submitting}
            onChange={(url, asset) => handleAsset('light', url, asset)}
          />
          <ImageUpload
            id="logo-dark"
            label="Dark logo"
            value={values.logos.dark.url}
            size="logo"
            tone="light"
            disabled={submitting}
            onChange={(url, asset) => handleAsset('dark', url, asset)}
          />
          <ImageUpload
            id="logo-favicon"
            label="Favicon"
            value={values.logos.favicon.url}
            size="favicon"
            disabled={submitting}
            onChange={(url, asset) => handleAsset('favicon', url, asset)}
          />
          <ImageUpload
            id="logo-cover"
            label="Cover image"
            value={values.logos.cover.url}
            size="cover"
            disabled={submitting}
            onChange={(url, asset) => handleAsset('cover', url, asset)}
          />
        </div>
      </Card>

      <Card
        kicker="Palette"
        title="Brand colours"
        lede="Primary, secondary and accent are applied to covers, buttons and document chrome."
      >
        <div className={styles.grid3}>
          <ColorField
            id="color-primary"
            label="Primary"
            value={values.colors.primary}
            error={fieldErrors['colors.primary']}
            disabled={submitting}
            onChange={(primary) =>
              patch({ colors: { ...values.colors, primary } })
            }
          />
          <ColorField
            id="color-secondary"
            label="Secondary"
            value={values.colors.secondary}
            error={fieldErrors['colors.secondary']}
            disabled={submitting}
            onChange={(secondary) =>
              patch({ colors: { ...values.colors, secondary } })
            }
          />
          <ColorField
            id="color-accent"
            label="Accent"
            value={values.colors.accent}
            error={fieldErrors['colors.accent']}
            disabled={submitting}
            onChange={(accent) =>
              patch({ colors: { ...values.colors, accent } })
            }
          />
        </div>
      </Card>

      <Card
        kicker="Type"
        title="Font family"
        lede="One typeface for headings and body copy across studio preview, portal and PDF."
      >
        <Field
          id="fontFamily"
          label="Font family"
          error={fieldErrors['typography.fontFamily']}
        >
          <select
            id="fontFamily"
            className={styles.select}
            value={values.typography.fontFamily}
            onChange={(event) =>
              patch({
                typography: {
                  ...values.typography,
                  fontFamily: event.target.value,
                },
              })
            }
            disabled={submitting}
            style={{ fontFamily: `var(--font-sans)` }}
          >
            {BRAND_FONTS.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
                {font.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card
        kicker="Contact"
        title="How clients reach you"
        lede="Address and details print in headers, footers and the client portal."
      >
        <div className={styles.grid}>
          <Field id="website" label="Website" error={fieldErrors['contact.website']}>
            <input
              id="website"
              type="text"
              className={styles.input}
              value={values.contact.website}
              onChange={(event) =>
                patch({ contact: { ...values.contact, website: event.target.value } })
              }
              disabled={submitting}
              autoComplete="url"
              placeholder="yourstudio.com"
            />
          </Field>
          <Field id="email" label="Email" error={fieldErrors['contact.email']}>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={values.contact.email}
              onChange={(event) =>
                patch({ contact: { ...values.contact, email: event.target.value } })
              }
              disabled={submitting}
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors['contact.email'])}
            />
          </Field>
          <Field id="phone" label="Phone" error={fieldErrors['contact.phone']}>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              value={values.contact.phone}
              onChange={(event) =>
                patch({ contact: { ...values.contact, phone: event.target.value } })
              }
              disabled={submitting}
              autoComplete="tel"
            />
          </Field>
          <Field
            id="address"
            label="Address"
            error={fieldErrors['contact.address']}
            className={styles.span2}
          >
            <textarea
              id="address"
              className={styles.textarea}
              rows={3}
              value={values.contact.address}
              onChange={(event) =>
                patch({ contact: { ...values.contact, address: event.target.value } })
              }
              disabled={submitting}
              autoComplete="street-address"
            />
          </Field>
        </div>
      </Card>

      <Card
        kicker="Presence"
        title="Social links"
        lede="Handles only — documents pick the right network mark automatically."
      >
        <div className={styles.stack}>
          {values.socialLinks.length === 0 ? (
            <p className={styles.empty}>No social profiles yet.</p>
          ) : (
            values.socialLinks.map((link, index) => (
              <div key={link.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <p className={styles.itemTitle}>Profile {index + 1}</p>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={submitting}
                    onClick={() =>
                      patch({
                        socialLinks: values.socialLinks.filter(
                          (entry) => entry.id !== link.id,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.grid}>
                  <Field id={`${link.id}-network`} label="Network">
                    <select
                      id={`${link.id}-network`}
                      className={styles.select}
                      value={link.network}
                      disabled={submitting}
                      onChange={(event) =>
                        patch({
                          socialLinks: values.socialLinks.map((entry) =>
                            entry.id === link.id
                              ? { ...entry, network: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    >
                      {SOCIAL_NETWORKS.map((network) => (
                        <option key={network} value={network}>
                          {SOCIAL_NETWORK_LABELS[network]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id={`${link.id}-handle`}
                    label="Handle"
                    error={fieldErrors[`socialLinks.${index}.handle`]}
                  >
                    <input
                      id={`${link.id}-handle`}
                      type="text"
                      className={styles.input}
                      value={link.handle}
                      disabled={submitting}
                      placeholder="@studio"
                      onChange={(event) =>
                        patch({
                          socialLinks: values.socialLinks.map((entry) =>
                            entry.id === link.id
                              ? { ...entry, handle: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            className={styles.add}
            disabled={submitting}
            onClick={() =>
              patch({ socialLinks: [...values.socialLinks, makeSocialLink()] })
            }
          >
            Add social profile
          </button>
        </div>
      </Card>

      <Card
        kicker="Acceptance"
        title="Default signature"
        lede="The authorised signatory on every proposal until a document overrides it."
      >
        <div className={styles.grid}>
          <Field id="sig-name" label="Signatory name" error={fieldErrors['signature.name']}>
            <input
              id="sig-name"
              type="text"
              className={styles.input}
              value={values.signature.name}
              disabled={submitting}
              autoComplete="name"
              onChange={(event) =>
                patch({
                  signature: { ...values.signature, name: event.target.value },
                })
              }
            />
          </Field>
          <Field id="sig-role" label="Title" error={fieldErrors['signature.role']}>
            <input
              id="sig-role"
              type="text"
              className={styles.input}
              value={values.signature.role}
              disabled={submitting}
              placeholder="Founder"
              onChange={(event) =>
                patch({
                  signature: { ...values.signature, role: event.target.value },
                })
              }
            />
          </Field>
          <div className={styles.span2}>
            <ImageUpload
              id="sig-image"
              label="Signature image"
              value={values.signature.image.url}
              size="logo"
              tone="light"
              disabled={submitting}
              onChange={(url, asset) => handleAsset('signature.image', url, asset)}
            />
          </div>
        </div>
      </Card>

      <Card
        kicker="People"
        title="Team members"
        lede="Portraits and bios appear on proposals that include a Team block."
      >
        <div className={styles.stack}>
          {values.teamMembers.length === 0 ? (
            <p className={styles.empty}>Add the people who should appear on proposals.</p>
          ) : (
            values.teamMembers.map((member, index) => (
              <div key={member.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <p className={styles.itemTitle}>
                    {member.name.trim() || `Team member ${index + 1}`}
                  </p>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={submitting}
                    onClick={() =>
                      patch({
                        teamMembers: values.teamMembers.filter(
                          (entry) => entry.id !== member.id,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.grid}>
                  <ImageUpload
                    id={`${member.id}-photo`}
                    label="Portrait"
                    value={member.portrait.url}
                    size="portrait"
                    disabled={submitting}
                    onChange={(url, asset) =>
                      patch({
                        teamMembers: values.teamMembers.map((entry) =>
                          entry.id === member.id
                            ? {
                                ...entry,
                                portrait: url
                                  ? makeAssetRef({ assetId: asset?.id ?? null, url })
                                  : makeAssetRef(),
                              }
                            : entry,
                        ),
                      })
                    }
                  />
                  <div className={styles.stack}>
                    <Field
                      id={`${member.id}-name`}
                      label="Name"
                      error={fieldErrors[`teamMembers.${index}.name`]}
                    >
                      <input
                        id={`${member.id}-name`}
                        type="text"
                        className={styles.input}
                        value={member.name}
                        disabled={submitting}
                        aria-invalid={Boolean(fieldErrors[`teamMembers.${index}.name`])}
                        onChange={(event) =>
                          patch({
                            teamMembers: values.teamMembers.map((entry) =>
                              entry.id === member.id
                                ? { ...entry, name: event.target.value }
                                : entry,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field id={`${member.id}-role`} label="Role">
                      <input
                        id={`${member.id}-role`}
                        type="text"
                        className={styles.input}
                        value={member.role}
                        disabled={submitting}
                        onChange={(event) =>
                          patch({
                            teamMembers: values.teamMembers.map((entry) =>
                              entry.id === member.id
                                ? { ...entry, role: event.target.value }
                                : entry,
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field
                    id={`${member.id}-bio`}
                    label="Bio"
                    className={styles.span2}
                  >
                    <textarea
                      id={`${member.id}-bio`}
                      className={styles.textarea}
                      rows={3}
                      value={member.bio}
                      disabled={submitting}
                      onChange={(event) =>
                        patch({
                          teamMembers: values.teamMembers.map((entry) =>
                            entry.id === member.id
                              ? { ...entry, bio: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            className={styles.add}
            disabled={submitting}
            onClick={() =>
              patch({
                teamMembers: [...values.teamMembers, makeBrandTeamMember()],
              })
            }
          >
            Add team member
          </button>
        </div>
      </Card>

      <Card
        kicker="Proof"
        title="Testimonials"
        lede="Quotes reused on any proposal that includes a Testimonials block."
      >
        <div className={styles.stack}>
          {values.testimonials.length === 0 ? (
            <p className={styles.empty}>Add client quotes once, then inherit them everywhere.</p>
          ) : (
            values.testimonials.map((item, index) => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <p className={styles.itemTitle}>
                    {item.authorName.trim() || `Testimonial ${index + 1}`}
                  </p>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={submitting}
                    onClick={() =>
                      patch({
                        testimonials: values.testimonials.filter(
                          (entry) => entry.id !== item.id,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.grid}>
                  <ImageUpload
                    id={`${item.id}-portrait`}
                    label="Portrait"
                    value={item.portrait.url}
                    size="portrait"
                    disabled={submitting}
                    onChange={(url, asset) =>
                      patch({
                        testimonials: values.testimonials.map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                portrait: url
                                  ? makeAssetRef({ assetId: asset?.id ?? null, url })
                                  : makeAssetRef(),
                              }
                            : entry,
                        ),
                      })
                    }
                  />
                  <div className={styles.stack}>
                    <Field
                      id={`${item.id}-author`}
                      label="Author"
                      error={fieldErrors[`testimonials.${index}.authorName`]}
                    >
                      <input
                        id={`${item.id}-author`}
                        type="text"
                        className={styles.input}
                        value={item.authorName}
                        disabled={submitting}
                        onChange={(event) =>
                          patch({
                            testimonials: values.testimonials.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, authorName: event.target.value }
                                : entry,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field id={`${item.id}-role`} label="Role">
                      <input
                        id={`${item.id}-role`}
                        type="text"
                        className={styles.input}
                        value={item.authorRole}
                        disabled={submitting}
                        onChange={(event) =>
                          patch({
                            testimonials: values.testimonials.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, authorRole: event.target.value }
                                : entry,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field id={`${item.id}-company`} label="Company">
                      <input
                        id={`${item.id}-company`}
                        type="text"
                        className={styles.input}
                        value={item.company}
                        disabled={submitting}
                        onChange={(event) =>
                          patch({
                            testimonials: values.testimonials.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, company: event.target.value }
                                : entry,
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field
                    id={`${item.id}-quote`}
                    label="Quote"
                    error={fieldErrors[`testimonials.${index}.quote`]}
                    className={styles.span2}
                  >
                    <textarea
                      id={`${item.id}-quote`}
                      className={styles.textarea}
                      rows={3}
                      value={item.quote}
                      disabled={submitting}
                      aria-invalid={Boolean(
                        fieldErrors[`testimonials.${index}.quote`],
                      )}
                      onChange={(event) =>
                        patch({
                          testimonials: values.testimonials.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, quote: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            className={styles.add}
            disabled={submitting}
            onClick={() =>
              patch({
                testimonials: [...values.testimonials, makeBrandTestimonial()],
              })
            }
          >
            Add testimonial
          </button>
        </div>
      </Card>

      <Card
        kicker="Legal"
        title="Terms"
        lede="Default language for new proposals. A document can still override it."
      >
        <div className={styles.grid}>
          <Field
            id="terms"
            label="Terms & conditions"
            error={fieldErrors.terms}
            className={styles.span2}
          >
            <textarea
              id="terms"
              className={styles.textarea}
              rows={6}
              value={values.terms}
              disabled={submitting}
              onChange={(event) => patch({ terms: event.target.value })}
            />
          </Field>
          <Field
            id="paymentTerms"
            label="Payment terms"
            error={fieldErrors.paymentTerms}
            className={styles.span2}
          >
            <textarea
              id="paymentTerms"
              className={styles.textarea}
              rows={5}
              value={values.paymentTerms}
              disabled={submitting}
              onChange={(event) => patch({ paymentTerms: event.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card
        kicker="Finance"
        title="Bank details & tax"
        lede="Invoicing identity used when a proposal includes payment instructions."
      >
        <div className={styles.grid}>
          <Field id="accountName" label="Account name">
            <input
              id="accountName"
              type="text"
              className={styles.input}
              value={values.bank.accountName}
              disabled={submitting}
              onChange={(event) =>
                patch({ bank: { ...values.bank, accountName: event.target.value } })
              }
            />
          </Field>
          <Field id="bankName" label="Bank name">
            <input
              id="bankName"
              type="text"
              className={styles.input}
              value={values.bank.bankName}
              disabled={submitting}
              onChange={(event) =>
                patch({ bank: { ...values.bank, bankName: event.target.value } })
              }
            />
          </Field>
          <Field id="accountNumber" label="Account number">
            <input
              id="accountNumber"
              type="text"
              className={styles.input}
              value={values.bank.accountNumber}
              disabled={submitting}
              autoComplete="off"
              onChange={(event) =>
                patch({
                  bank: { ...values.bank, accountNumber: event.target.value },
                })
              }
            />
          </Field>
          <Field id="sortCode" label="Sort code">
            <input
              id="sortCode"
              type="text"
              className={styles.input}
              value={values.bank.sortCode}
              disabled={submitting}
              onChange={(event) =>
                patch({ bank: { ...values.bank, sortCode: event.target.value } })
              }
            />
          </Field>
          <Field id="iban" label="IBAN">
            <input
              id="iban"
              type="text"
              className={styles.input}
              value={values.bank.iban}
              disabled={submitting}
              onChange={(event) =>
                patch({ bank: { ...values.bank, iban: event.target.value } })
              }
            />
          </Field>
          <Field id="swift" label="SWIFT / BIC">
            <input
              id="swift"
              type="text"
              className={styles.input}
              value={values.bank.swift}
              disabled={submitting}
              onChange={(event) =>
                patch({ bank: { ...values.bank, swift: event.target.value } })
              }
            />
          </Field>
          <Field id="vatNumber" label="VAT number">
            <input
              id="vatNumber"
              type="text"
              className={styles.input}
              value={values.vatNumber}
              disabled={submitting}
              onChange={(event) => patch({ vatNumber: event.target.value })}
            />
          </Field>
          <Field id="taxId" label="Tax ID">
            <input
              id="taxId"
              type="text"
              className={styles.input}
              value={values.tax.taxId}
              disabled={submitting}
              onChange={(event) =>
                patch({ tax: { ...values.tax, taxId: event.target.value } })
              }
            />
          </Field>
          <Field id="taxRate" label="Tax rate (%)" error={fieldErrors['tax.rate']}>
            <input
              id="taxRate"
              type="text"
              inputMode="decimal"
              className={styles.input}
              value={values.tax.rate}
              disabled={submitting}
              placeholder="20"
              aria-invalid={Boolean(fieldErrors['tax.rate'])}
              onChange={(event) =>
                patch({ tax: { ...values.tax, rate: event.target.value } })
              }
            />
          </Field>
          <Field id="taxMode" label="Tax settings" error={fieldErrors['tax.mode']}>
            <select
              id="taxMode"
              className={styles.select}
              value={values.tax.mode}
              disabled={submitting}
              onChange={(event) =>
                patch({ tax: { ...values.tax, mode: event.target.value } })
              }
            >
              {TAX_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {TAX_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </Field>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={values.tax.registered}
              disabled={submitting}
              onChange={(event) =>
                patch({
                  tax: { ...values.tax, registered: event.target.checked },
                })
              }
            />
            Tax registered
          </label>
        </div>
      </Card>
    </form>
  )
}

export default BrandKitForm
