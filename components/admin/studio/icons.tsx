/**
 * The Studio's line icons: small drawings in one stroke style (24-unit box,
 * 2 px stroke, round ends), so the ported suite needs no icon package.
 */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { strokeWidth?: number }
const make = (body: JSX.Element, name: string) => {
  const Icon = ({ strokeWidth = 2, ...p }: P) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...p}>
      {body}
    </svg>
  )
  Icon.displayName = name
  return Icon
}

export const Check = make(<path d="M20 6 9 17l-5-5" />, 'Check')
export const ChevronLeft = make(<path d="m15 18-6-6 6-6" />, 'ChevronLeft')
export const ChevronRight = make(<path d="m9 18 6-6-6-6" />, 'ChevronRight')
export const ChevronDown = make(<path d="m6 9 6 6 6-6" />, 'ChevronDown')
export const ExternalLink = make(<><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>, 'ExternalLink')
export const Lock = make(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, 'Lock')
export const Pause = make(<><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>, 'Pause')
export const Play = make(<path d="M6 4v16l14-8z" />, 'Play')
export const Pencil = make(<><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /><path d="m15 5 4 4" /></>, 'Pencil')
export const Plus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>, 'Plus')
export const RefreshCw = make(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M8 16H3v5" /></>, 'RefreshCw')
export const Scissors = make(<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" /></>, 'Scissors')
export const Send = make(<><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>, 'Send')
export const Trash2 = make(<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></>, 'Trash2')
export const Undo2 = make(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>, 'Undo2')
export const X = make(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>, 'X')
export const ZoomIn = make(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></>, 'ZoomIn')
export const ZoomOut = make(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6" /></>, 'ZoomOut')
export const Film = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18" /><path d="M17 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 7.5h4" /><path d="M17 16.5h4" /></>, 'Film')
export const Music2 = make(<><circle cx="8" cy="18" r="4" /><path d="M12 18V2l7 4" /></>, 'Music2')
export const Subtitles = make(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4" /><path d="M15 15h2" /><path d="M7 11h2" /><path d="M13 11h4" /></>, 'Subtitles')
export const Tag = make(<><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1" /></>, 'Tag')
export const Volume2 = make(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>, 'Volume2')
export const VolumeX = make(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>, 'VolumeX')
export const Lightbulb = make(<><path d="M15 14c.2-1 .7-1.7 1.5-2.5A6 6 0 1 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>, 'Lightbulb')
export const ScanSearch = make(<><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /><path d="m16 16-1.9-1.9" /></>, 'ScanSearch')
export const Mic = make(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><path d="M12 18v4" /></>, 'Mic')
export const Copy = make(<><rect x="8" y="8" width="14" height="14" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>, 'Copy')
export const Square =make(<rect x="5" y="5" width="14" height="14" rx="2" />, 'Square')
