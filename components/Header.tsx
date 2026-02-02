import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import Navitems from './Navitems'
import UserDropdown from './UserDropdown'
import { searchStocks } from '@/lib/actions/finnhub.actions'

const Header = async ({user}:{user:User}) => {
  const initialStocks = await searchStocks();
  return (
    <header className="sticky top-0 header">
      <div className="container header-wrapper">
        <Link href="/">
          <Image
            src="/assets/icons/logo.svg"
            alt="StockSense Logo"
            width={140}
            height={32}
          />
        </Link>

        <nav className="hidden sm:block">
          <Navitems initialStocks={initialStocks ?? []} />
        </nav>
        <UserDropdown user={user} initialStocks={initialStocks ?? []} />
      </div>
    </header>
  )
}

export default Header
