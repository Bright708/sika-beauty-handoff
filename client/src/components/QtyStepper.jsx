// − 2 + pill. size "lg" on the product page, "sm" in the bag (still 44px tap targets).
export default function QtyStepper({ value, max, onChange, disabled, size = 'lg', label = 'Quantity' }) {
  const lg = size === 'lg'
  const btn = `${lg ? 'w-[52px] h-[52px] text-[22px]' : 'w-11 h-11 text-[20px]'} cursor-pointer bg-transparent border-0 text-ink rounded-full disabled:text-field disabled:cursor-not-allowed`
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center border-[1.5px] border-ink rounded-full ${lg ? 'min-h-14' : 'min-h-11'}`}
    >
      <button type="button" aria-label="Decrease quantity" className={btn} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span aria-live="polite" className="min-w-7 text-center font-extrabold">
        {value}
      </span>
      <button type="button" aria-label="Increase quantity" className={btn} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}
