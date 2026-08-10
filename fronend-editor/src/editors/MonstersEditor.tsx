import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteContent, listContent, putContent } from '../api/contentFs'
import {
  commitMonsterIdle,
  commitMonsterSprite,
  discardPixelLabDraft,
  draftMonster,
  generateMonsterIdle,
  generateMonsterSprite,
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
  emptyMonsterForm,
  monsterFormToJson,
  parseMonsterForm,
  validateMonsterForm,
  type MonsterFormData,
} from '../lib/monsterModel'
import { MonsterFormEditor, resolveSpritePreview } from './MonsterFormEditor'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type EntityRecord = Record<string, JsonValue> & { id?: string }

function describe(entity: EntityRecord): string {
  const parts: string[] = []
  if (typeof entity.name === 'string' && entity.name) parts.push(entity.name)
  if (typeof entity.level === 'number') parts.push(`nv ${entity.level}`)
  if (typeof entity.hp === 'number') parts.push(`hp ${entity.hp}`)
  return parts.join(' · ')
}

function monsterSpritePath(entity: EntityRecord): string {
  const assets = entity.assets
  if (assets && typeof assets === 'object' && !Array.isArray(assets)) {
    const sprite = (assets as Record<string, JsonValue>).sprite
    if (typeof sprite === 'string' && sprite.trim()) return sprite.trim()
  }
  if (typeof entity.id === 'string' && entity.id) {
    return `/api/assets/monsters/${entity.id}.png`
  }
  return ''
}

