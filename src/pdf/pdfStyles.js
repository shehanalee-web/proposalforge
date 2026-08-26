import { StyleSheet } from '@react-pdf/renderer'

export const colors = {
  ink: '#111111',
  muted: '#52525b',
  line: '#e4e4e7',
  accent: '#14b8a6',
  paper: '#ffffff',
  band: '#111111',
  bandText: '#f4f4f5',
  soft: '#f4f4f5',
}

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.45,
    color: colors.ink,
    backgroundColor: colors.paper,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  pageLandscape: {
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 36,
  },

  header: {
    marginBottom: 22,
  },
  brandBand: {
    backgroundColor: colors.band,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  brandMark: {
    width: 18,
    height: 18,
    backgroundColor: colors.accent,
    marginBottom: 8,
  },
  studioName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: colors.bandText,
    letterSpacing: 0.3,
  },
  studioAbout: {
    marginTop: 4,
    fontSize: 8,
    color: '#a1a1aa',
    maxWidth: 260,
  },
  proposalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.accent,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  proposalTitle: {
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: colors.bandText,
    textAlign: 'right',
    maxWidth: 240,
  },
  accentBar: {
    height: 3,
    backgroundColor: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 2,
  },
  metaItem: {
    minWidth: 90,
  },
  metaLabel: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: colors.ink,
  },

  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 8,
  },
  body: {
    fontSize: 10,
    color: colors.ink,
  },
  muted: {
    color: colors.muted,
  },

  clientGrid: {
    flexDirection: 'row',
    gap: 24,
  },
  clientColumn: {
    flex: 1,
  },
  clientName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 2,
  },

  projectHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  projectType: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 10,
  },
  scopeBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.soft,
  },
  scopeHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 4,
  },

  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.band,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.bandText,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  colDesc: {
    flexGrow: 1,
    flexBasis: 0,
    paddingRight: 12,
  },
  colAmount: {
    width: 90,
    textAlign: 'right',
  },
  totals: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    width: 220,
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 9,
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    width: 90,
    textAlign: 'right',
  },
  grandTotal: {
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: colors.ink,
    paddingTop: 6,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    width: 90,
    textAlign: 'right',
    color: colors.accent,
  },

  termItem: {
    marginBottom: 8,
  },
  termTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginBottom: 2,
  },
  termBody: {
    fontSize: 9,
    color: colors.muted,
  },

  footer: {
    position: 'absolute',
    left: 48,
    right: 48,
    bottom: 24,
  },
  footerRule: {
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: colors.muted,
  },

  pageRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  pageRowCol: {
    flex: 1,
    minWidth: 0,
  },

  signatureRow: {
    flexDirection: 'row',
    gap: 28,
  },
  signatureCol: {
    flex: 1,
  },
  signatureLine: {
    minHeight: 22,
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    justifyContent: 'flex-end',
  },

  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  galleryItem: {
    width: '31%',
  },
  galleryImage: {
    width: '100%',
    height: 90,
    objectFit: 'cover',
    marginBottom: 4,
    backgroundColor: colors.soft,
  },
})
