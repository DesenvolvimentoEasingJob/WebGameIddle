import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteContent, listContent, putContent } from '../api/contentFs'
import {
  draftFloor,
  generateFloorBackground,
  getApiBase,
  type FloorDraftPackage,
} from '../api/editorApi'
import { JsonNodeEditor } from '../components/JsonNodeEditor'
import type { ENode, JsonValue } from '../lib/jsonModel'
import { toJson, toNode } from '../lib/jsonModel'
import {
  emptyFloorForm,
  FLOOR_ID_PATTERN,
  floorFormToJson,
  floorNumberFromId,
  parseFloorForm,
  syncNumberFromId,
  validateFloorForm,
  type FloorFormData,
} from '../lib/floorModel'
import { FloorFormEditor, type MonsterOption } from './FloorFormEditor'

type EntityRecord = Record<string, JsonValue> & { id?: string; number?: number; name?: string }

function describe(entity: EntityRecord): string {
  const parts: string[] = []
  if (typeof entity.name === 'string' && entity.name) parts.push(entity.name)
  if (typeof entity.number === 'number') parts.push(`#${entity.number}`)
  if (typeof entity.theme === 'string' && entity.theme) parts.push(entity.theme)
  return parts.join(' · ')
}

function nextFloorNumber(floors: EntityRecord[]): number {
  const used = new Set<number>()
  for (const f of floors) {
    if (typeof f.number === 'number') used.add(f.number)
    else if (typeof f.id === 'string') {
      const n = floorNumberFromId(f.id)
      if (n != null) used.add(n)
    }
  }
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n
  }
  return 99
}