function MonsterListThumb({
  sprite,
  apiBase,
  previewBurst = 0,
}: {
  sprite: string
  apiBase: string
  previewBurst?: number
}) {
  const [broken, setBroken] = useState(false)
  const src = resolveSpritePreview(sprite, apiBase, previewBurst)

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

export function MonstersEditor() {
  const [entities, setEntities] = useState<EntityRecord[]>([])
  const [itemIds, setItemIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<MonsterFormData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spriteBusy, setSpriteBusy] = useState(false)
  const [animateBusy, setAnimateBusy] = useState(false)
  const [qualityModal, setQualityModal] = useState<'sprite' | 'idle' | null>(null)
  const [activeAssetQuality, setActiveAssetQuality] = useState<PixelLabQuality>('standard')
  const [activeAssetSize, setActiveAssetSize] = useState(128)
  const [spriteReview, setSpriteReview] = useState<{
    draftId: string
    candidates: Array<{ index: number; previewPath: string }>
    alreadyCommitted?: boolean
    committedPath?: string
  } | null>(null)
  const [idleReview, setIdleReview] = useState<{
    draftId: string
    frames: string[]
    fps: number
  } | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  /** Cache-bust query for /api/assets/monsters/... (same filename after regenerate). */
  const [previewBurst, setPreviewBurst] = useState(() => Date.now())

  const apiBase = getApiBase()

  const refresh = useCallback(async () => {
    const list = await listContent<EntityRecord>('monsters')
    setEntities(list)
    return list
  }, [])

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar monstros')
    })
    listContent<EntityRecord>('items')
      .then((items) => {
        setItemIds(
          items.map((e) => e.id).filter((id): id is string => typeof id === 'string'),
        )
      })
      .catch(() => {
        /* autocomplete opcional */
      })
  }, [refresh])

  const rawNode: ENode | null = useMemo(() => {
    if (!form) return null
    const id = form.id.trim() || selectedId || ''
    return toNode(monsterFormToJson(form, id) as JsonValue)
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
    const parsed = parseMonsterForm(entity)
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
    setForm(emptyMonsterForm())
    setDirty(true)
    setIsNew(true)
    setError(null)
    setNotice('Novo monstro. Defina o id e salve, ou use Criar com IA.')
  }

  function duplicateCurrent() {
    if (!form) return
    setForm({
      ...form,
      id: form.id ? `${form.id}-copia` : '',
      assets: {
        sprite: form.assets.sprite,
        idle: form.assets.idle ? { ...form.assets.idle, frames: [...form.assets.idle.frames] } : null,
      },
    })
    setSelectedId(null)
    setIsNew(true)
    setDirty(true)
    setError(null)
    setNotice('Cópia carregada. Ajuste o id e salve como novo arquivo.')
  }

  function applyFormChange(next: MonsterFormData) {
    setForm(next)
    setDirty(true)
    setNotice(null)
  }

  async function persistForm(
    formToSave: MonsterFormData,
    opts?: { quiet?: boolean; successNotice?: string },
  ): Promise<boolean> {
    const id = formToSave.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Id inválido. Use kebab-case: letras/números minúsculos e hífen.')
      return false
    }
    const validation = validateMonsterForm(formToSave)
    if (validation) {
      setError(validation)
      return false
    }

    const body = monsterFormToJson(formToSave, id)
    const renamedFrom = selectedId && selectedId !== id ? selectedId : null

    setBusy(true)
    setError(null)
    try {
      await putContent('monsters', id, body)
      await refresh()
      setSelectedId(id)
      setForm(parseMonsterForm(body))
      setDirty(false)
      setIsNew(false)
      if (!opts?.quiet) {
        setNotice(
          opts?.successNotice ??
            (renamedFrom
              ? `Salvo em content/monsters/${id}.json — o arquivo ${renamedFrom}.json continua no disco.`
              : `Salvo em content/monsters/${id}.json`),
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
    if (!window.confirm(`Excluir content/monsters/${selectedId}.json?`)) return

    setBusy(true)
    setError(null)
    try {
      await deleteContent('monsters', selectedId)
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
      setError('Descreva o monstro para a IA.')
      return
    }
    setAiBusy(true)
    setError(null)
    try {
      const draft = await draftMonster(description)
      if (!confirmDiscard()) return
      setForm(parseMonsterForm(draft))
      setSelectedId(null)
      setIsNew(true)
      setDirty(true)
      setAiOpen(false)
      setAiPrompt('')
      setNotice('Rascunho da IA carregado. Revise, gere o sprite e salve.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no draft IA')
    } finally {
      setAiBusy(false)
    }
  }

  function requestGenerateSprite() {
    if (!form) return
    const id = form.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Defina um id kebab-case válido antes de gerar o sprite.')
      return
    }
    setError(null)
    setQualityModal('sprite')
  }

  function requestAnimateIdle() {
    if (!form) return
    const id = form.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Defina um id kebab-case válido antes de animar.')
      return
    }
    setError(null)
    setQualityModal('idle')
  }

  async function runGenerateSprite(options: PixelLabGenerateOptions) {
    if (!form) return
    const id = form.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Defina um id kebab-case válido antes de gerar o sprite.')
      return
    }
    setQualityModal(null)
    setActiveAssetQuality(options.quality)
    setActiveAssetSize(options.size)
    setSpriteBusy(true)
    setError(null)
    setNotice(null)
    setPreviewBurst(Date.now())
    try {
      const result = await generateMonsterSprite({
        id,
        name: form.name,
        description: form.description || form.name,
        behavior: form.behavior,
        generativeComplement: form.generativeComplement,
        quality: options.quality,
        size: options.size,
      })
      if (!result.candidates?.length) {
        setError('Geração não retornou imagens.')
        if (result.draftId) await discardPixelLabDraft(result.draftId).catch(() => undefined)
        return
      }
      setSpriteReview({
        draftId: result.draftId,
        candidates: result.candidates,
        alreadyCommitted: result.alreadyCommitted,
        committedPath: result.committedPath,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar sprite')
      setNotice(null)
    } finally {
      setSpriteBusy(false)
    }
  }

  async function commitSpriteSelection(index: number) {
    if (!form || !spriteReview) return
    const id = form.id.trim()
    const draftId = spriteReview.draftId
    const legacy = spriteReview.alreadyCommitted
    setSpriteReview(null)
    setSpriteBusy(true)
    setError(null)
    try {
      let contentPath = `/assets/monsters/${id}.png`
      if (legacy || !draftId) {
        // Final PNG already on disk (legacy API); keep content path convention.
        contentPath = `/assets/monsters/${id}.png`
      } else {
        await commitMonsterSprite({ id, draftId, index })
      }

      const nextForm: MonsterFormData = {
        ...form,
        assets: { ...form.assets, sprite: contentPath },
      }
      setForm(nextForm)
      setDirty(true)
      setPreviewBurst(Date.now())

      const generatedLabel = `Sprite escolhido: ${contentPath}`
      const saved = await persistForm(nextForm, {
        successNotice: `${generatedLabel}. Salvo automaticamente em content/monsters/${id}.json`,
      })
      if (!saved) {
        setNotice(`${generatedLabel}. Não foi possível salvar — clique em Salvar.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar sprite')
      if (draftId) await discardPixelLabDraft(draftId).catch(() => undefined)
    } finally {
      setSpriteBusy(false)
    }
  }

  async function cancelSpriteReview() {
    if (!spriteReview) return
    const draftId = spriteReview.draftId
    const legacy = spriteReview.alreadyCommitted
    setSpriteReview(null)
    if (draftId && !legacy) {
      await discardPixelLabDraft(draftId).catch(() => undefined)
      setNotice('Geração descartada — sprite final não foi alterado.')
    } else {
      setNotice('Revisão fechada. Se a API antiga já gravou o PNG, ele permanece no disco.')
    }
  }

  async function runAnimateIdle(options: PixelLabGenerateOptions) {
    if (!form) return
    const id = form.id.trim()
    if (!ID_PATTERN.test(id)) {
      setError('Defina um id kebab-case válido antes de animar.')
      return
    }
    setQualityModal(null)
    setActiveAssetQuality(options.quality)
    setActiveAssetSize(options.size)
    setAnimateBusy(true)
    setError(null)
    setNotice(null)
    setPreviewBurst(Date.now())
    try {
      const result = await generateMonsterIdle({
        id,
        name: form.name,
        description: form.description || form.name,
        quality: options.quality,
        size: options.size,
      })
      if (!result.frames?.length) {
        setError('Animação não retornou frames.')
        if (result.draftId) await discardPixelLabDraft(result.draftId).catch(() => undefined)
        return
      }
      setIdleReview({
        draftId: result.draftId,
        frames: result.frames,
        fps: result.fps,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao animar')
      setNotice(null)
    } finally {
      setAnimateBusy(false)
    }
  }

  async function commitIdleApproval() {
    if (!form || !idleReview) return
    const id = form.id.trim()
    const draftId = idleReview.draftId
    setIdleReview(null)
    setAnimateBusy(true)
    setError(null)
    try {
      const result = await commitMonsterIdle({ id, draftId })
      const nextForm: MonsterFormData = {
        ...form,
        assets: {
          ...form.assets,
          idle: {
            frames: result.idle.frames,
            frameWidth: result.idle.frameWidth,
            frameHeight: result.idle.frameHeight,
            frameCount: result.idle.frameCount,
            fps: result.idle.fps,
            direction: result.idle.direction,
          },
        },
      }
      setForm(nextForm)
      setDirty(true)
      setPreviewBurst(Date.now())

      const generatedLabel = `Idle aprovado: ${result.idle.frameCount} frames · ${result.idle.direction}`
      const saved = await persistForm(nextForm, {
        successNotice: `${generatedLabel}. Salvo automaticamente em content/monsters/${id}.json`,
      })
      if (!saved) {
        setNotice(`${generatedLabel}. Não foi possível salvar — clique em Salvar.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar idle')
      await discardPixelLabDraft(draftId).catch(() => undefined)
    } finally {
      setAnimateBusy(false)
    }
  }

  async function cancelIdleReview() {
    if (!idleReview) return
    const draftId = idleReview.draftId
    setIdleReview(null)
    await discardPixelLabDraft(draftId).catch(() => undefined)
    setNotice('Animação descartada — idle atual não foi alterado.')
  }

  function onRawChange(next: ENode) {
    const serialized = toJson(next)
    if (!serialized.ok) {
      setError(serialized.error)
      return
    }
    setForm(parseMonsterForm(serialized.value))
    setDirty(true)
    setNotice(null)
  }

  return (
    <section className="editor-layout">
      <aside className="entity-sidebar">
        <div className="entity-sidebar__head">
          <h2>Monstros</h2>
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
          {entities.length} monstros · <code>content/monsters/</code>
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
                  <MonsterListThumb
                    sprite={monsterSpritePath(entity)}
                    apiBase={apiBase}
                    previewBurst={previewBurst}
                  />
                  <span className="entity-item__body">
                    <span className="entity-item__id">{id}</span>
                    <span className="entity-item__meta">{describe(entity)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="editor-main">
        {!form ? (
          <div className="editor-empty">
            <h1>Monstros</h1>
            <p className="muted">
              Selecione um monstro, clique em <strong>+ Novo</strong> ou use <strong>IA</strong> para
              rascunhar. Depois gere o sprite com PixelLab.
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
                <MonsterFormEditor
                  value={form}
                  idLocked={!isNew && !!selectedId}
                  itemIds={itemIds}
                  onChange={applyFormChange}
                  onGenerateSprite={requestGenerateSprite}
                  onAnimateIdle={requestAnimateIdle}
                  spriteBusy={spriteBusy}
                  animateBusy={animateBusy}
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
            aria-labelledby="ai-monster-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-monster-title">Criar monstro com IA</h2>
            <p className="muted small">
              Descreva o monstro em português. A API monta um rascunho JSON — você revisa, gera o
              sprite e salva.
            </p>
            <label className="field">
              <span className="field__label">descrição</span>
              <textarea
                rows={5}
                value={aiPrompt}
                placeholder="Ex.: slime verde viscoso de caverna, nível 1, dropa scrap"
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

      {qualityModal && (
        <PixelLabQualityModal
          title={qualityModal === 'idle' ? 'Animar idle' : 'Gerar sprite'}
          kind={qualityModal === 'idle' ? 'idle' : 'sprite'}
          onCancel={() => setQualityModal(null)}
          onConfirm={(options) => {
            if (qualityModal === 'idle') void runAnimateIdle(options)
            else void runGenerateSprite(options)
          }}
        />
      )}

      {spriteReview && (
        <PixelLabReviewModal
          mode="pick"
          title="Escolher sprite"
          candidates={spriteReview.candidates}
          onCancel={() => void cancelSpriteReview()}
          onConfirm={(index) => void commitSpriteSelection(index)}
        />
      )}

      {idleReview && (
        <PixelLabReviewModal
          mode="approve"
          title="Aprovar animação idle"
          frames={idleReview.frames}
          fps={idleReview.fps}
          onCancel={() => void cancelIdleReview()}
          onConfirm={() => void commitIdleApproval()}
        />
      )}

      {(spriteBusy || animateBusy) && (
        <div className="modal-backdrop modal-backdrop--busy" role="presentation">
          <div
            className="modal modal--busy"
            role="alertdialog"
            aria-busy="true"
            aria-labelledby="asset-busy-title"
            aria-describedby="asset-busy-desc"
          >
            <div className="busy-spinner" aria-hidden />
            <h2 id="asset-busy-title">
              {animateBusy
                ? activeAssetQuality === 'pro'
                  ? `Animando idle ${activeAssetSize}×${activeAssetSize} (Pro)…`
                  : `Animando idle ${activeAssetSize}×${activeAssetSize}…`
                : activeAssetQuality === 'pro'
                  ? `Gerando sprite ${activeAssetSize}×${activeAssetSize} (Pro)…`
                  : `Gerando sprite ${activeAssetSize}×${activeAssetSize}…`}
            </h2>
            <p id="asset-busy-desc" className="muted small">
              {activeAssetQuality === 'pro'
                ? animateBusy
                  ? 'PixelLab Pro pode levar 1–3 minutos e custa ~10× créditos. Não feche esta página.'
                  : 'PixelLab Pro pode levar mais tempo e custa ~10× créditos. Não feche esta página.'
                : animateBusy
                  ? 'PixelLab Standard (animate-with-text) costuma ser mais rápido. Não feche esta página.'
                  : 'PixelLab Standard (pixflux) costuma ser rápido. Não feche esta página.'}
            </p>
            <p className="muted small">Ao terminar, revise o resultado no modal.</p>
          </div>
        </div>
      )}
    </section>
  )
}
