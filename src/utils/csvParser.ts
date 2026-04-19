import Papa from 'papaparse'
import type { RawMessage, Message, Conversation, Participant } from '../types/message'
import { isCurrentUser } from '../types/message'
import { generateMessageId } from '../lib/utils'

export function parseCSV(csvContent: string): Promise<RawMessage[]> {
    return new Promise((resolve, reject) => {
        Papa.parse<RawMessage>(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn('CSV parsing warnings:', results.errors)
                }
                resolve(results.data)
            },
            error: (error) => {
                reject(error)
            }
        })
    })
}

export function transformToMessages(rawMessages: RawMessage[]): Message[] {
    return rawMessages.map((raw) => {
        const attachments = raw['ATTACHMENTS']
            ? raw['ATTACHMENTS'].split(',').map(a => a.trim()).filter(Boolean)
            : []

        return {
            id: generateMessageId(
                raw['CONVERSATION ID'],
                raw['DATE'],
                raw['FROM'],
                raw['CONTENT']
            ),
            conversationId: raw['CONVERSATION ID'],
            from: raw['FROM'],
            fromProfileUrl: raw['SENDER PROFILE URL'],
            to: raw['TO'],
            toProfileUrl: raw['RECIPIENT PROFILE URLS'],
            date: new Date(raw['DATE']),
            subject: raw['SUBJECT'],
            content: raw['CONTENT'],
            folder: raw['FOLDER'],
            attachments,
            isCurrentUser: isCurrentUser(raw['SENDER PROFILE URL'])
        }
    })
}

export function groupIntoConversations(messages: Message[]): Conversation[] {
    const conversationMap = new Map<string, Message[]>()

    // Group messages by conversation ID
    messages.forEach((message) => {
        const existing = conversationMap.get(message.conversationId)
        if (existing) {
            existing.push(message)
        } else {
            conversationMap.set(message.conversationId, [message])
        }
    })

    // Create conversation objects
    const conversations: Conversation[] = []

    conversationMap.forEach((msgs, conversationId) => {
        // Sort messages by date (oldest first for display, newest first for preview)
        const sortedMessages = [...msgs].sort((a, b) => a.date.getTime() - b.date.getTime())

        // Extract unique participants
        const participantMap = new Map<string, Participant>()
        msgs.forEach((msg) => {
            if (!participantMap.has(msg.fromProfileUrl)) {
                participantMap.set(msg.fromProfileUrl, {
                    name: msg.from,
                    profileUrl: msg.fromProfileUrl
                })
            }
            if (!participantMap.has(msg.toProfileUrl)) {
                participantMap.set(msg.toProfileUrl, {
                    name: msg.to,
                    profileUrl: msg.toProfileUrl
                })
            }
        })

        // Generate title from participants (excluding current user)
        const otherParticipants = Array.from(participantMap.values())
            .filter(p => !isCurrentUser(p.profileUrl))

        const title = otherParticipants.map(p => p.name).join(', ') || 'Unknown'

        conversations.push({
            id: conversationId,
            title,
            participants: Array.from(participantMap.values()),
            messages: sortedMessages,
            lastMessage: sortedMessages[sortedMessages.length - 1] || null,
            unreadCount: 0
        })
    })

    // Sort conversations by last message date (newest first)
    return conversations.sort((a, b) => {
        const dateA = a.lastMessage?.date.getTime() || 0
        const dateB = b.lastMessage?.date.getTime() || 0
        return dateB - dateA
    })
}

export async function loadAndParseCSV(csvContent: string): Promise<Conversation[]> {
    const rawMessages = await parseCSV(csvContent)
    const messages = transformToMessages(rawMessages)
    return groupIntoConversations(messages)
}
