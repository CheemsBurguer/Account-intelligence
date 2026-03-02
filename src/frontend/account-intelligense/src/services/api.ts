export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

let isRefreshing = false;

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    let token = localStorage.getItem("access_token");

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401 && !isRefreshing) {
        isRefreshing = true;
        const refreshToken = localStorage.getItem("refresh_token");

        if (refreshToken) {
            try {
                const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: refreshToken }),
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    localStorage.setItem("access_token", data.access_token);
                    localStorage.setItem("refresh_token", data.refresh_token);

                    // Retry original request with new token
                    headers["Authorization"] = `Bearer ${data.access_token}`;
                    response = await fetch(`${API_BASE_URL}${endpoint}`, {
                        ...options,
                        headers,
                    });
                    isRefreshing = false;
                    return response;
                }
            } catch (err) {
                console.error("Token refresh failed:", err);
            }
        }

        // If no refresh token or refresh failed
        isRefreshing = false;
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
    }

    return response;
}
