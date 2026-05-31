import { useState, useRef, cloneElement, type ReactNode, type ReactElement } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  type Placement,
} from '@floating-ui/react'
import { HelpCircle } from 'lucide-react'

interface TooltipProps {
  /** The explanation text shown on hover/focus. */
  label: ReactNode
  /** Element that triggers the tooltip. Must accept a ref + props. */
  children: ReactElement
  placement?: Placement
  /** Max width of the bubble in px. */
  maxWidth?: number
}

/**
 * Accessible tooltip built on Floating UI. Opens on hover and keyboard focus,
 * dismisses on Escape / blur. Used to surface the explanations that we removed
 * from the dense body copy.
 */
export function Tooltip({ label, children, placement = 'top', maxWidth = 220 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const arrowRef = useRef<HTMLDivElement>(null)

  const {
    refs,
    floatingStyles,
    context,
    middlewareData,
    placement: side,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      // eslint-disable-next-line react-hooks/refs -- Floating UI reads the arrow ref outside render
      arrow({ element: arrowRef }),
    ],
  })

  const hover = useHover(context, { move: false, delay: { open: 120, close: 40 } })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[side.split('-')[0]] as 'top' | 'right' | 'bottom' | 'left'

  return (
    <>
      {cloneElement(
        children,
        getReferenceProps({
          ref: refs.setReference,
          ...(children.props as Record<string, unknown>),
        }),
      )}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, maxWidth }}
            className="ui-tooltip"
            {...getFloatingProps()}
          >
            {label}
            <div
              ref={arrowRef}
              className="ui-tooltip__arrow"
              style={{
                left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
                top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
                [staticSide]: '-4px',
              }}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}

interface InfoDotProps {
  label: ReactNode
  placement?: Placement
  /** Accessible name for the trigger button. */
  ariaLabel?: string
}

/**
 * A small "?" help affordance. Tapping/hovering reveals the explanation in a
 * tooltip so the surrounding UI can stay text-light.
 */
export function InfoDot({ label, placement = 'top', ariaLabel = '설명 보기' }: InfoDotProps) {
  return (
    <Tooltip label={label} placement={placement}>
      <button type="button" className="ui-infodot" aria-label={ariaLabel}>
        <HelpCircle size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
