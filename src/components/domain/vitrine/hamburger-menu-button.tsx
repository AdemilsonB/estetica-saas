'use client'

import { Menu } from 'lucide-react'

export function HamburgerMenuButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent('open-public-menu'))
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Abrir menu"
      className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 transition-colors"
    >
      <Menu className="size-5" />
    </button>
  )
}
