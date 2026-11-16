import { Link } from 'react-router-dom'
import { buttonClass } from '../../components/Button'
import { useDocTitle } from '../ui'

export default function AdminNotFound() {
  useDocTitle('Not found')
  return (
    <>
      <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">We could not find that page.</h1>
      <div className="bg-white rounded-admin p-6 flex flex-col gap-4 items-start">
        <p className="m-0 text-muted-2">The link may be old. Everything you need is in the menu.</p>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/admin" className={buttonClass({ size: 'md' })}>
            Go to overview
          </Link>
          <Link to="/admin/orders" className={buttonClass({ variant: 'secondary', size: 'md' })}>
            See orders
          </Link>
        </div>
      </div>
    </>
  )
}
