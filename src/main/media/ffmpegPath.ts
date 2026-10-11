import ffmpegPathRaw from 'ffmpeg-static'

/**
 * `ffmpeg-static`'s own index.js computes its binary path as
 * `path.join(__dirname, 'ffmpeg.exe')`. In a packaged app, `__dirname` for
 * a module loaded from inside `app.asar` resolves to a path *inside* that
 * virtual archive (e.g. `...\resources\app.asar\node_modules\ffmpeg-static`)
 * — even though electron-builder physically unpacks the real binary to
 * `app.asar.unpacked` alongside it (confirmed in the built app: the exe
 * exists on disk at the `.unpacked` path, but `ffmpeg-static` computes the
 * `.asar` one). `child_process.spawn()` executes a real OS path, not
 * Electron's virtual asar filesystem, so spawning the raw path fails
 * outright in the packaged app — while working perfectly in dev, where
 * there's no asar at all. This was confirmed live: MKV playback worked
 * through every dev-mode/throwaway-script test this session, then failed
 * silently in the actual installed build until this fix.
 *
 * The fix is the standard one for this well-documented ffmpeg-static +
 * electron-builder interaction: rewrite `app.asar` to `app.asar.unpacked`
 * in the computed path. It's a no-op in dev, where the string never
 * appears.
 */
export const ffmpegPath = (ffmpegPathRaw as string).replace('app.asar', 'app.asar.unpacked')
