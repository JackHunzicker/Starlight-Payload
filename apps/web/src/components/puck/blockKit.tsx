'use client'

import React from 'react'
import { createUsePuck, type CustomField, type Data } from '@puckeditor/core'
import { createResponsiveVisibilityField } from '@delmaredigital/payload-puck/fields'

/**
 * Shared kit for locally-owned Puck blocks.
 *
 * Delmare ships every one of its components with a `_reset` control and a
 * responsive `visibility` control. `createResponsiveVisibilityField` is public,
 * but `createResetField` is NOT exported from the package's public entry, so we
 * implement an equivalent here on Puck's own public API (`createUsePuck`).
 *
 * This is not a fork or an override: it is a new field for OUR components, and
 * it fixes a real limitation in the package's internal version, which walks only
 * `data.content` plus legacy `zones` and therefore fails to reset a block nested
 * inside a slot (e.g. a ProductCatalog inside a Section). This implementation
 * recurses through nested slot arrays, so reset works at any depth.
 *
 * Use `standardBlockFields()` when minting a new block so it is compliant by
 * construction; `tests/int/block-conformance.int.spec.tsx` fails the build if a
 * block skips it.
 */

const usePuck = createUsePuck()

type PuckItem = { type: string; props: Record<string, unknown> }

function isPuckItem(value: unknown): value is PuckItem {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as PuckItem).type === 'string' &&
    typeof (value as PuckItem).props === 'object'
  )
}

/**
 * Replace the props of the component with `componentId`, recursing through
 * nested slot arrays so deeply-placed blocks can be reset too.
 */
export function resetComponentProps(
  data: Data,
  componentId: string,
  defaults: Record<string, unknown>,
): Data {
  let changed = false

  const updateItem = (item: PuckItem): PuckItem => {
    if (item.props?.id === componentId) {
      changed = true
      // Preserve the id and any slot content: resetting styling must never
      // delete the author's nested children.
      const preservedSlots: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(item.props)) {
        if (Array.isArray(value) && value.some(isPuckItem)) preservedSlots[key] = value
      }
      return { ...item, props: { ...defaults, ...preservedSlots, id: componentId } }
    }

    let nextProps: Record<string, unknown> | undefined
    for (const [key, value] of Object.entries(item.props ?? {})) {
      if (!Array.isArray(value) || !value.some(isPuckItem)) continue
      const mapped = value.map(child => (isPuckItem(child) ? updateItem(child) : child))
      if (mapped.some((child, index) => child !== value[index])) {
        nextProps = { ...(nextProps ?? item.props), [key]: mapped }
      }
    }
    return nextProps ? { ...item, props: nextProps } : item
  }

  const content = (data.content ?? []).map(item => (isPuckItem(item) ? updateItem(item) : item))
  return changed ? { ...data, content } : data
}

function ResetButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <div className="puck-field">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '6px 12px',
          fontSize: '14px',
          fontWeight: 500,
          border: 'none',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          color: 'var(--theme-elevation-500)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        Reset to defaults
      </button>
    </div>
  )
}

/**
 * A Puck custom field rendering a "Reset to defaults" button for the selected
 * component. Mirrors Delmare's control using Puck's public store API.
 */
export function createResetField<T extends object>(config: { defaultProps: T }): CustomField<unknown> {
  const ResetFieldWrapper = ({ readOnly }: { readOnly?: boolean }) => {
    const dispatch = usePuck(state => state.dispatch)
    const appState = usePuck(state => state.appState)
    const selectedItem = usePuck(state => state.selectedItem)

    const handleReset = React.useCallback(() => {
      const componentId = selectedItem?.props?.id
      if (!componentId) return
      const next = resetComponentProps(
        appState.data as Data,
        componentId as string,
        config.defaultProps as Record<string, unknown>,
      )
      if (next !== appState.data) dispatch({ type: 'setData', data: next })
    }, [dispatch, appState, selectedItem])

    return <ResetButton onClick={handleReset} disabled={readOnly || !selectedItem} />
  }

  return {
    type: 'custom',
    render: ResetFieldWrapper as never,
  }
}

/**
 * The baseline every locally-owned block must expose, matching Delmare's own
 * components. Spread this first in a block's `fields`.
 */
export function standardBlockFields<T extends object>(config: { defaultProps: T }) {
  return {
    _reset: createResetField(config),
    visibility: createResponsiveVisibilityField({ label: 'Visibility' }),
  }
}

/**
 * Merges a block's declared defaults under its stored props. Puck's live
 * renderer does NOT apply defaultProps to stored nodes — a node seeded or
 * saved with missing props reaches render undefined — so every locally-owned
 * granular block guards its render with this, keeping canonical copy
 * single-sourced in defaultProps.
 */
export function withDefaults<T extends object>(props: Partial<T>, defaults: T): T {
  const defined = Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as Partial<T>
  return { ...defaults, ...defined }
}
