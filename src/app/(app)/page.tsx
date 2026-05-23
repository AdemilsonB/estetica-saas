'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/use-current-user'

export default function AppHome() {
  const router = useRouter()
  const { data: user, isLoading, isError } = useCurrentUser()

  useEffect(() => {
    if (isError) {
      router.replace('/login')
      return
    }
    if (!user) return
    if (user.role === 'OWNER' || user.role === 'MANAGER') {
      router.replace('/dashboard')
    } else {
      router.replace('/agenda')
    }
  }, [user, isLoading, isError, router])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  return null
}
