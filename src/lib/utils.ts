import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/** Whole calendar days between `date` and now (0 = today, 1 = yesterday) */
function calendarDaysAgo(date: Date): number {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    return Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24))
}

export function formatDate(date: Date): string {
    const diffInDays = calendarDaysAgo(date)

    if (diffInDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInDays === 1) {
        return 'Yesterday'
    } else if (diffInDays > 1 && diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' })
    } else if (date.getFullYear() === new Date().getFullYear()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    }
}

export function formatMessageTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatMessageDateTime(date: Date): string {
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export function formatDateSeparator(date: Date): string {
    const diffInDays = calendarDaysAgo(date)

    if (diffInDays === 0) {
        return 'Today'
    } else if (diffInDays === 1) {
        return 'Yesterday'
    } else {
        return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
}

export function getInitials(name: string | undefined | null): string {
    if (!name) return '?'
    return (
        name
            .split(/[\s&]+/)
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?'
    )
}

const AVATAR_COLORS = [
    'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
    'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
    'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
    'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200',
]

/** Stable color classes for a name, so the same person always gets the same avatar color */
export function getAvatarColor(name: string | undefined | null): string {
    const str = name || '?'
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    )
}

export function generateMessageId(conversationId: string, date: string, from: string, content: string): string {
    // Create a simple hash from message properties for unique ID
    const str = `${conversationId}-${date}-${from}-${content.slice(0, 50)}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return `msg-${Math.abs(hash).toString(36)}`
}

export function extractLinkedInUsername(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^\/]+)/)
    return match ? match[1] : ''
}

export function isUrl(text: string): boolean {
    try {
        new URL(text)
        return true
    } catch {
        return false
    }
}

export function isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) ||
        url.includes('messaging-image') ||
        url.includes('/image/')
}
