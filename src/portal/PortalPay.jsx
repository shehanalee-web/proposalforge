import ViewerDialog from '../viewer/ViewerDialog.jsx'
import { usePayProposal } from '../hooks/usePayProposal.js'
import { clientPaymentAmount, PAYMENT_STATUS } from '../models/payment.js'
import { formatCurrency } from '../utils/format.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalRequestChanges.module.css'

function PortalPay({ onClose, onPaid }) {
  const { token, proposal } = usePortal()
  const flow = usePayProposal()
  const payment = proposal?.payment
  const currency = payment?.currency || proposal?.currency
  const depositDue = clientPaymentAmount(payment, 'deposit')
  const balanceDue = clientPaymentAmount(payment, 'balance')
  const paid = payment?.status === PAYMENT_STATUS.PAID || balanceDue <= 0
  const showDeposit =
    depositDue > 0 && depositDue < balanceDue && Number(payment?.deposit ?? 0) > 0

  async function handlePay(kind) {
    const saved = await flow.pay(token, { kind })
    if (saved) {
      onPaid?.(saved)
      onClose()
    }
  }

  return (
    <ViewerDialog
      open
      title="Pay now"
      description="No card gateway is connected. This records a mock payment on the proposal so the commercial loop can close."
      onClose={onClose}
      footer={
        <button type="button" className={styles.secondary} onClick={onClose}>
          Close
        </button>
      }
    >
      <div className={styles.form}>
        {flow.error ? (
          <p className={styles.banner} role="alert">
            {flow.error.message}
          </p>
        ) : null}
        {paid ? (
          <p className={styles.note}>This proposal is paid in full.</p>
        ) : (
          <>
            <p className={styles.note}>
              Outstanding {formatCurrency(balanceDue, currency)}
              {payment?.paidAmount
                ? ` · already recorded ${formatCurrency(payment.paidAmount, currency)}`
                : ''}
            </p>
            {showDeposit ? (
              <button
                type="button"
                className={styles.submit}
                disabled={flow.submitting}
                onClick={() => handlePay('deposit')}
              >
                {flow.submitting
                  ? 'Recording…'
                  : `Pay deposit ${formatCurrency(depositDue, currency)}`}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.submit}
              disabled={flow.submitting}
              onClick={() => handlePay('balance')}
            >
              {flow.submitting
                ? 'Recording…'
                : `Pay ${formatCurrency(balanceDue, currency)}`}
            </button>
          </>
        )}
      </div>
    </ViewerDialog>
  )
}

export default PortalPay
