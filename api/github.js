// Proxies GitHub contributions API — adds CORS headers
module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") return res.status(200).end()

    const { username, year } = req.query
    if (!username) return res.status(400).json({ error: "Missing username" })
    const y = year || new Date().getFullYear()

    try {
        const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=${y}`
        const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!r.ok) throw new Error(`API ${r.status}`)
        const data = await r.json()
        return res.status(200).json(data)
    } catch (err) {
        return res.status(500).json({ error: err.message || "Unknown error" })
    }
}
