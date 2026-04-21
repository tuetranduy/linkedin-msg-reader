---
description: "Use when writing or modifying React components, context providers, hooks, or UI styling. Covers component structure, Tailwind patterns, responsive design, shadcn/ui usage, auth context, and API client patterns."
applyTo: "src/**/*.tsx,src/**/*.ts"
---

# Frontend Patterns

## Component Structure

- Components live in `src/components/`, co-located by feature (`admin/`, `auth/`, `ui/`)
- UI primitives (button, input, sheet, tooltip, etc.) are in `src/components/ui/` — use these, don't create raw HTML equivalents
- Named exports only (no default exports for components)

## Context & State

Three context providers wrap the app (outermost first):

1. `AuthProvider` → `MessageProvider` → `RoomProvider`

| Context          | State                                                               |
| ---------------- | ------------------------------------------------------------------- |
| `AuthContext`    | `user`, `isAuthenticated`, `isAdmin`, `isLoading`                   |
| `MessageContext` | `conversations`, `selectedConversation`, `bookmarks`, `searchQuery` |
| `RoomContext`    | `currentRoom`, `isInRoom`, `isConnected`                            |

Always consume via the exported custom hook (`useAuth()`, `useMessages()`, `useRoom()`).

## API Client

Use `apiClient<T>()` from `src/api/client.ts` for all API calls — it auto-attaches the Bearer token and throws `ApiError` on non-2xx responses.

```ts
import { apiClient, ApiError } from "../api/client";

const data = await apiClient<MyType>("/endpoint", {
  method: "POST",
  body: JSON.stringify(payload),
});
```

For file uploads use `uploadFile()` — it handles `FormData` (no `Content-Type` header).

## Auth Token

Stored as `auth_token` in `localStorage`. Do not read it directly in components — use `useAuth()`.

## Tailwind / Styling Conventions

- Mobile-first responsive: `sm:`, `md:` breakpoints for larger screens
- Hide text on mobile, show on larger screens: `className="hidden sm:inline"`
- Hide desktop view on mobile: `className="hidden md:block"`
- Card styling: `border rounded p-4` with `truncate` for overflow text
- Error display: red background box (`bg-red-50 text-red-900`)
- Loading states: disable button + change label text + `Loader2` spinner icon

## Icon Library

Use `lucide-react` exclusively. Common icons: `Bookmark`, `Moon`, `Sun`, `LogOut`, `Settings`, `MessageSquare`, `Edit2`, `Trash2`, `Eye`, `EyeOff`, `CheckCircle`, `KeyRound`, `Users`, `UserPlus`.

## Form Patterns

```tsx
<div className="space-y-2">
  <label>Field Label</label>
  <Input type="text" placeholder="..." required />
</div>;
{
  error && (
    <div className="bg-red-50 text-red-900 p-3 rounded text-sm">{error}</div>
  );
}
<Button disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>;
```

## Responsive Layout Strategy

- Mobile (< `sm`): icon-only buttons, sheet/drawer panels, card lists
- Desktop (≥ `md`): full sidebar layout, table views with sticky headers
- Use `useIsMobile()` hook (from `src/hooks/useMediaQuery.ts`) for programmatic checks

## Sheet / Modal Patterns

Use `Sheet` (Radix UI dialog) for panels and mobile navigation. Always include `SheetTitle` for accessibility.

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Panel Title</SheetTitle>
    </SheetHeader>
    {/* content */}
  </SheetContent>
</Sheet>
```

## Dark Mode

Toggled via `document.documentElement.classList.toggle('dark')`. State initialized from `localStorage` key `darkMode`.
