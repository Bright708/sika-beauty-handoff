import ProductCard from './ProductCard'

// 2 across on phones (minmax 160px under 640px), auto-fill 260px columns above.
export const gridClass =
  'grid gap-x-5 gap-y-9 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[359px]:grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))]'

export default function ProductGrid({ products, eagerCount = 0 }) {
  return (
    <div className={gridClass}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} eager={i < eagerCount} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className={gridClass} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3.5">
          <div className="aspect-[4/5] rounded-card bg-sand animate-pulse" />
          <div className="h-4 w-1/3 rounded-full bg-line" />
          <div className="h-5 w-2/3 rounded-full bg-line" />
          <div className="min-h-12 rounded-full border-[1.5px] border-line" />
        </div>
      ))}
    </div>
  )
}
