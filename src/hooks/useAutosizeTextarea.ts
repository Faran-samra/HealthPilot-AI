import { useLayoutEffect, type RefObject } from 'react'

interface AutosizeOptions {
  minRows?: number
  maxRows?: number
}

/** Grows a textarea with its content up to maxRows, then scrolls. */
export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minRows = 2, maxRows = 8 }: AutosizeOptions = {}
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    el.style.height = '0px'
    const styles = getComputedStyle(el)
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0
    const verticalExtras = paddingTop + paddingBottom + borderTop + borderBottom

    const minHeight = lineHeight * minRows + verticalExtras
    const maxHeight = lineHeight * maxRows + verticalExtras
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)

    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [ref, value, minRows, maxRows])
}
