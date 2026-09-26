/**
 * eslint-plugin-react-hooks' React-Compiler-oriented `immutability` rule
 * flags every `el.currentTime = ...` / `el.play()` below as an illegal
 * post-render mutation. Those calls are imperative playback control on an
 * HTMLVideoElement reached via ref — the documented React pattern for
 * driving DOM APIs React doesn't model (see react.dev "Manipulating the
 * DOM with Refs") — not a mutation of anything React renders, so the rule
 * is disabled for this file rather than worked around.
 */
/* eslint-disable react-hooks/immutability */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import type { ContainBackground, FitMode } from '@shared/types'

export interface MediaItemSpec {
  src: string
  kind: 'video' | 'image'
}

/** How close to the end (seconds) we start the other buffer, so the swap lands before any decode stall at the loop point is visible. */
const LOOP_LEAD_SEC = 0.2

function fitToObjectFit(fit: FitMode): CSSProperties['objectFit'] {
  return fit === 'stretch' ? 'fill' : fit
}

function layeredStyle(visible: boolean, objectFit: CSSProperties['objectFit']): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit,
    opacity: visible ? 1 : 0,
    transition: 'opacity 250ms linear'
  }
}

const blurredBgStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  filter: 'blur(32px) brightness(0.55)',
  transform: 'scale(1.15)'
}

/**
 * Renders one media zone. Videos loop with zero visible gap by keeping two
 * <video> elements pointed at the same src: as the active one nears its end,
 * the other is seeked to 0 and started, then the two cross-fade — avoiding
 * the black-frame flash a native `loop` restart can cause. Switching to a
 * different `item` (a new file) cross-fades the same way.
 */
export function MediaZone({
  item,
  fit,
  bg,
  bgColor
}: {
  item: MediaItemSpec
  fit: FitMode
  bg: ContainBackground
  bgColor: string
}): ReactElement {
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const
  const activeRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  // Both slots start on the same item: two identical buffers ready for a
  // gapless same-item loop-restart. A slot only ever holds a *different*
  // item while a genuine file change (pendingSwapRef) is in flight.
  const [slots, setSlots] = useState<[MediaItemSpec, MediaItemSpec]>([item, item])
  const currentSrcRef = useRef(item.src)
  const pendingSwapRef = useRef<{ slotIndex: number; src: string } | null>(null)

  useEffect(() => {
    const el = videoRefs[activeRef.current].current
    el?.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (item.src === currentSrcRef.current) return
    currentSrcRef.current = item.src
    const inactive = 1 - activeRef.current
    pendingSwapRef.current = { slotIndex: inactive, src: item.src }
    setSlots((prev) => {
      const next: [MediaItemSpec, MediaItemSpec] = [...prev] as [MediaItemSpec, MediaItemSpec]
      next[inactive] = item
      return next
    })
  }, [item])

  useEffect(() => {
    const pending = pendingSwapRef.current
    if (!pending) return
    const spec = slots[pending.slotIndex]
    if (spec.src !== pending.src) return
    if (spec.kind !== 'video') {
      pendingSwapRef.current = null
      activeRef.current = pending.slotIndex
      setActiveIndex(pending.slotIndex)
      return
    }
    const el = videoRefs[pending.slotIndex].current
    if (!el) return
    const onReady = (): void => {
      pendingSwapRef.current = null
      el.currentTime = 0
      el.play().catch(() => {})
      activeRef.current = pending.slotIndex
      setActiveIndex(pending.slotIndex)
    }
    if (el.readyState >= 2) onReady()
    else el.addEventListener('loadeddata', onReady, { once: true })
    return () => el.removeEventListener('loadeddata', onReady)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  function handleTimeUpdate(index: number): void {
    if (index !== activeRef.current) return
    if (pendingSwapRef.current) return // a genuine item change is already queued; let that swap happen instead
    const el = videoRefs[index].current
    const other = videoRefs[1 - index].current
    if (!el || !other || !Number.isFinite(el.duration)) return
    if (el.duration - el.currentTime > LOOP_LEAD_SEC) return
    other.currentTime = 0
    other.play().catch(() => {})
    activeRef.current = 1 - index
    setActiveIndex(1 - index)
  }

  const objectFit = fitToObjectFit(fit)
  const showBackdrop = fit === 'contain'
  const backdropItem = slots[activeIndex]

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: showBackdrop && bg === 'solid' ? bgColor : '#000'
      }}
    >
      {showBackdrop &&
        bg === 'blur' &&
        (backdropItem.kind === 'video' ? (
          <video src={backdropItem.src} muted autoPlay loop playsInline style={blurredBgStyle} />
        ) : (
          <img src={backdropItem.src} alt="" style={blurredBgStyle} />
        ))}

      {slots.map((spec, index) =>
        spec.kind === 'video' ? (
          <video
            key={index}
            ref={videoRefs[index]}
            src={spec.src}
            muted
            playsInline
            preload="auto"
            onTimeUpdate={() => handleTimeUpdate(index)}
            style={layeredStyle(index === activeIndex, objectFit)}
          />
        ) : (
          <img
            key={index}
            src={spec.src}
            alt=""
            style={layeredStyle(index === activeIndex, objectFit)}
          />
        )
      )}
    </div>
  )
}
