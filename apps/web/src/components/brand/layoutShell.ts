/**
 * Ultrawide cap for full-bleed blueprint bands. The artboards are fixed-width
 * (1440 SNM, 1280 TLR/TGP) and were transcribed with fixed gutters, so above
 * the artboard width every band stretched edge-to-edge. This horizontal
 * padding is exactly the artboard gutter at or below the artboard width —
 * fidelity captures at 1440/1280 and the 390 mobile sweep are unchanged —
 * then grows so the content column stays centred at the artboard span while
 * the band's background, washes, rules and hairlines keep bleeding.
 */
export const capX = (gutter: number, contentSpan: number): string =>
    `max(${gutter}px, calc((100% - ${contentSpan}px) / 2))`

/** TLR/TGP artboard is 1280 wide; a 40px gutter leaves a 1200px content span. */
export const TLR_CAP_40 = capX(40, 1200)
/** TLR shop-home bands use 48px gutters on the same 1280 artboard. */
export const TLR_CAP_48 = capX(48, 1184)
/** SNM artboard is 1440 wide with 48px gutters — a 1344px content span. */
export const SNM_CAP_48 = capX(48, 1344)
/**
 * The home hero's 3D emblem frame caps ~8% tighter than the band gutter — 1240
 * against 1344. At the full artboard span the frame read too wide next to the
 * copy stacked above it (the owner, 2026-07-30). Deliberately its own constant rather
 * than a change to SNM_CAP_48: every other SNM band is transcribed from the
 * 1440 artboard and must keep its 1344 span. Below roughly a 1336px viewport
 * the 48px gutter still wins, so tablet and mobile are untouched — which is
 * where the frame already looked right.
 */
export const SNM_CAP_EMBLEM = capX(48, 1240)

/**
 * Outer-edge padding for a half-width band (the TLR split hero): the inner
 * gutter at the sheet's centre seam stays fixed, the outer gutter grows so
 * the half's content column caps against the centred 1280 sheet.
 */
export const capOuterX = (gutter: number, contentSpan: number): string =>
    `max(${gutter}px, calc(100% - ${contentSpan + gutter}px))`
