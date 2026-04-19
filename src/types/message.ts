export interface RawMessage {
    'CONVERSATION ID': string
    'CONVERSATION TITLE': string
    'FROM': string
    'SENDER PROFILE URL': string
    'TO': string
    'RECIPIENT PROFILE URLS': string
    'DATE': string
    'SUBJECT': string
    'CONTENT': string
    'FOLDER': string
    'ATTACHMENTS': string
}

export interface Message {
    id: string
    conversationId: string
    from: string
    fromProfileUrl?: string
    to: string
    toProfileUrl?: string
    date: Date
    subject?: string
    content: string
    folder: string
    attachments: string[]
    isCurrentUser?: boolean
}

export interface Conversation {
    id: string
    title: string
    participants: string[]
    messages: Message[]
    lastMessageDate: Date
}

export interface Participant {
    name: string
    profileUrl: string
}

export interface Bookmark {
    messageId: string
    conversationId: string
    content: string
    from: string
    date: Date
    createdAt: Date
}

export interface SearchMatch {
    messageId: string
    messageIndex: number
    matchIndices: number[][]
}

export interface AppState {
    conversations: Conversation[]
    selectedConversationId: string | null
    isLoading: boolean
    error: string | null
}

export const CURRENT_USER = {
    name: 'Tue Tran',
    profileUrl: 'https://www.linkedin.com/in/tuetranduy'
}

export function isCurrentUser(profileUrl: string): boolean {
    return profileUrl.toLowerCase().includes('tuetranduy')
}
