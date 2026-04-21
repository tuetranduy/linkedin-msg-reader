// Room participant
export interface RoomParticipant {
    id: string
    username: string
    canControl: boolean
    isOnline: boolean
}

// Room state
export interface Room {
    code: string
    name?: string
    description?: string
    conversationId: string
    isCreator: boolean
    canControl: boolean
    participants: RoomParticipant[]
    currentScroll?: ScrollPosition
}

export interface AvailableRoom {
    code: string
    name: string
    description: string
    conversationId: string
    conversationTitle: string
    creatorId: string
    creatorUsername: string
    isOwner: boolean
    isParticipant: boolean
    canManage: boolean
    participantCount: number
    onlineCount: number
    createdAt: string
    updatedAt: string
}

// Scroll position for sync
export interface ScrollPosition {
    messageId: string | null
    position: number
}

// Room events from server
export interface RoomScrollSyncEvent {
    messageId: string | null
    position: number
    from: { id: string; username: string }
}

export interface RoomUserEvent {
    user: { id: string; username: string }
}

export interface RoomParticipantsUpdatedEvent {
    userId: string
    canControl: boolean
}

export interface RoomPermissionChangedEvent {
    canControl: boolean
}

export interface RoomEndedEvent {
    by: { id: string; username: string }
}

// Callback response types
export interface RoomCreateResponse {
    success?: boolean
    error?: string
    room?: Room
}

export interface RoomJoinResponse {
    success?: boolean
    error?: string
    room?: Room
}

export interface RoomLeaveResponse {
    success?: boolean
    error?: string
}

export interface RoomPermissionsResponse {
    success?: boolean
    error?: string
}
