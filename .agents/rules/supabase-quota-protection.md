# Supabase Quota & Bandwidth Protection Rule

**CRITICAL DIRECTIVE:** The user is on a Supabase Free Tier and has explicitly mandated that NO code changes should EVER cause them to exceed their quota (Bandwidth, API requests, Database Size) or force them to pay for a subscription.

Whenever modifying or adding new features involving data fetching or Supabase APIs, you MUST strictly adhere to the following principles:

1.  **Never Fetch Unpaginated Large Datasets:** Never use `while(true)` loops or unpaginated `select('*')` to download entire tables (e.g., `band_songs`) on page load.
2.  **Always Use Smart Caching:** If a large dataset is required for offline functionality or autocomplete (like the song library), it MUST be cached in `localStorage`.
3.  **Validate Cache with Minimal Data:** Use lightweight queries (e.g., `count: 'exact', head: true` or `select('updated_at').order('updated_at').limit(1)`) to validate cache freshness before fetching real data.
4.  **Throttle Realtime Broadcasts:** Supabase Realtime broadcast channels should not send high-frequency payloads unnecessarily. Batch updates or throttle sending rates to prevent burning through the 2M messages/month quota.
5.  **Think About Scale:** Always evaluate the Big O complexity of network requests. Ask yourself: "If 10 band members use this page simultaneously for 4 hours, what is the bandwidth and API cost?"

If a requested feature fundamentally risks breaking these limits, you MUST warn the user and propose an optimized, bandwidth-friendly alternative (e.g., Server-side pagination, caching, or reduced sync intervals) before writing any code.
