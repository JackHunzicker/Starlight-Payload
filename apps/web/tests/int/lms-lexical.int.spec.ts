import { describe, it, expect } from 'vitest'
import { lexicalParagraphs } from '@/components/puck/lexicalText'

/**
 * The LMS renderer flattens Lexical rich text to lines. Lists used to collapse
 * into one run-on paragraph — every bullet or numbered step merged into a
 * single line — which made any step-by-step activity unreadable.
 */

const doc = (children: unknown[]) => ({ root: { children } })
const paragraph = (text: string) => ({ type: 'paragraph', children: [{ text }] })
const listItem = (text: string) => ({ type: 'listitem', children: [{ text }] })

describe('lexicalParagraphs', () => {
  it('returns one line per paragraph', () => {
    expect(lexicalParagraphs(doc([paragraph('First.'), paragraph('Second.')]))).toEqual([
      'First.',
      'Second.',
    ])
  })

  it('keeps bullet list items on separate lines', () => {
    const value = doc([
      paragraph('Materials:'),
      { type: 'list', listType: 'bullet', children: [listItem('Pipette'), listItem('Vial')] },
    ])
    expect(lexicalParagraphs(value)).toEqual(['Materials:', '• Pipette', '• Vial'])
  })

  it('numbers ordered list items rather than merging them', () => {
    const value = doc([
      { type: 'list', listType: 'number', children: [listItem('Warm.'), listItem('Mix.'), listItem('Measure.')] },
    ])
    expect(lexicalParagraphs(value)).toEqual(['1. Warm.', '2. Mix.', '3. Measure.'])
  })

  it('handles a nested list without losing the parent item', () => {
    const value = doc([
      {
        type: 'list',
        listType: 'bullet',
        children: [
          {
            type: 'listitem',
            children: [
              { text: 'Prepare' },
              { type: 'list', listType: 'bullet', children: [listItem('Rinse'), listItem('Dry')] },
            ],
          },
        ],
      },
    ])
    expect(lexicalParagraphs(value)).toEqual(['• Prepare', '• Rinse', '• Dry'])
  })

  it('tolerates plain strings, empty nodes and missing input', () => {
    expect(lexicalParagraphs('one\ntwo')).toEqual(['one', 'two'])
    expect(lexicalParagraphs(doc([paragraph('   ')]))).toEqual([])
    expect(lexicalParagraphs(null)).toEqual([])
    expect(lexicalParagraphs({})).toEqual([])
  })
})
