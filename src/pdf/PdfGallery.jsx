import { View, Text, Image } from '@react-pdf/renderer'
import { styles } from './pdfStyles.js'

function PdfGallery({ proposal }) {
  const images = Array.isArray(proposal.images)
    ? proposal.images.filter((image) => image?.src || image?.url)
    : []

  if (images.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Gallery</Text>
      <View style={styles.galleryRow}>
        {images.map((image, index) => {
          const src = image.src ?? image.url
          return (
            <View key={image.id ?? `image-${index}`} style={styles.galleryItem}>
              <Image src={src} style={styles.galleryImage} />
              {image.caption ? (
                <Text style={styles.footerText}>{image.caption}</Text>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default PdfGallery
