"use client"

import Link from "next/link"
import { LayoutDashboard, Users, Package, ShoppingCart, LogOut } from "lucide-react"

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-white border-r p-5 flex flex-col justify-between">
      
      <div>
        <h1 className="text-2xl font-bold mb-8">
          SAISOKU
        </h1>

        <nav className="space-y-4">

          <Link href="/dashboard" className="flex items-center gap-3 text-gray-700 hover:text-black">
            <LayoutDashboard size={18}/>
            Dashboard
          </Link>

          <Link href="/dashboard/users" className="flex items-center gap-3 text-gray-700 hover:text-black">
            <Users size={18}/>
            Users
          </Link>

          <Link href="/dashboard/products" className="flex items-center gap-3 text-gray-700 hover:text-black">
            <Package size={18}/>
            Products
          </Link>

          <Link href="/dashboard/transactions" className="flex items-center gap-3 text-gray-700 hover:text-black">
            <ShoppingCart size={18}/>
            Transactions
          </Link>

        </nav>
      </div>

      <button className="flex items-center gap-2 text-red-500">
        <LogOut size={18}/>
        Logout
      </button>

    </div>
  )
}