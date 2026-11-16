import { Link } from 'react-router-dom'

// Pill buttons from DESIGN.md. variant: primary | secondary | pay | light
const variants = {
  primary: 'bg-ink text-paper border-[1.5px] border-ink hover:bg-ink-2 hover:border-ink-2',
  secondary:
    'bg-transparent text-ink border-[1.5px] border-ink hover:bg-ink hover:text-paper',
  pay: 'bg-rose text-white border-[1.5px] border-rose hover:bg-danger hover:border-danger',
  light: 'bg-paper text-ink border-[1.5px] border-paper hover:bg-white hover:border-white',
}
const sizes = {
  md: 'min-h-12 px-6 text-[14px]',
  lg: 'min-h-[54px] px-[30px] text-[16px]',
}

export function buttonClass({ variant = 'primary', size = 'lg', className = '' } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-full font-bold no-underline cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`
}

export default function Button({ to, href, variant, size, className, children, ...rest }) {
  const cls = buttonClass({ variant, size, className })
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>
  return <button type="button" className={cls} {...rest}>{children}</button>
}
