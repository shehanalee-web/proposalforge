import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { activityAuthor, activityDescription } from '../models/activityEvent.js'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#18181b',
  },
  kicker: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#71717a',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  intro: {
    fontSize: 9,
    color: '#52525b',
    marginBottom: 16,
  },
  row: {
    paddingVertical: 8,
    borderBottom: '1px solid #e4e4e7',
  },
  eventTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 2,
  },
  detail: {
    color: '#3f3f46',
    marginBottom: 2,
  },
  meta: {
    fontSize: 8,
    color: '#71717a',
  },
})

function formatStamp(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ActivityLogDocument({ events = [], proposal }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>ProposalForge</Text>
        <Text style={styles.title}>Activity log</Text>
        <Text style={styles.intro}>
          {proposal?.title || 'Proposal'} · {events.length} event
          {events.length === 1 ? '' : 's'}
        </Text>
        {events.map((event) => (
          <View key={event.id} style={styles.row} wrap={false}>
            <Text style={styles.eventTitle}>{event.event_title}</Text>
            <Text style={styles.detail}>{activityDescription(event)}</Text>
            <Text style={styles.meta}>
              {activityAuthor(event)} · {formatStamp(event.created_at)}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}

export default ActivityLogDocument
