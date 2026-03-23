import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */

function fmtTime(ms) {
    var s = Math.floor(ms / 1000)
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0")
}

function parseTrackIds(input) {
    // Accepts Spotify URLs, URIs, or plain IDs — one per line
    var lines = input.split("\n")
    var ids = []
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim()
        if (!line) continue
        // https://open.spotify.com/track/XXXX?si=...
        var urlMatch = line.match(/track\/([a-zA-Z0-9]+)/)
        if (urlMatch) { ids.push(urlMatch[1]); continue }
        // spotify:track:XXXX
        var uriMatch = line.match(/spotify:track:([a-zA-Z0-9]+)/)
        if (uriMatch) { ids.push(uriMatch[1]); continue }
        // plain ID
        if (/^[a-zA-Z0-9]{22}$/.test(line)) { ids.push(line) }
    }
    return ids
}

export default function SpotifyPlayer(props) {
    var PROXY = props.proxyUrl || "https://spotify-lkod.vercel.app"
    var ACCENT = props.accentColor || "#1DB954"
    var RADIUS = props.borderRadius != null ? props.borderRadius : 24
    var SONGS = props.songLinks || ""

    var audioRef = React.useRef(null)
    var timerRef = React.useRef(null)

    var [tracks, setTracks] = React.useState([])
    var [status, setStatus] = React.useState("loading")
    var [idx, setIdx] = React.useState(0)
    var [playing, setPlaying] = React.useState(false)
    var [prog, setProg] = React.useState(0)
    var [dur, setDur] = React.useState(0)
    var [queue, setQueue] = React.useState(false)

    React.useEffect(function () {
        var ids = parseTrackIds(SONGS)
        if (ids.length === 0) { setStatus("empty"); return }

        var dead = false
        setStatus("loading")

        // Fetch track info for each ID via proxy
        fetch(PROXY + "/api/tracks?ids=" + ids.join(","))
            .then(function (r) { return r.json() })
            .then(function (d) {
                if (dead) return
                if (d.error) { setStatus("error: " + d.error); return }
                setTracks(d.tracks || [])
                setIdx(0)
                setStatus("ready")
            })
            .catch(function (e) {
                if (dead) return
                setStatus("error: " + (e.message || "Failed"))
            })

        return function () { dead = true }
    }, [PROXY, SONGS])

    React.useEffect(function () {
        return function () {
            try { if (audioRef.current) audioRef.current.pause() } catch (e) {}
            try { if (timerRef.current) clearInterval(timerRef.current) } catch (e) {}
        }
    }, [])

    var track = tracks.length > 0 ? tracks[idx] : null
    var pPct = dur > 0 ? (prog / dur) * 100 : 0

    function doPlay(i) {
        var t = tracks[i]
        if (!t) return
        try { if (audioRef.current) audioRef.current.pause() } catch (e) {}
        try { if (timerRef.current) clearInterval(timerRef.current) } catch (e) {}

        if (t.previewUrl) {
            try {
                var a = new Audio(t.previewUrl)
                a.volume = 0.75
                a.play().catch(function () {})
                a.onended = function () {
                    var n = i + 1 < tracks.length ? i + 1 : 0
                    setIdx(n)
                    doPlay(n)
                }
                a.onloadedmetadata = function () { setDur(a.duration * 1000) }
                audioRef.current = a
                setIdx(i); setPlaying(true); setProg(0)
                timerRef.current = setInterval(function () {
                    try { setProg(a.currentTime * 1000); setDur(a.duration * 1000 || 30000) } catch (e) {}
                }, 250)
            } catch (e) { setIdx(i); setPlaying(false) }
        } else {
            setIdx(i); setPlaying(false); setProg(0); setDur(t.duration || 0)
        }
    }

    function toggle() {
        if (!track) return
        if (playing) {
            try { if (audioRef.current) audioRef.current.pause() } catch (e) {}
            try { if (timerRef.current) clearInterval(timerRef.current) } catch (e) {}
            setPlaying(false)
        } else { doPlay(idx) }
    }

    function doPrev() { if (tracks.length) doPlay(idx > 0 ? idx - 1 : tracks.length - 1) }
    function doNext() { if (tracks.length) doPlay(idx + 1 < tracks.length ? idx + 1 : 0) }

    function doSeek(e) {
        try {
            var rect = e.currentTarget.getBoundingClientRect()
            var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            if (audioRef.current) {
                audioRef.current.currentTime = pct * (audioRef.current.duration || 30)
                setProg(pct * (dur || 30000))
            }
        } catch (e) {}
    }

    var spotifyPath = "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "#121214", borderRadius: RADIUS,
            display: "flex", flexDirection: "column",
            overflow: "hidden", color: "#ede9e3",
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 8px 48px rgba(0,0,0,0.65)",
        }}>
            {status === "empty" ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill={ACCENT}><path d={spotifyPath}/></svg>
                    <p style={{ fontSize: 12, color: "#6e6d68", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                        Paste Spotify song links in the<br/>"Songs" field in the property panel
                    </p>
                </div>
            ) : status === "loading" ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill={ACCENT}><path d={spotifyPath}/></svg>
                    <p style={{ fontSize: 13, color: "#6e6d68", marginTop: 12 }}>Loading songs...</p>
                </div>
            ) : status !== "ready" || !track ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill={ACCENT}><path d={spotifyPath}/></svg>
                    <p style={{ fontSize: 12, color: "#6e6d68", marginTop: 12 }}>{status.replace("error: ", "")}</p>
                </div>
            ) : (
                <React.Fragment>
                    {/* Header */}
                    <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={ACCENT}><path d={spotifyPath}/></svg>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6d68", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                {tracks.length + " song" + (tracks.length !== 1 ? "s" : "")}
                            </span>
                        </div>
                        {tracks.length > 1 && (
                            <div onClick={function () { setQueue(!queue) }} style={{ cursor: "pointer", opacity: queue ? 1 : 0.5, padding: 4 }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill={queue ? ACCENT : "#6e6d68"}><path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 013.5 1h9A2.5 2.5 0 0115 3.5v.5H1v-.5z"/></svg>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    {queue ? (
                        <div style={{ flex: 1, overflowY: "auto", padding: "4px 4px" }}>
                            {tracks.map(function (t, i) {
                                var active = idx === i
                                return (
                                    <div key={t.id || i} onClick={function () { doPlay(i) }} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "6px 12px", borderRadius: 6,
                                        background: active ? "rgba(255,255,255,0.08)" : "transparent",
                                        cursor: "pointer",
                                    }}>
                                        <span style={{ fontSize: 11, color: active ? ACCENT : "#6e6d68", width: 18, textAlign: "center", flexShrink: 0 }}>
                                            {active ? "\u25B8" : String(i + 1)}
                                        </span>
                                        <div style={{ width: 32, height: 32, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}>
                                            {t.albumArt ? <img src={t.albumArt} width="32" height="32" style={{ objectFit: "cover", display: "block" }} /> : null}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: active ? ACCENT : "#ede9e3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                                            <div style={{ fontSize: 10, color: "#6e6d68", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.artist}</div>
                                        </div>
                                        <span style={{ fontSize: 10, color: "#6e6d68", flexShrink: 0 }}>{fmtTime(t.duration)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 24px 8px" }}>
                            <div style={{ width: "70%", maxWidth: 240, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", background: "rgba(255,255,255,0.06)", marginBottom: 16 }}>
                                {track.albumArt ? <img src={track.albumArt} width="240" height="240" style={{ width: "100%", height: "auto", display: "block" }} /> : <div style={{ width: "100%", paddingBottom: "100%" }} />}
                            </div>
                            <div style={{ width: "100%", textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                                <div style={{ fontSize: 13, color: "#6e6d68", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist}</div>
                            </div>
                        </div>
                    )}

                    {/* Progress */}
                    <div style={{ padding: "0 20px" }}>
                        <div onClick={doSeek} style={{ width: "100%", height: 14, display: "flex", alignItems: "center", cursor: "pointer" }}>
                            <div style={{ width: "100%", height: 3, borderRadius: 3, background: "rgba(255,255,255,0.12)" }}>
                                <div style={{ width: pPct + "%", height: "100%", borderRadius: 3, background: "#fff" }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6e6d68", marginTop: 2 }}>
                            <span>{fmtTime(prog)}</span>
                            <span>{fmtTime(dur || (track ? track.duration : 0))}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, padding: "12px 20px 18px" }}>
                        <div onClick={doPrev} style={{ cursor: "pointer", display: "flex" }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="#ede9e3"><path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.15V14.3a.7.7 0 01-.7.7H2.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h.6z"/></svg>
                        </div>
                        <div onClick={toggle} style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            {playing
                                ? <svg width="18" height="18" viewBox="0 0 16 16" fill="#121214"><path d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z"/></svg>
                                : <svg width="18" height="18" viewBox="0 0 16 16" fill="#121214"><path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z"/></svg>
                            }
                        </div>
                        <div onClick={doNext} style={{ cursor: "pointer", display: "flex" }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="#ede9e3"><path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.15V14.3a.7.7 0 00.7.7h.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-.6z"/></svg>
                        </div>
                    </div>
                </React.Fragment>
            )}
        </div>
    )
}

addPropertyControls(SpotifyPlayer, {
    proxyUrl: {
        type: ControlType.String,
        title: "Proxy URL",
        defaultValue: "https://spotify-lkod.vercel.app",
    },
    songLinks: {
        type: ControlType.String,
        title: "Songs",
        defaultValue: "",
        placeholder: "Paste Spotify links, one per line",
        displayTextArea: true,
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#1DB954",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 24,
        min: 0, max: 60,
    },
})
