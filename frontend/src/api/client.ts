const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
    throw new TypeError(
        'Missing VITE_API_BASE_URL environment variable',
    )
}

export async function requestJson<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/json')

    if (init?.body !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            ...init,
            headers,
        },
    )

    if (!response.ok) {
        const message = await response.text()

        throw new Error(
            `API request failed (${response.status}): ${
                message || response.statusText
            }`,
        )
    }

    return response.json() as Promise<T>
}
