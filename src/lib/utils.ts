import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInDays === 1) {
        return 'Yesterday'
    } else if (diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: 'long' })
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
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
        return 'Today'
    } else if (diffInDays === 1) {
        return 'Yesterday'
    } else {
        return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
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
