import { BLOCK_TYPE } from './ids.js'
import {
  AttachmentsScreen,
  CoverScreen,
  CustomScreen,
  DeliverablesScreen,
  ExecutiveSummaryScreen,
  FaqScreen,
  GalleryScreen,
  PricingScreen,
  RichTextScreen,
  SignatureScreen,
  SpecificationsScreen,
  TeamScreen,
  TermsScreen,
  TestimonialsScreen,
  TimelineScreen,
} from './screen.jsx'

const SCREEN = {
  [BLOCK_TYPE.COVER]: CoverScreen,
  [BLOCK_TYPE.EXECUTIVE_SUMMARY]: ExecutiveSummaryScreen,
  [BLOCK_TYPE.RICH_TEXT]: RichTextScreen,
  [BLOCK_TYPE.GALLERY]: GalleryScreen,
  [BLOCK_TYPE.PRICING]: PricingScreen,
  [BLOCK_TYPE.TIMELINE]: TimelineScreen,
  [BLOCK_TYPE.DELIVERABLES]: DeliverablesScreen,
  [BLOCK_TYPE.SPECIFICATIONS]: SpecificationsScreen,
  [BLOCK_TYPE.TEAM]: TeamScreen,
  [BLOCK_TYPE.TESTIMONIALS]: TestimonialsScreen,
  [BLOCK_TYPE.FAQ]: FaqScreen,
  [BLOCK_TYPE.TERMS]: TermsScreen,
  [BLOCK_TYPE.SIGNATURE]: SignatureScreen,
  [BLOCK_TYPE.ATTACHMENTS]: AttachmentsScreen,
  [BLOCK_TYPE.CUSTOM]: CustomScreen,
}

export function getScreenRenderer(type) {
  return SCREEN[type] ?? CustomScreen
}