export function FloorsEditor() {
  const [entities, setEntities] = useState<EntityRecord[]>([])
  const [monsterOptions, setMonsterOptions] = useState<MonsterOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<FloorFormData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiFloorNumber, setAiFloorNumber] = useState(1)
  const [aiBusy, setAiBusy] = useState(false)
  const [draftPackage, setDraftPackage] = useState<FloorDraftPackage | null>(null)
  const [applyBusy, setApplyBusy] = useState(false)
  const [bgBusy, setBgBusy] = useState(false)
  /** Cache-bust query for /api/assets/floors/... (same filename after regenerate). */
  const [previewBurst, setPreviewBurst] = useState(() => Date.now())
  const apiBase = getApiBase()

  const refreshFloors = useCallback(async () => {
    const list = await listContent<EntityRecord>('floors')
    setEntities(list)
    return list
  }, [])

  const refreshMonsters = useCallback(async () => {
    const list = await listContent<EntityRecord>('monsters')
    const opts: MonsterOption[] = list
      .filter((m): m is EntityRecord & { id: string } => typeof m.id === 'string')
      .map((m) => ({
        id: m.id,
        name: typeof m.name === 'string' ? m.name : '',
      }))
    setMonsterOptions(opts)
    return opts
  }, [])

  useEffect(() => {
    Promise.all([refreshFloors(), refreshMonsters()]).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar conteúdo')
    })
  }, [refreshFloors, refreshMonsters])

  const monsterIdSet = useMemo(
    () => new Set(monsterOptions.map((m) => m.id)),
    [monsterOptions],
  )

  const otherFloorNumbers = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of entities) {
      if (typeof f.id !== 'string') continue
      const n =
        typeof f.number === 'number' ? f.number : (floorNumberFromId(f.id) ?? undefined)
      if (n != null) map.set(f.id, n)
    }
    return map
  }, [entities])

  const rawNode: ENode | null = useMemo(() => {
    if (!form) return null
    const id = form.id.trim() || selectedId || ''
    return toNode(floorFormToJson(form, id) as unknown as JsonValue)
  }, [form, selectedId])

  const jsonPreview = useMemo(() => {
    if (!rawNode) return ''
    const result = toJson(rawNode)
    return result.ok ? JSON.stringify(result.value, null, 2) : `// ${result.error}`
  }, [rawNode])

  function confirmDiscard(): boolean {
    if (!dirty && !draftPackage) return true
    return window.confirm('Há alterações não salvas. Descartar?')
  }

  function loadEntity(entity: EntityRecord) {
    if (!confirmDiscard()) return
    const parsed = parseFloorForm(entity)
    setSelectedId(typeof entity.id === 'string' ? entity.id : null)
    setForm(parsed)
    setDirty(false)
    setIsNew(false)
    setError(null)
    setNotice(null)
    setDraftPackage(null)
    setPreviewBurst(Date.now())
  }

  function startNew() {
    if (!confirmDiscard()) return
    const n = nextFloorNumber(entities)
    setSelectedId(null)
    setForm(emptyFloorForm(n))
    setDirty(true)
    setIsNew(true)
    setError(null)
    setNotice('Novo andar. Defina salas/chefe e salve, ou use Criar com IA.')
    setDraftPackage(null)
    setAiFloorNumber(n)
  }

  function duplicateCurrent() {
    if (!form) return
    const n = nextFloorNumber(entities)
    const id = `floor-${String(n).padStart(2, '0')}`
    setForm({
      ...form,
      id,
      number: n,
      ownerPlayerId: null,
      ownerSnapshotPath: null,
      assets: { background: `/api/assets/floors/${id}.png` },
    })
    setSelectedId(null)
    setIsNew(true)
    setDirty(true)
    setError(null)
    setNotice('Cópia carregada. Ajuste e salve como novo arquivo.')
    setDraftPackage(null)
  }

  function applyFormChange(next: FloorFormData) {
    setForm(next)
    setDirty(true)
    setNotice(null)
  }

  async function save() {
    if (!form) return
    let working = syncNumberFromId(form)
    const id = working.id.trim()
    if (!FLOOR_ID_PATTERN.test(id)) {
      setError('Id inválido. Use floor-01 … floor-99.')
      return
    }
    const fromId = floorNumberFromId(id)!
    working = { ...working, number: fromId }

    const validation = validateFloorForm(working, {
      otherFloorNumbers,
      monsterIds: monsterIdSet,
    })
    if (validation) {
      setError(validation)
      return
    }

    const body = floorFormToJson(working, id)
    const renamedFrom = selectedId && selectedId !== id ? selectedId : null

    setBusy(true)
    setError(null)
    try {
      await putContent('floors', id, body)
      await refreshFloors()
      setSelectedId(id)
      setForm(parseFloorForm(body))
      setDirty(false)
      setIsNew(false)
      setNotice(
        renamedFrom
          ? `Salvo em content/floors/${id}.json — o arquivo ${renamedFrom}.json continua no disco.`
          : `Salvo em content/floors/${id}.json`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!selectedId) return
    if (!window.confirm(`Excluir content/floors/${selectedId}.json?`)) return

    setBusy(true)
    setError(null)
    try {
      await deleteContent('floors', selectedId)
      await refreshFloors()
      setSelectedId(null)
      setForm(null)
      setDirty(false)
      setNotice('Arquivo excluído.')
      setDraftPackage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setBusy(false)
    }
  }

  async function runAiDraft() {
    const description = aiPrompt.trim()
    if (!description) {
      setError('Descreva a visão do andar para a IA.')
      return
    }
    setAiBusy(true)
    setError(null)
    try {
      const pack = await draftFloor({
        description,
        floorNumber: aiFloorNumber,
        itemLevel: aiFloorNumber,
      })
      if (!confirmDiscard()) return
      setDraftPackage(pack)
      setForm(parseFloorForm(pack.floor))
      setSelectedId(null)
      setIsNew(true)
      setDirty(true)
      setAiOpen(false)
      setAiPrompt('')
      setNotice(
        `Pacote IA: ${pack.items.length} itens, ${pack.monsters.length} monstros + andar. Revise e use Aplicar pacote.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no draft IA')
    } finally {
      setAiBusy(false)
    }
  }

  async function runGenerateBackground() {
    if (!form) return
    const id = form.id.trim()
    if (!FLOOR_ID_PATTERN.test(id)) {
      setError('Defina um id floor-NN válido antes de gerar o background.')
      return
    }
    if (!form.description.trim()) {
      setError('Preencha a descrição visual do andar antes de gerar o background.')
      return
    }
    setBgBusy(true)
    setError(null)
    // Bust before request so the old cached frame is dropped while generating.
    setPreviewBurst(Date.now())
    try {
      const result = await generateFloorBackground({
        id,
        name: form.name,
        description: form.description,
        theme: form.theme,
        generativeComplement: form.generativeComplement,
      })
      setForm({ ...form, assets: { background: result.backgroundPath } })
      setDirty(true)
      setPreviewBurst(Date.now())
      setNotice(
        result.source === 'fallback'
          ? `Background fallback (${result.reason ?? 'sem API'}). ${result.detail ?? ''} Path: ${result.backgroundPath}`
          : `Background Gemini gerado: ${result.backgroundPath} — salve para gravar o path.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar background')
    } finally {
      setBgBusy(false)
    }
  }

  async function applyPackage() {
    if (!draftPackage || !form) return

    const floorId = form.id.trim()
    if (!FLOOR_ID_PATTERN.test(floorId)) {
      setError('Id do andar inválido antes de aplicar o pacote.')
      return
    }

    const itemIds = new Set(draftPackage.items.map((i) => String(i.id ?? '')))
    const monsterIdsFromPack = new Set(draftPackage.monsters.map((m) => String(m.id ?? '')))
    const combinedMonsters = new Set([...monsterIdSet, ...monsterIdsFromPack])

    const working = syncNumberFromId({ ...form, number: floorNumberFromId(floorId) ?? form.number })
    const validation = validateFloorForm(working, {
      otherFloorNumbers,
      monsterIds: combinedMonsters,
      allowMissingMonsters: false,
    })
    if (validation) {
      setError(validation)
      return
    }

    // Warn on collisions
    const existingItems = await listContent<EntityRecord>('items')
    const existingItemIds = new Set(
      existingItems.map((i) => i.id).filter((id): id is string => typeof id === 'string'),
    )
    const collisions: string[] = []
    for (const id of itemIds) {
      if (id && existingItemIds.has(id)) collisions.push(`item:${id}`)
    }
    for (const id of monsterIdsFromPack) {
      if (id && monsterIdSet.has(id)) collisions.push(`monster:${id}`)
    }
    if (otherFloorNumbers.has(floorId)) {
      collisions.push(`floor:${floorId}`)
    }
    if (collisions.length > 0) {
      const ok = window.confirm(
        `Ids já existem e serão sobrescritos:\n${collisions.join('\n')}\n\nContinuar?`,
      )
      if (!ok) return
    }

    setApplyBusy(true)
    setError(null)
    const written: string[] = []
    try {
      for (const item of draftPackage.items) {
        const id = String(item.id ?? '').trim()
        if (!id) throw new Error('Item do pacote sem id.')
        await putContent('items', id, { ...item, id })
        written.push(`items/${id}`)
      }
      for (const monster of draftPackage.monsters) {
        const id = String(monster.id ?? '').trim()
        if (!id) throw new Error('Monstro do pacote sem id.')
        await putContent('monsters', id, { ...monster, id })
        written.push(`monsters/${id}`)
      }
      const body = floorFormToJson(working, floorId)
      await putContent('floors', floorId, body)
      written.push(`floors/${floorId}`)

      await Promise.all([refreshFloors(), refreshMonsters()])
      setSelectedId(floorId)
      setForm(parseFloorForm(body))
      setDirty(false)
      setIsNew(false)
      setDraftPackage(null)
      setNotice(`Pacote aplicado (${written.length} arquivos).`)
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : 'Falha ao aplicar'} — já gravados: ${
          written.length ? written.join(', ') : '(nenhum)'
        }`,
      )
    } finally {
      setApplyBusy(false)
    }
  }

  function onRawChange(next: ENode) {
    const serialized = toJson(next)
    if (!serialized.ok) {
      setError(serialized.error)
      return
    }
    setForm(parseFloorForm(serialized.value))
    setDirty(true)
    setNotice(null)
  }

  function openAiModal() {
    setAiFloorNumber(form ? form.number : nextFloorNumber(entities))
    setAiOpen(true)
  }

  return (
    <section className="editor-layout">
      <aside className="entity-sidebar">
        <div className="entity-sidebar__head">
          <h2>Andares</h2>
          <div className="entity-sidebar__actions">
            <button type="button" className="btn" onClick={openAiModal}>
              IA
            </button>
            <button type="button" className="btn btn--primary" onClick={startNew}>
              + Novo
            </button>
          </div>
        </div>
        <p className="muted small">
          {entities.length} andares · <code>content/floors/</code>
        </p>
        <ul className="entity-list">
          {entities.map((entity) => {
            const id = typeof entity.id === 'string' ? entity.id : '(sem id)'
            return (
              <li key={id}>
                <button
                  type="button"
                  className={id === selectedId ? 'entity-item is-active' : 'entity-item'}
                  onClick={() => loadEntity(entity)}
                >
                  <span className="entity-item__id">{id}</span>
                  <span className="entity-item__meta">{describe(entity)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="editor-main">
        {!form ? (
          <div className="editor-empty">
            <h1>Andares</h1>
            <p className="muted">
              Selecione um andar, clique em <strong>+ Novo</strong> ou use <strong>IA</strong> para
              rascunhar tema, monstros e itens a partir do seu prompt.
            </p>
          </div>
        ) : (
          <>
            <header className="editor-toolbar">
              <div className="editor-toolbar__actions">
                <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                  Salvar
                </button>
                {draftPackage && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={applyPackage}
                    disabled={applyBusy || busy}
                  >
                    {applyBusy ? 'Aplicando…' : 'Aplicar pacote'}
                  </button>
                )}
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
                <button type="button" className="btn" onClick={openAiModal}>
                  Criar com IA
                </button>
              </div>
              {dirty && <span className="badge badge--warn">não salvo</span>}
              {isNew && <span className="badge">novo arquivo</span>}
              {draftPackage && <span className="badge">pacote IA</span>}
            </header>

            {error && <p className="error">{error}</p>}
            {notice && !error && <p className="notice">{notice}</p>}

            {draftPackage && (
              <aside className="floor-draft-review">
                <h3>Revisão do pacote IA</h3>
                <p className="muted small">
                  Itens e monstros ainda não estão no disco. <strong>Aplicar pacote</strong> grava
                  items → monsters → floor. Você pode ajustar o andar no formulário antes.
                </p>
                <details open>
                  <summary>Itens ({draftPackage.items.length})</summary>
                  <ul>
                    {draftPackage.items.map((item) => (
                      <li key={String(item.id)}>
                        <code>{String(item.id)}</code>
                        {typeof item.name === 'string' ? ` — ${item.name}` : ''}
                        {typeof item.type === 'string' ? ` · ${item.type}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
                <details open>
                  <summary>Monstros ({draftPackage.monsters.length})</summary>
                  <ul>
                    {draftPackage.monsters.map((m) => (
                      <li key={String(m.id)}>
                        <code>{String(m.id)}</code>
                        {typeof m.name === 'string' ? ` — ${m.name}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </aside>
            )}

            <div className="editor-body">
              {showRaw && rawNode ? (
                <JsonNodeEditor node={rawNode} onChange={onRawChange} suggestions={{}} depth={0} />
              ) : (
                <FloorFormEditor
                  value={form}
                  idLocked={!isNew && !!selectedId}
                  monsterOptions={
                    draftPackage
                      ? [
                          ...monsterOptions,
                          ...draftPackage.monsters
                            .filter((m): m is Record<string, unknown> & { id: string } =>
                              typeof m.id === 'string',
                            )
                            .map((m) => ({
                              id: m.id,
                              name: typeof m.name === 'string' ? m.name : '',
                            }))
                            .filter((m) => !monsterIdSet.has(m.id)),
                        ]
                      : monsterOptions
                  }
                  onChange={applyFormChange}
                  onGenerateBackground={runGenerateBackground}
                  backgroundBusy={bgBusy}
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
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !aiBusy && setAiOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="ai-floor-draft-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-floor-draft-title">Criar andar com IA</h2>
            <p className="muted small">
              Descreva como você imagina o andar. A IA aprimora o tema e gera rascunhos de monstros e
              itens (JSON) — você revisa e aplica.
            </p>
            <label className="field">
              <span className="field__label">número do andar</span>
              <input
                type="number"
                min={1}
                max={99}
                value={aiFloorNumber}
                disabled={aiBusy}
                onChange={(e) => setAiFloorNumber(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field__label">prompt / visão</span>
              <textarea
                rows={6}
                value={aiPrompt}
                placeholder="Ex.: cripta úmida com musgo luminoso, ratos e slimes, chefe senhor das criptas; drops de ossos e tecido úmido"
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
    </section>
  )
}
