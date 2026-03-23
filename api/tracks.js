// Fetches multiple tracks by ID from Spotify API (one at a time)
// GET /api/tracks?ids=id1,id2,id3

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

function mapTrack(t) {
    return {
        id: t.id,
        name: t.name,
        artist: (t.artists || []).map(a => a.name).join(", "),
        album: t.album ? t.album.name : "",
        albumArt: t.album && t.album.images
            ? (t.album.images[1] || t.album.images[0] || {}).url || null
            : null,
        duration: t.duration_ms || 0,
        uri: t.uri,
        previewUrl: t.preview_url || null,
    }
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") return res.status(200).end()

    const { ids } = req.query
    if (!ids) return res.status(400).json({ error: "Missing ids parameter" })

    try {
        const token = await getToken()
        const idList = ids.split(",").slice(0, 20)

        // Fetch each track individually (batch endpoint is restricted)
        const results = await Promise.all(
            idList.map(async (id) => {
                try {
                    const r = await fetch(
                        `https://api.spotify.com/v1/tracks/${id.trim()}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                    if (!r.ok) return null
                    const t = await r.json()
                    return t && t.id ? mapTrack(t) : null
                } catch (e) {
                    return null
                }
            })
        )

        const tracks = results.filter(t => t !== null)
        return res.status(200).json({ tracks: tracks })
    } catch (err) {
        return res.status(500).json({ error: err.message || "Unknown error" })
    }
}
