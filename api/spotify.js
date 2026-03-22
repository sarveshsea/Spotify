// Proxies Spotify Web API — stores credentials server-side, never exposed to browser
// Set these in Vercel environment variables:
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET

let cachedToken = null
let tokenExpiry = 0

async function getToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken
    const creds = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64")
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${creds}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    })
    if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
    const data = await res.json()
    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return cachedToken
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") return res.status(200).end()

    const { playlistId, maxTracks = "20" } = req.query
    if (!playlistId) return res.status(400).json({ error: "Missing playlistId" })

    try {
        const token = await getToken()
        const max = Math.min(parseInt(maxTracks), 50)

        const fields = [
            "name", "description", "images",
            "tracks.total",
            `tracks.items(track(id,name,duration_ms,uri,preview_url,artists(name),album(name,images)))`
        ].join(",")

        const spRes = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}?fields=${encodeURIComponent(fields)}&limit=${max}`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!spRes.ok) throw new Error(`Spotify API ${spRes.status}`)
        const data = await spRes.json()

        return res.status(200).json({
            name: data.name || "Playlist",
            description: (data.description || "").replace(/<[^>]*>/g, ""),
            coverArt: data.images?.[0]?.url || null,
            totalTracks: data.tracks?.total || 0,
            tracks: (data.tracks?.items || [])
                .filter(i => i?.track?.id)
                .slice(0, max)
                .map(i => ({
                    id: i.track.id,
                    name: i.track.name,
                    artist: (i.track.artists || []).map(a => a.name).join(", "),
                    album: i.track.album?.name || "",
                    albumArt: i.track.album?.images?.[1]?.url || i.track.album?.images?.[0]?.url || null,
                    duration: i.track.duration_ms || 0,
                    uri: i.track.uri,
                    previewUrl: i.track.preview_url || null,
                })),
        })
    } catch (err) {
        return res.status(500).json({ error: err.message || "Unknown error" })
    }
}
