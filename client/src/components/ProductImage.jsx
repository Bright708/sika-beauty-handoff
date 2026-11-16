import { imageUrl, imageSrcSet } from '../lib/images'

// Photo on a tint background. The tint shows while loading and when there is no photo yet.
export default function ProductImage({
  image, // { storage_path } or undefined
  alt,
  tint = 'bg-peach',
  sizes = '(max-width: 640px) 50vw, 25vw',
  eager = false,
  placeholder = 'Product photo',
  className = '',
  imgClassName = '',
}) {
  return (
    <div className={`relative overflow-hidden ${tint} ${className}`}>
      {image ? (
        <img
          src={imageUrl(image.storage_path, 960)}
          srcSet={imageSrcSet(image.storage_path)}
          sizes={sizes}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className="absolute inset-x-0 bottom-[18px] text-center text-[11px] font-bold tracking-[0.14em] uppercase text-placeholder"
        >
          {placeholder}
        </span>
      )}
    </div>
  )
}
