import type { ENode, NodeKind } from '../lib/jsonModel'
import { changeKind, newEntry, newItem, summarize } from '../lib/jsonModel'

const TYPE_OPTIONS: { kind: NodeKind; label: string }[] = [
  { kind: 'string', label: 'texto' },
  { kind: 'number', label: 'número' },
  { kind: 'boolean', label: 'booleano' },
  { kind: 'null', label: 'nulo' },
  { kind: 'object', label: 'grupo { }' },
  { kind: 'array', label: 'lista [ ]' },
]

export type Suggestions = Record<string, string[]>

interface NodeEditorProps {
  node: ENode
  onChange: (node: ENode) => void
  suggestions: Suggestions
  /** Nome da propriedade que contém este nó — usado para sugerir ids existentes. */
  propertyName?: string
  depth: number
}

function TypeSelect({ node, onChange }: { node: ENode; onChange: (node: ENode) => void }) {
  return (
    <select
      className="jse-type"
      value={node.kind}
      onChange={(e) => onChange(changeKind(node, e.target.value as NodeKind))}
      aria-label="Tipo do valor"
    >
      {TYPE_OPTIONS.map((opt) => (
        <option key={opt.kind} value={opt.kind}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function ValueInput({
  node,
  onChange,
  suggestions,
  propertyName,
}: {
  node: ENode
  onChange: (node: ENode) => void
  suggestions: Suggestions
  propertyName?: string
}) {
  if (node.kind === 'string') {
    const listId = propertyName && suggestions[propertyName] ? `sug-${propertyName}` : undefined
    return (
      <input
        className="jse-value"
        type="text"
        value={node.text}
        list={listId}
        placeholder="valor"
        onChange={(e) => onChange({ kind: 'string', text: e.target.value })}
      />
    )
  }

  if (node.kind === 'number') {
    return (
      <input
        className="jse-value jse-value--num"
        type="text"
        inputMode="decimal"
        value={node.text}
        onChange={(e) => onChange({ kind: 'number', text: e.target.value })}
      />
    )
  }

  if (node.kind === 'boolean') {
    return (
      <label className="jse-bool">
        <input
          type="checkbox"
          checked={node.value}
          onChange={(e) => onChange({ kind: 'boolean', value: e.target.checked })}
        />
        <span>{node.value ? 'true' : 'false'}</span>
      </label>
    )
  }

  if (node.kind === 'null') {
    return <span className="jse-null">null</span>
  }

  return <span className="jse-summary">{summarize(node)}</span>
}

function AddButtons({
  onAdd,
  isArray,
}: {
  onAdd: (kind: NodeKind) => void
  isArray: boolean
}) {
  return (
    <div className="jse-add">
      <button type="button" onClick={() => onAdd('string')}>
        + {isArray ? 'item' : 'propriedade'}
      </button>
      <button type="button" onClick={() => onAdd('object')}>
        + grupo
      </button>
      <button type="button" onClick={() => onAdd('array')}>
        + lista
      </button>
    </div>
  )
}

export function JsonNodeEditor({
  node,
  onChange,
  suggestions,
  propertyName,
  depth,
}: NodeEditorProps) {
  if (node.kind === 'object') {
    return (
      <div className="jse-block">
        {node.entries.map((entry, index) => {
          const isComplex = entry.node.kind === 'object' || entry.node.kind === 'array'
          const replaceNode = (child: ENode) => {
            const entries = [...node.entries]
            entries[index] = { ...entry, node: child }
            onChange({ kind: 'object', entries })
          }

          return (
            <div className="jse-entry" key={entry.uid}>
              <div className="jse-row">
                <input
                  className="jse-key"
                  type="text"
                  value={entry.key}
                  placeholder="nome"
                  onChange={(e) => {
                    const entries = [...node.entries]
                    entries[index] = { ...entry, key: e.target.value }
                    onChange({ kind: 'object', entries })
                  }}
                />
                <TypeSelect node={entry.node} onChange={replaceNode} />
                <ValueInput
                  node={entry.node}
                  onChange={replaceNode}
                  suggestions={suggestions}
                  propertyName={entry.key}
                />
                <button
                  type="button"
                  className="jse-remove"
                  title="Remover propriedade"
                  onClick={() =>
                    onChange({
                      kind: 'object',
                      entries: node.entries.filter((_, i) => i !== index),
                    })
                  }
                >
                  ✕
                </button>
              </div>
              {isComplex && (
                <JsonNodeEditor
                  node={entry.node}
                  onChange={replaceNode}
                  suggestions={suggestions}
                  propertyName={entry.key}
                  depth={depth + 1}
                />
              )}
            </div>
          )
        })}
        <AddButtons
          isArray={false}
          onAdd={(kind) =>
            onChange({
              kind: 'object',
              entries: [...node.entries, newEntry(`propriedade${node.entries.length + 1}`, kind)],
            })
          }
        />
      </div>
    )
  }

  if (node.kind === 'array') {
    return (
      <div className="jse-block">
        {node.items.map((item, index) => {
          const isComplex = item.node.kind === 'object' || item.node.kind === 'array'
          const replaceNode = (child: ENode) => {
            const items = [...node.items]
            items[index] = { ...item, node: child }
            onChange({ kind: 'array', items })
          }

          const move = (delta: number) => {
            const target = index + delta
            if (target < 0 || target >= node.items.length) return
            const items = [...node.items]
            const [picked] = items.splice(index, 1)
            items.splice(target, 0, picked)
            onChange({ kind: 'array', items })
          }

          return (
            <div className="jse-entry" key={item.uid}>
              <div className="jse-row">
                <span className="jse-index">{index}</span>
                <TypeSelect node={item.node} onChange={replaceNode} />
                <ValueInput
                  node={item.node}
                  onChange={replaceNode}
                  suggestions={suggestions}
                  propertyName={propertyName}
                />
                <button type="button" className="jse-move" title="Subir" onClick={() => move(-1)}>
                  ↑
                </button>
                <button type="button" className="jse-move" title="Descer" onClick={() => move(1)}>
                  ↓
                </button>
                <button
                  type="button"
                  className="jse-remove"
                  title="Remover item"
                  onClick={() =>
                    onChange({ kind: 'array', items: node.items.filter((_, i) => i !== index) })
                  }
                >
                  ✕
                </button>
              </div>
              {isComplex && (
                <JsonNodeEditor
                  node={item.node}
                  onChange={replaceNode}
                  suggestions={suggestions}
                  propertyName={propertyName}
                  depth={depth + 1}
                />
              )}
            </div>
          )
        })}
        <AddButtons
          isArray
          onAdd={(kind) => onChange({ kind: 'array', items: [...node.items, newItem(kind)] })}
        />
      </div>
    )
  }

  return null
}

export function SuggestionDataLists({ suggestions }: { suggestions: Suggestions }) {
  return (
    <>
      {Object.entries(suggestions).map(([name, values]) => (
        <datalist key={name} id={`sug-${name}`}>
          {values.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      ))}
    </>
  )
}
