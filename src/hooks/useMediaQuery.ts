import { useState, useEffect } from 'react'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const breakpoints: Record<Breakpoint, number> = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
}

/**
 * Hook to check if the viewport matches a media query
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches
        }
        return false
    })

    useEffect(() => {
        const mediaQuery = window.matchMedia(query)
        setMatches(mediaQuery.matches)

        const handler = (event: MediaQueryListEvent) => {
            setMatches(event.matches)
        }

        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    }, [query])

    return matches
}

/**
 * Hook to check if viewport is at least a certain breakpoint
 * @param breakpoint - Tailwind breakpoint name
 * @returns boolean indicating if viewport >= breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
    return useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`)
}

/**
 * Hook to check if device is mobile (< 768px)
 */
export function useIsMobile(): boolean {
    return !useBreakpoint('md')
}

/**
 * Hook to check if device is tablet (>= 768px && < 1024px)
 */
export function useIsTablet(): boolean {
    const isMd = useBreakpoint('md')
    const isLg = useBreakpoint('lg')
    return isMd && !isLg
}

/**
 * Hook to check if device is desktop (>= 1024px)
 */
export function useIsDesktop(): boolean {
    return useBreakpoint('lg')
}
