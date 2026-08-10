export interface AttributeFormData {
  key: string
  name: string
  description: string
  formulas: string[]
  assets: { card: string }
  artPrompt: string
}

export type AttributeCoreDoc = {
  id?: string
} & Record<string, unknown>

const ATTR_KEY_PATTERN = /^[a-z][a-z0-9_]*$/

export function isAttributeKey(key: string): boolean {
  return ATTR_KEY_PATTERN.test(key) && key !== 'id'
}

export function emptyAttributeForm(): AttributeFormData {
  return {
    key: '',
    name: '',
    description: '',
    formulas: [],
    assets: { card: '' },
    artPrompt: '',
  }
}

export function parseAttributeForm(key: string, node: unknown): AttributeFormData {
  if (Array.isArray(node)) {
    return {
      key,
      name: '',
      description: '',
      formulas: node.filter((x): x is string => typeof x === 'string'),
      assets: { card: `/api/assets/attributes/${key}.png` },
      artPrompt: '',
    }
  }

  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    const formulas = Array.isArray(o.formulas)
      ? o.formulas.filter((x): x is string => typeof x === 'string')
      : []
    const assets =
      o.assets && typeof o.assets === 'object'
        ? (o.assets as Record<string, unknown>)
        : {}
    const card = typeof assets.card === 'string' ? assets.card : `/api/assets/attributes/${key}.png`
    return {
      key,
      name: typeof o.name === 'string' ? o.name : '',
      description: typeof o.description === 'string' ? o.description : '',
      formulas,
      assets: { card },
      artPrompt: typeof o.artPrompt === 'string' ? o.artPrompt : '',
    }
  }

  return { ...emptyAttributeForm(), key }
}

export function attributeFormToNode(form: AttributeFormData): Record<string, unknown> {
  const node: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim(),
    formulas: form.formulas.map((f) => f.trim()).filter(Boolean),
    assets: { card: form.assets.card.trim() },
  }
  if (form.artPrompt.trim()) {
    node.artPrompt = form.artPrompt.trim()
  }
  return node
}

export function validateAttributeForm(form: AttributeFormData): string | null {
  if (!isAttributeKey(form.key.trim())) {
    return 'Key inválida. Use snake_case: strength, intelligence, …'
  }
  if (!form.name.trim()) {
    return 'Nome é obrigatório.'
  }
  if (form.formulas.length === 0) {
    return 'Informe ao menos uma fórmula.'
  }
  return null
}

export function listAttributeKeys(doc: AttributeCoreDoc): string[] {
  return Object.keys(doc)
    .filter(isAttributeKey)
    .sort((a, b) => a.localeCompare(b))
}

export function coreDocWithAttribute(
  doc: AttributeCoreDoc,
  form: AttributeFormData,
  previousKey?: string | null,
): AttributeCoreDoc {
  const next: AttributeCoreDoc = { ...doc, id: 'core' }
  const key = form.key.trim()
  if (previousKey && previousKey !== key && isAttributeKey(previousKey)) {
    delete next[previousKey]
  }
  next[key] = attributeFormToNode(form)
  return next
}
