import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteContent, listContent, putContent } from '../api/contentFs'
import {
  commitItemIcon,
  discardPixelLabDraft,
  draftItem,
  generateItemIcon,
  getApiBase,
} from '../api/editorApi'
import { JsonNodeEditor } from '../components/JsonNodeEditor'
import {
  PixelLabQualityModal,
  type PixelLabGenerateOptions,
  type PixelLabQuality,
} from '../components/PixelLabQualityModal'
import { PixelLabReviewModal } from '../components/PixelLabReviewModal'
import type { ENode, JsonValue } from '../lib/jsonModel'
import { toJson, toNode } from '../lib/jsonModel'
import {
  emptyItemForm,
  itemFormToJson,
  parseItemForm,
  validateItemForm,
  type ItemFormData,
} from '../lib/itemModel'
import { ItemFormEditor, resolveIconPreview } from './ItemFormEditor'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type EntityRecord = Record<string, JsonValue> & { id?: string }

function describe(entity: EntityRecord): string {
  const parts: string[] = []
  if (typeof entity.name === 'string' && entity.name) parts.push(entity.name)
  if (typeof entity.type === 'string' && entity.type) parts.push(entity.type)
  if (typeof entity.itemLevel === 'number') parts.push(`ilvl ${entity.itemLevel}`)
  return parts.join(' · ')
}

function itemIconPath(entity: EntityRecord): string {
  const assets = entity.assets
  if (assets && typeof assets === 'object' && !Array.isArray(assets)) {
    const icon = (assets as Record<string, JsonValue>).icon
    if (typeof icon === 'string' && icon.trim()) return icon.trim()
  }
  if (typeof entity.id === 'string' && entity.id) {
    return `/api/assets/items/${entity.id}.png`
  }
  return ''
}

function ItemListThumb({
  icon,
  apiBase,
  previewBurst = 0,
}: {
  icon: string
  apiBase: string
  previewBurst?: number
}) {
  const [broken, setBroken] = useState(false)
  const src = resolveIconPreview(icon, apiBase, previewBurst)

  useEffect(() => {
    setBroken(false)
  }, [src])

  if (!src || broken) {
    return <span className="entity-item__thumb entity-item__thumb--empty" aria-hidden />
  }

  return (
    <span className="entity-item__thumb">
      <img
        key={src}
        src={src}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </span>
  )
}

