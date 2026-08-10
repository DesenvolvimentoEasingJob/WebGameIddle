import { useCallback, useEffect, useState } from 'react'
import { getContent, putContent } from '../api/contentFs'
import { generateAttributeCard, getApiBase } from '../api/editorApi'
import {
  coreDocWithAttribute,
  emptyAttributeForm,
  isAttributeKey,
  listAttributeKeys,
  parseAttributeForm,
  validateAttributeForm,
  type AttributeCoreDoc,
  type AttributeFormData,
} from '../lib/attributeModel'

export function AttributesEditor() {
  const [doc, setDoc] = useState<AttributeCoreDoc | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [form, setForm] = useState<AttributeFormData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState('')
  /** Bust browser cache when regenerating the same /api/assets/... path. */
  const [previewBurst, setPreviewBurst] = useState(0)
  const [previewBroken, setPreviewBroken] = useState(false)

  const apiBase = getApiBase()

  const refresh = useCallback(async () => {
    const loaded = await getContent<AttributeCoreDoc>('attributes', 'core')
    setDoc(loaded)
    return loaded
  }, [])

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao carregar attributes/core.json')
    })
  }, [refresh])

  const keys = doc ? listAttributeKeys(doc) : []

  function confirmDiscard(): boolean {
    if (!dirty) return true
    return window.confirm('Há alterações não salvas. Descartar?')
  }

  function loadKey(key: string) {
    if (!doc) return
    if (!confirmDiscard()) return
    setSelectedKey(key)
    setForm(parseAttributeForm(key, doc[key]))
    setDirty(false)
    setIsNew(false)
    setError(null)
    setNotice(null)
    setFormulaDraft('')
    setPreviewBurst(Date.now())
    setPreviewBroken(false)
  }

  function startNew() {
    if (!confirmDiscard()) return
    setSelectedKey(null)
    setForm(emptyAttributeForm())
    setDirty(true)
    setIsNew(true)
    setError(null)
    setNotice('Novo atributo. Defina a key (ex.: strength) e salve em core.json.')
    setFormulaDraft('')
  }

  function applyFormChange(next: AttributeFormData) {
    setForm(next)
    setDirty(true)
    setNotice(null)
  }

  function addFormula() {
    if (!form) return
    const f = formulaDraft.trim()
    if (!f) return
    applyFormChange({ ...form, formulas: [...form.formulas, f] })
    setFormulaDraft('')
  }

  function removeFormula(index: number) {
    if (!form) return
    applyFormChange({
      ...form,
      formulas: form.formulas.filter((_, i) => i !== index),
    })
  }

  async function save() {
    if (!form || !doc) return
    const validation = validateAttributeForm(form)
    if (validation) {
      setError(validation)
      return
    }
    if (!isNew && selectedKey && selectedKey !== form.key.trim()) {
      if (keys.includes(form.key.trim())) {
        setError(`Key "${form.key.trim()}" já existe.`)
        return
      }
    }
    if (isNew && keys.includes(form.key.trim())) {
      setError(`Key "${form.key.trim()}" já existe.`)
      return
    }

    const nextDoc = coreDocWithAttribute(doc, form, isNew ? null : selectedKey)
    setBusy(true)
    setError(null)
    try {
      const saved = await putContent('attributes', 'core', nextDoc as AttributeCoreDoc & { id: string })
      setDoc(saved)
      const key = form.key.trim()
      setSelectedKey(key)
      setForm(parseAttributeForm(key, saved[key]))
      setDirty(false)
      setIsNew(false)
      setNotice(`Salvo em content/attributes/core.json (${key})`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!doc || !selectedKey) return
    if (!window.confirm(`Remover atributo "${selectedKey}" de core.json?`)) return
    if (!confirmDiscard() && dirty) return

    const next: AttributeCoreDoc = { ...doc, id: 'core' }
    delete next[selectedKey]
    setBusy(true)
    setError(null)
    try {
      const saved = await putContent('attributes', 'core', next as AttributeCoreDoc & { id: string })
      setDoc(saved)
      setSelectedKey(null)
      setForm(null)
      setDirty(false)
      setNotice(`Atributo ${selectedKey} removido.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover')
    } finally {
      setBusy(false)
    }
  }

  async function runGenerateCard() {
    if (!form) return
    const id = form.key.trim()
    if (!isAttributeKey(id)) {
      setError('Defina uma key válida antes de gerar o card.')
      return
    }
    setCardBusy(true)
    setError(null)
    try {
      const result = await generateAttributeCard({
        id,
        name: form.name,
        description: form.description,
        prompt: form.artPrompt,
      })
      setForm({ ...form, assets: { card: result.cardPath } })
      setDirty(true)
      setPreviewBurst(Date.now())
      setPreviewBroken(false)
      if (result.source === 'fallback') {
        const why = result.detail || result.reason || 'sem API'
        setNotice(`Card fallback (${result.reason ?? 'erro'}). ${why}`)
        setError(why)
      } else {
        setError(null)
        setNotice(`Card Gemini gerado: ${result.cardPath} — salve para gravar o path no core.json.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar card')
    } finally {
      setCardBusy(false)
    }
  }

  const previewSrc = form
    ? resolveCardPreview(form.assets.card, apiBase, previewBurst)
    : null

  return (
    <section className="editor-layout">
      <aside className="entity-sidebar">
        <div className="entity-sidebar__head">
          <h2>Atributos</h2>
          <div className="entity-sidebar__actions">
            <button type="button" className="btn btn--primary" onClick={startNew}>
              + Novo
            </button>
          </div>
        </div>
        <p className="muted small">
          {keys.length} atributos · <code>content/attributes/core.json</code>
        </p>
        <ul className="entity-list">
          {keys.map((key) => {
            const node = doc?.[key]
            const name =
              node && typeof node === 'object' && !Array.isArray(node) && typeof (node as { name?: unknown }).name === 'string'
                ? (node as { name: string }).name
                : ''
            return (
              <li key={key}>
                <button
                  type="button"
                  className={key === selectedKey ? 'entity-item is-active' : 'entity-item'}
                  onClick={() => loadKey(key)}
                >
                  <span className="entity-item__id">{key}</span>
                  <span className="entity-item__meta">{name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="editor-main">
        {!form ? (
          <div className="editor-empty">
            <h1>Atributos</h1>
            <p className="muted">
              Edite fórmulas e metadados do treino. Gere arte de card com <strong>Google Gemini</strong>{' '}
              (PixelLab continua só para ícones de item).
            </p>
          </div>
        ) : (
          <>
            <header className="editor-toolbar">
              <div className="editor-toolbar__actions">
                <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                  Salvar
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={remove}
                  disabled={busy || !selectedKey}
                >
                  Remover
                </button>
              </div>
              {dirty && <span className="badge badge--warn">não salvo</span>}
              {isNew && <span className="badge">novo atributo</span>}
            </header>

            {error && <p className="error">{error}</p>}
            {notice && !error && <p className="notice">{notice}</p>}

            <div className="editor-body">
              <div className="item-form attr-form">
                <div className="item-form__grid">
                  <label className="field">
                    <span className="field__label">key</span>
                    <input
                      type="text"
                      value={form.key}
                      disabled={!isNew && !!selectedKey}
                      placeholder="ex.: strength"
                      onChange={(e) => applyFormChange({ ...form, key: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">nome</span>
                    <input
                      type="text"
                      value={form.name}
                      placeholder="Força"
                      onChange={(e) => applyFormChange({ ...form, name: e.target.value })}
                    />
                  </label>
                  <label className="field item-form__full">
                    <span className="field__label">descrição (flavor)</span>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => applyFormChange({ ...form, description: e.target.value })}
                    />
                  </label>
                </div>

                <section className="item-form__section">
                  <header className="item-form__section-head">
                    <h3>Fórmulas</h3>
                    <p className="muted small">
                      Strings do motor: <code>hpBase * 0.2</code> ou <code>magicianCastTime - 0.3</code>
                    </p>
                  </header>
                  <ul className="attr-formula-list">
                    {form.formulas.map((f, i) => (
                      <li key={`${f}-${i}`}>
                        <code>{f}</code>
                        <button type="button" className="btn" onClick={() => removeFormula(i)}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="attr-formula-add">
                    <input
                      type="text"
                      value={formulaDraft}
                      placeholder="dmgBase * 0.4"
                      onChange={(e) => setFormulaDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addFormula()
                        }
                      }}
                    />
                    <button type="button" className="btn" onClick={addFormula}>
                      + Fórmula
                    </button>
                  </div>
                </section>

                <section className="item-form__section">
                  <header className="item-form__section-head">
                    <h3>Arte do card (Gemini)</h3>
                    <p className="muted small">
                      Gera PNG em <code>data/assets/attributes/</code> — não usa PixelLab.
                    </p>
                  </header>
                  <label className="field">
                    <span className="field__label">prompt de arte (opcional)</span>
                    <textarea
                      rows={4}
                      value={form.artPrompt}
                      placeholder="Descreva a cena do card: estilo Magic, cores, símbolo do atributo…"
                      onChange={(e) => applyFormChange({ ...form, artPrompt: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">assets.card</span>
                    <input
                      type="text"
                      value={form.assets.card}
                      onChange={(e) =>
                        applyFormChange({ ...form, assets: { card: e.target.value } })
                      }
                    />
                  </label>
                  <div className="attr-card-row">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={runGenerateCard}
                      disabled={cardBusy || !form.key.trim()}
                    >
                      {cardBusy ? 'Gerando…' : 'Gerar card (Gemini)'}
                    </button>
                    <div className="attr-card-preview">
                      {previewSrc && !previewBroken ? (
                        <img
                          key={previewSrc}
                          src={previewSrc}
                          alt=""
                          onLoad={() => setPreviewBroken(false)}
                          onError={() => {
                            setPreviewBroken(true)
                            setError(
                              `Preview falhou ao carregar ${previewSrc}. Confira se a API está em ${apiBase}.`,
                            )
                          }}
                        />
                      ) : (
                        <span className="muted small">
                          {previewBroken ? 'falha no preview' : 'sem preview'}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function resolveCardPreview(card: string, apiBase: string, burst = 0): string | null {
  const path = card.trim()
  if (!path) return null

  let url: string
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    url = path
  } else if (path.startsWith('/api/')) {
    url = `${apiBase.replace(/\/$/, '')}${path}`
  } else {
    url = path
  }

  if (!burst || url.startsWith('data:')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${burst}`
}
