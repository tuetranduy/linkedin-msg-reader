const API_BASE = '/api'

export class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
        this.name = 'ApiError'
    }
}

export async function apiClient<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem('auth_token')

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    }

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new ApiError(response.status, error.error || 'Request failed')
    }

    return response.json()
}

export async function uploadFile(file: File): Promise<{ conversationCount: number; messageCount: number }> {
    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/messages/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new ApiError(response.status, error.error || 'Upload failed')
    }

    return response.json()
}