export function ItemsEditor() {
  const [entities, setEntities] = useState<EntityRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<ItemFormData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [iconBusy, setIconBusy] = useState(false)
  const [iconQualityOpen, setIconQualityOpen] = useState(false)
  const [activeIconQuality, setActiveIconQuality] = useState<PixelLabQuality>('standard')
  const [activeIconSize, setActiveIconSize] = useState(128)
  const [iconReview, setIconReview] = useState<{
    draftId: string
    candidates: Array<{ index: number; previewPath: string }>
    model?: string
    alreadyCommitted?: boolean
    committedPath?: string
  } | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  /** Cache-bust query for /api/assets/items/... (same filename after regenerate). */
  const [previewBurst, setPreviewBurst] = useState(() => Date.now())

  const apiBase = getApiBase()

  const refresh = useCallback(async () => {
    const list = await listContent<EntityRecord>('items')
    setEntities(list)
    return list
  }, [])

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar itens')
    })
  }, [refresh])

  const rawNode: ENode | null = useMemo(() => {
    if (!form) return null
    const id = form.id.trim() || selectedId || ''
    return toNode(itemFormToJson(form, id) as unknown as JsonValue)
  }, [form, selectedId])

  const jsonPreview = useMemo(() => {
    if (!rawNode) return ''
    const result = toJson(rawNode)
    return result.ok ? JSON.stringify(result.value, null, 2) : `// ${result.error}`
  }, [rawNode])

  function confirmDiscard(): boolean {
    if (!dirty) return true
    return window.confirm('Há alterações não salvas. Descartar?')
  }

  function loadEntity(entity: EntityRecord) {
    if (!confirmDiscard()) return
    const parsed = parseItemForm(entity)
    setSelectedId(typeof entity.id === 'string' ? entity.id : null)
    setForm(parsed)
    setDirty(false)
    setIsNew(false)
    setError(null)
    setNotice(null)
  }

  function startNew() {
    if (!confirmDiscard()) return
    setSelectedId(null)
    setForm(emptyItemForm())
    setDirty(true)
    setIsNew(true)
    setError(null)
    setNotice('Novo item. Defina o id e salve, ou use Criar com IA.')
  }

  function duplicateCurrent() {
    if (!form) return
    setForm({
      ...form,
      id: form.id ? `${form.id}-copia` : '',
      assets: { icon: form.assets.icon },
    })
    setSelectedId(null)
    setIsNew(true)
    setDirty(true)
    setError(null)
    setNotice('Cópia carregada. Ajuste o id e salve como novo arquivo.')
  }

  function applyFormChange(next: ItemFormData) {
    setForm(next)
    setDirty(true)
    setNotice(null)
  }

  async function persistForm(
    formToSave: ItemFormData,
    opts?: { quiet?: boolean; successNotice?: string },
  ): Promise<boolean> {
    const id = formToSave.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Id inválido. Use kebab-case: letras/números minúsculos e hífen.')
      return false
    }
    const validation = validateItemForm(formToSave)
    if (validation) {
      setError(validation)
      return false
    }

    const body = itemFormToJson(formToSave, id)
    const renamedFrom = selectedId && selectedId !== id ? selectedId : null

    setBusy(true)
    setError(null)
    try {
      await putContent('items', id, body)
      await refresh()
      setSelectedId(id)
      setForm(parseItemForm(body))
      setDirty(false)
      setIsNew(false)
      if (!opts?.quiet) {
        setNotice(
          opts?.successNotice ??
            (renamedFrom
              ? `Salvo em content/items/${id}.json — o arquivo ${renamedFrom}.json continua no disco.`
              : `Salvo em content/items/${id}.json`),
        )
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!form) return
    await persistForm(form)
  }

  async function remove() {
    if (!selectedId) return
    if (!window.confirm(`Excluir content/items/${selectedId}.json?`)) return

    setBusy(true)
    setError(null)
    try {
      await deleteContent('items', selectedId)
      await refresh()
      setSelectedId(null)
      setForm(null)
      setDirty(false)
      setNotice('Arquivo excluído.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setBusy(false)
    }
  }

  async function runAiDraft() {
    const description = aiPrompt.trim()
    if (!description) {
      setError('Descreva o item para a IA.')
      return
    }
    setAiBusy(true)
    setError(null)
    try {
      const draft = await draftItem(description)
      if (!confirmDiscard()) return
      setForm(parseItemForm(draft))
      setSelectedId(null)
      setIsNew(true)
      setDirty(true)
      setAiOpen(false)
      setAiPrompt('')
      setNotice('Rascunho da IA carregado. Revise e salve.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no draft IA')
    } finally {
      setAiBusy(false)
    }
  }

  function requestGenerateIcon() {
    if (!form) return
    const id = form.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Defina um id kebab-case válido antes de gerar o ícone.')
      return
    }
    setError(null)
    setIconQualityOpen(true)
  }

  async function runGenerateIcon(options: PixelLabGenerateOptions) {
    if (!form) return
    const id = form.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Defina um id kebab-case válido antes de gerar o ícone.')
      return
    }
    setIconQualityOpen(false)
    setActiveIconQuality(options.quality)
    setActiveIconSize(options.size)
    setIconBusy(true)
    setError(null)
    setNotice(null)
    setPreviewBurst(Date.now())
    try {
      const result = await generateItemIcon({
        id,
        name: form.name,
        description: form.description,
        type: form.type,
        quality: options.quality,
        size: options.size,
      })
      if (!result.candidates?.length) {
        setError('Geração não retornou imagens.')
        if (result.draftId) await discardPixelLabDraft(result.draftId).catch(() => undefined)
        return
      }
      setIconReview({
        draftId: result.draftId,
        candidates: result.candidates,
        model: result.model,
        alreadyCommitted: result.alreadyCommitted,
        committedPath: result.committedPath,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar ícone')
      setNotice(null)
    } finally {
      setIconBusy(false)
    }
  }

  async function commitIconSelection(index: number) {
    if (!form || !iconReview) return
    const id = form.id.trim()
    const review = iconReview
    const draftId = review.draftId
    const legacy = !!review.alreadyCommitted
    const legacyPath =
      review.committedPath ||
      review.candidates.find((c) => c.index === index)?.previewPath ||
      review.candidates[0]?.previewPath
    const reviewModel = review.model
    setIconReview(null)
    setIconBusy(true)
    setError(null)
    try {
      let iconPath: string
      let source = 'pixellab'
      let reason: string | undefined
      let model = reviewModel

      if (legacy || !draftId) {
        if (!legacyPath) {
          setError('Caminho do ícone ausente na resposta.')
          return
        }
        iconPath = legacyPath
      } else {
        const result = await commitItemIcon({ id, draftId, index })
        iconPath = result.iconPath
        source = result.source
        reason = result.reason
        model = result.model ?? model
      }

      const nextForm: ItemFormData = {
        ...form,
        assets: { icon: iconPath },
      }
      setForm(nextForm)
      setDirty(true)
      setPreviewBurst(Date.now())

      const modelLabel = model
        ? ` (${model})`
        : activeIconQuality === 'pro'
          ? ' (Pro)'
          : ' (Standard)'
      const generatedLabel =
        source === 'fallback'
          ? `Ícone fallback (${reason ?? 'sem API'}). Path: ${iconPath}`
          : `Ícone escolhido${modelLabel}: ${iconPath}`

      const saved = await persistForm(nextForm, {
        successNotice: `${generatedLabel}. Salvo automaticamente em content/items/${id}.json`,
      })
      if (!saved) {
        setNotice(`${generatedLabel}. Não foi possível salvar — clique em Salvar.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar ícone')
      if (draftId) await discardPixelLabDraft(draftId).catch(() => undefined)
    } finally {
      setIconBusy(false)
    }
  }

  async function cancelIconReview() {
    if (!iconReview) return
    const draftId = iconReview.draftId
    const legacy = iconReview.alreadyCommitted
    setIconReview(null)
    if (draftId && !legacy) {
      await discardPixelLabDraft(draftId).catch(() => undefined)
      setNotice('Geração descartada — asset final não foi alterado.')
    } else {
      setNotice('Revisão fechada. Se a API antiga já gravou o PNG, ele permanece no disco.')
    }
  }

  function onRawChange(next: ENode) {
    const serialized = toJson(next)
    if (!serialized.ok) {
      setError(serialized.error)
      return
    }
    setForm(parseItemForm(serialized.value))
    setDirty(true)
    setNotice(null)
  }

  return (
    <section className="editor-layout">
      <aside className="entity-sidebar">
        <div className="entity-sidebar__head">
          <h2>Itens</h2>
          <div className="entity-sidebar__actions">
            <button type="button" className="btn" onClick={() => setAiOpen(true)}>
              IA
            </button>
            <button type="button" className="btn btn--primary" onClick={startNew}>
              + Novo
            </button>
          </div>
        </div>
        <p className="muted small">
          {entities.length} itens · <code>content/items/</code>
        </p>
        <ul className="entity-list">
          {entities.map((entity) => {
            const id = typeof entity.id === 'string' ? entity.id : '(sem id)'
            return (
              <li key={id}>
                <button
                  type="button"
                  className={
                    id === selectedId
                      ? 'entity-item entity-item--with-thumb is-active'
                      : 'entity-item entity-item--with-thumb'
                  }
                  onClick={() => loadEntity(entity)}
                >
                  <span className="entity-item__body">
                    <span className="entity-item__id">{id}</span>
                    <span className="entity-item__meta">{describe(entity)}</span>
                  </span>
                  <ItemListThumb
                    icon={itemIconPath(entity)}
                    apiBase={apiBase}
                    previewBurst={previewBurst}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="editor-main">
        {!form ? (
          <div className="editor-empty">
            <h1>Itens</h1>
            <p className="muted">
              Selecione um item, clique em <strong>+ Novo</strong> ou use <strong>IA</strong> para
              rascunhar a partir de uma descrição.
            </p>
          </div>
        ) : (
          <>
            <header className="editor-toolbar">
              <div className="editor-toolbar__actions">
                <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                  Salvar
                </button>
                <button type="button" className="btn" onClick={duplicateCurrent} disabled={busy}>
                  Duplicar
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={remove}
                  disabled={busy || !selectedId}
                >
                  Excluir
                </button>
                <button type="button" className="btn" onClick={() => setShowRaw((v) => !v)}>
                  {showRaw ? 'Formulário' : 'JSON bruto'}
                </button>
                <button type="button" className="btn" onClick={() => setAiOpen(true)}>
                  Criar com IA
                </button>
              </div>
              {dirty && <span className="badge badge--warn">não salvo</span>}
              {isNew && <span className="badge">novo arquivo</span>}
            </header>

            {error && <p className="error">{error}</p>}
            {notice && !error && <p className="notice">{notice}</p>}

            <div className="editor-body">
              {showRaw && rawNode ? (
                <JsonNodeEditor node={rawNode} onChange={onRawChange} suggestions={{}} depth={0} />
              ) : (
                <ItemFormEditor
                  value={form}
                  idLocked={!isNew && !!selectedId}
                  onChange={applyFormChange}
                  onGenerateIcon={requestGenerateIcon}
                  iconBusy={iconBusy}
                  apiBase={apiBase}
                  previewBurst={previewBurst}
                />
              )}
            </div>

            {showRaw && <pre className="json-preview">{jsonPreview}</pre>}
          </>
        )}
      </div>

      {aiOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => !aiBusy && setAiOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-labelledby="ai-draft-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-draft-title">Criar item com IA</h2>
            <p className="muted small">
              Descreva o item em português. A API monta um rascunho JSON — você revisa e salva.
            </p>
            <label className="field">
              <span className="field__label">descrição</span>
              <textarea
                rows={5}
                value={aiPrompt}
                placeholder="Ex.: adaga enferrujada de bandido, dano baixo, nível 2"
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={aiBusy}
              />
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" disabled={aiBusy} onClick={() => setAiOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={aiBusy}
                onClick={runAiDraft}
              >
                {aiBusy ? 'Gerando…' : 'Gerar rascunho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {iconQualityOpen && (
        <PixelLabQualityModal
          title="Gerar ícone"
          kind="icon"
          onCancel={() => setIconQualityOpen(false)}
          onConfirm={runGenerateIcon}
        />
      )}

      {iconReview && (
        <PixelLabReviewModal
          mode="pick"
          title="Escolher ícone"
          candidates={iconReview.candidates}
          onCancel={() => void cancelIconReview()}
          onConfirm={(index) => void commitIconSelection(index)}
        />
      )}

      {iconBusy && (
        <div className="modal-backdrop modal-backdrop--busy" role="presentation">
          <div
            className="modal modal--busy"
            role="alertdialog"
            aria-busy="true"
            aria-labelledby="item-icon-busy-title"
            aria-describedby="item-icon-busy-desc"
          >
            <div className="busy-spinner" aria-hidden />
            <h2 id="item-icon-busy-title">
              {activeIconQuality === 'pro'
                ? `Gerando ícone ${activeIconSize}×${activeIconSize} (Pro)…`
                : `Gerando ícone ${activeIconSize}×${activeIconSize}…`}
            </h2>
            <p id="item-icon-busy-desc" className="muted small">
              {activeIconQuality === 'pro'
                ? 'PixelLab Pro pode levar mais tempo e custa ~10× créditos. Não feche esta página.'
                : 'PixelLab Standard (pixflux) costuma ser rápido. Não feche esta página.'}
            </p>
            <p className="muted small">Ao terminar, escolha a variante no modal de revisão.</p>
          </div>
        </div>
      )}
    </section>
  )
}
