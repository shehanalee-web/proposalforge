import { BLOCK_TYPE } from './ids.js'
import {
  AttachmentsPdf,
  CoverPdf,
  CustomPdf,
  DeliverablesPdf,
  ExecutiveSummaryPdf,
  FaqPdf,
  GalleryPdf,
  PricingPdf,
  RichTextPdf,
  SignaturePdf,
  SpecificationsPdf,
  TeamPdf,
  TermsPdf,
  TestimonialsPdf,
  TimelinePdf,
} from './pdf.jsx'

const PDF = {
  [BLOCK_TYPE.COVER]: CoverPdf,
  [BLOCK_TYPE.EXECUTIVE_SUMMARY]: ExecutiveSummaryPdf,
  [BLOCK_TYPE.RICH_TEXT]: RichTextPdf,
  [BLOCK_TYPE.GALLERY]: GalleryPdf,
  [BLOCK_TYPE.PRICING]: PricingPdf,
  [BLOCK_TYPE.TIMELINE]: TimelinePdf,
  [BLOCK_TYPE.DELIVERABLES]: DeliverablesPdf,
  [BLOCK_TYPE.SPECIFICATIONS]: SpecificationsPdf,
  [BLOCK_TYPE.TEAM]: TeamPdf,
  [BLOCK_TYPE.TESTIMONIALS]: TestimonialsPdf,
  [BLOCK_TYPE.FAQ]: FaqPdf,
  [BLOCK_TYPE.TERMS]: TermsPdf,
  [BLOCK_TYPE.SIGNATURE]: SignaturePdf,
  [BLOCK_TYPE.ATTACHMENTS]: AttachmentsPdf,
  [BLOCK_TYPE.CUSTOM]: CustomPdf,
}

export function getPdfRenderer(type) {
  return PDF[type] ?? CustomPdf
}
