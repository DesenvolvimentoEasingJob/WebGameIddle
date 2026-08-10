export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type NodeKind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'

export interface EntryNode {
  uid: string
  key: string
  node: ENode
}

export interface ItemNode {
  uid: string
  node: ENode
}

export type ENode =
  | { kind: 'string'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'object'; entries: EntryNode[] }
  | { kind: 'array'; items: ItemNode[] }

let uidCounter = 0

function nextUid(): string {
  uidCounter += 1
  return `n${uidCounter}`
}

export function toNode(value: JsonValue): ENode {
  if (value === null) {
    return { kind: 'null' }
  }
  if (Array.isArray(value)) {
    return { kind: 'array', items: value.map((item) => ({ uid: nextUid(), node: toNode(item) })) }
  }
  if (typeof value === 'object') {
    return {
      kind: 'object',
      entries: Object.entries(value).map(([key, child]) => ({
        uid: nextUid(),
        key,
        node: toNode(child),
      })),
    }
  }
  if (typeof value === 'number') {
    return { kind: 'number', text: String(value) }
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value }
  }
  return { kind: 'string', text: value }
}

export type SerializeResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: string }

function serialize(node: ENode, path: string): SerializeResult {
  switch (node.kind) {
    case 'string':
      return { ok: true, value: node.text }
    case 'boolean':
      return { ok: true, value: node.value }
    case 'null':
      return { ok: true, value: null }
    case 'number': {
      const raw = node.text.trim()
      if (raw === '') {
        return { ok: false, error: `${path}: número vazio` }
      }
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: `${path}: "${node.text}" não é um número válido` }
      }
      return { ok: true, value: parsed }
    }
    case 'array': {
      const out: JsonValue[] = []
      for (let i = 0; i < node.items.length; i += 1) {
        const child = serialize(node.items[i].node, `${path}[${i}]`)
        if (!child.ok) {
          return child
        }
        out.push(child.value)
      }
      return { ok: true, value: out }
    }
    case 'object': {
      const out: Record<string, JsonValue> = {}
      const seen = new Set<string>()
      for (const entry of node.entries) {
        const key = entry.key.trim()
        if (key === '') {
          return { ok: false, error: `${path}: existe propriedade sem nome` }
        }
        if (seen.has(key)) {
          return { ok: false, error: `${path}: propriedade "${key}" duplicada` }
        }
        seen.add(key)
        const child = serialize(entry.node, `${path}.${key}`)
        if (!child.ok) {
          return child
        }
        out[key] = child.value
      }
      return { ok: true, value: out }
    }
  }
}

export function toJson(node: ENode): SerializeResult {
  return serialize(node, 'raiz')
}

export function emptyNode(kind: NodeKind): ENode {
  switch (kind) {
    case 'string':
      return { kind: 'string', text: '' }
    case 'number':
      return { kind: 'number', text: '0' }
    case 'boolean':
      return { kind: 'boolean', value: false }
    case 'null':
      return { kind: 'null' }
    case 'object':
      return { kind: 'object', entries: [] }
    case 'array':
      return { kind: 'array', items: [] }
  }
}

/** Troca o tipo de um nó preservando o valor quando faz sentido (texto ↔ número ↔ booleano). */
export function changeKind(node: ENode, kind: NodeKind): ENode {
  if (node.kind === kind) {
    return node
  }

  if (kind === 'string') {
    if (node.kind === 'number') return { kind: 'string', text: node.text }
    if (node.kind === 'boolean') return { kind: 'string', text: String(node.value) }
  }
  if (kind === 'number' && node.kind === 'string') {
    const raw = node.text.trim()
    return { kind: 'number', text: Number.isFinite(Number(raw)) && raw !== '' ? raw : '0' }
  }
  if (kind === 'boolean' && node.kind === 'string') {
    return { kind: 'boolean', value: node.text.trim().toLowerCase() === 'true' }
  }

  return emptyNode(kind)
}

export function newEntry(key: string, kind: NodeKind = 'string'): EntryNode {
  return { uid: nextUid(), key, node: emptyNode(kind) }
}

export function newItem(kind: NodeKind = 'string'): ItemNode {
  return { uid: nextUid(), node: emptyNode(kind) }
}

/** Rótulo curto para grupos/listas fechados. */
export function summarize(node: ENode): string {
  if (node.kind === 'object') {
    return `${node.entries.length} propriedade${node.entries.length === 1 ? '' : 's'}`
  }
  if (node.kind === 'array') {
    return `${node.items.length} item${node.items.length === 1 ? '' : 'ns'}`
  }
  return ''
}

export function cloneNode(node: ENode): ENode {
  const result = toJson(node)
  return result.ok ? toNode(result.value) : node
}
