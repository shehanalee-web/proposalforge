const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="option"]',
  '[data-card-interactive]',
].join(',')

/**
 * Nested controls (menus, buttons, badges) should keep their own click and
 * not activate the surrounding card.
 *
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
export function isCardInteractiveTarget(target) {
  const element =
    target instanceof Element ? target : target?.parentElement ?? null

  if (!element) return false

  const match = element.closest(INTERACTIVE_SELECTOR)
  return Boolean(match && !match.hasAttribute('data-card-link'))
}

/**
 * Native links ignore Space. Cards should activate on Enter and Space.
 *
 * @param {KeyboardEvent} event
 */
export function handleCardLinkKeyDown(event) {
  if (event.key !== ' ' && event.key !== 'Spacebar') return

  event.preventDefault()
  event.currentTarget.click()
}

/**
 * Clicking padding, meta text or empty card area should follow the title link.
 * Nested interactive targets are ignored.
 *
 * @param {MouseEvent} event
 */
export function handleCardClick(event) {
  if (event.defaultPrevented) return
  if (isCardInteractiveTarget(event.target)) return

  const root = event.currentTarget
  if (!(root instanceof Element)) return

  const link = root.querySelector('[data-card-link]')
  if (!(link instanceof HTMLAnchorElement)) return
  if (link.contains(event.target instanceof Node ? event.target : null)) return

  if (event.metaKey || event.ctrlKey) {
    window.open(link.href, '_blank', 'noopener,noreferrer')
    return
  }

  link.click()
}
