// Proxies iTunes Search API — adds CORS headers for browser access
module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") return res.status(200).end()

    const { term, limit = "1" } = req.query
    if (!term) return res.status(400).json({ error: "Missing term" })

    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`
        const r = await fetch(url)
        if (!r.ok) throw new Error(`iTunes ${r.status}`)
        const data = await r.json()
        return res.status(200).json(data)
    } catch (err) {
        return res.status(500).json({ error: err.message || "Unknown error" })
    }
}
