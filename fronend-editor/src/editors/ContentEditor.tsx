import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteContent, listContent, putContent } from '../api/contentFs'
import { JsonNodeEditor, SuggestionDataLists } from '../components/JsonNodeEditor'
import type { Suggestions } from '../components/JsonNodeEditor'
import type { ENode, JsonValue } from '../lib/jsonModel'
import { cloneNode, toJson, toNode } from '../lib/jsonModel'
import { REFERENCE_FIELDS, templateFor } from '../lib/templates'
import type { ContentFolder } from '../types/content'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type EntityRecord = Record<string, JsonValue> & { id?: string }

interface ContentEditorProps {
  folder: ContentFolder
  title: string
  label: string
}

function describe(entity: EntityRecord): string {
  const parts: string[] = []
  if (typeof entity.name === 'string' && entity.name) parts.push(entity.name)
  if (typeof entity.number === 'number') parts.push(`andar ${entity.number}`)
  if (typeof entity.level === 'number') parts.push(`nv ${entity.level}`)
  if (typeof entity.type === 'string' && entity.type) parts.push(entity.type)
  return parts.join(' · ')
}

export function ContentEditor({ folder, title, label }: ContentEditorProps) {
  const [entities, setEntities] = useState<EntityRecord[]>([])
  const [suggestions, setSuggestions] = useState<Suggestions>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [idInput, setIdInput] = useState('')
  const [node, setNode] = useState<ENode | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const refresh = useCallback(async () => {
    const list = await listContent<EntityRecord>(folder)
    setEntities(list)
    return list
  }, [folder])

  useEffect(() => {
    setSelectedId(null)
    setNode(null)
    setIdInput('')
    setDirty(false)
    setIsNew(false)
    setError(null)
    setNotice(null)

    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar conteúdo')
    })
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    const refs = REFERENCE_FIELDS[folder]

    Promise.all(
      (Object.keys(refs) as ContentFolder[]).map(async (refFolder) => {
        const list = await listContent<EntityRecord>(refFolder)
        const ids = list.map((e) => e.id).filter((id): id is string => typeof id === 'string')
        return (refs[refFolder] ?? []).map((field) => [field, ids] as const)
      }),
    )
      .then((groups) => {
        if (cancelled) return
        setSuggestions(Object.fromEntries(groups.flat()))
      })
      .catch(() => {
        /* autocomplete é opcional */
      })

    return () => {
      cancelled = true
    }
  }, [folder])

  const jsonPreview = useMemo(() => {
    if (!node) return ''
    const result = toJson(node)
    return result.ok ? JSON.stringify(result.value, null, 2) : `// ${result.error}`
  }, [node])

  function confirmDiscard(): boolean {
    if (!dirty) return true
    return window.confirm('Há alterações não salvas. Descartar?')
  }

  function loadEntity(entity: EntityRecord) {
    if (!confirmDiscard()) return
    setSelectedId(typeof entity.id === 'string' ? entity.id : null)
    setIdInput(typeof entity.id === 'string' ? entity.id : '')
    setNode(toNode(entity as JsonValue))
    setDirty(false)
    setIsNew(false)
    setError(null)
    setNotice(null)
  }

  function startNew() {
    if (!confirmDiscard()) return
    setSelectedId(null)
    setIdInput('')
    setNode(toNode(templateFor(folder)))
    setDirty(true)
    setIsNew(true)
    setError(null)
    setNotice(`Novo ${label} a partir do template. Defina o id e salve.`)
  }

  function duplicateCurrent() {
    if (!node) return
    setNode(cloneNode(node))
    setIdInput(idInput ? `${idInput}-copia` : '')
    setSelectedId(null)
    setIsNew(true)
    setDirty(true)
    setError(null)
    setNotice('Cópia carregada. Ajuste o id e salve como novo arquivo.')
  }

  async function save() {
    if (!node) return
    const id = idInput.trim()

    if (!ID_PATTERN.test(id)) {
      setError('Id inválido. Use kebab-case: letras/números minúsculos e hífen (ex.: floor-01).')
      return
    }

    const serialized = toJson(node)
    if (!serialized.ok) {
      setError(serialized.error)
      return
    }

    const body = { ...(serialized.value as EntityRecord), id }
    const renamedFrom = selectedId && selectedId !== id ? selectedId : null

    setBusy(true)
    setError(null)
    try {
      await putContent(folder, id, body)
      await refresh()
      setSelectedId(id)
      setNode(toNode(body as JsonValue))
      setDirty(false)
      setIsNew(false)
      setNotice(
        renamedFrom
          ? `Salvo em content/${folder}/${id}.json — o arquivo ${renamedFrom}.json continua no disco.`
          : `Salvo em content/${folder}/${id}.json`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!selectedId) return
    if (!window.confirm(`Excluir content/${folder}/${selectedId}.json?`)) return

    setBusy(true)
    setError(null)
    try {
      await deleteContent(folder, selectedId)
      await refresh()
      setSelectedId(null)
      setNode(null)
      setIdInput('')
      setDirty(false)
      setNotice('Arquivo excluído.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="editor-layout">
      <SuggestionDataLists suggestions={suggestions} />

      <aside className="entity-sidebar">
        <div className="entity-sidebar__head">
          <h2>{title}</h2>
          <button type="button" className="btn btn--primary" onClick={startNew}>
            + Novo
          </button>
        </div>
        <p className="muted small">
          {entities.length} {label} · <code>content/{folder}/</code>
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
        {!node ? (
          <div className="editor-empty">
            <h1>{title}</h1>
            <p className="muted">
              Selecione um {label} na lista para editar propriedades, ou clique em <strong>+ Novo</strong>{' '}
              para criar a partir do template. Use <strong>Duplicar</strong> para partir de um existente.
            </p>
          </div>
        ) : (
          <>
            <header className="editor-toolbar">
              <label className="field">
                <span className="field__label">id / arquivo</span>
                <input
                  type="text"
                  value={idInput}
                  placeholder="ex.: slime"
                  onChange={(e) => {
                    setIdInput(e.target.value)
                    setDirty(true)
                  }}
                />
              </label>
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
                  {showRaw ? 'Ocultar JSON' : 'Ver JSON'}
                </button>
              </div>
              {dirty && <span className="badge badge--warn">não salvo</span>}
              {isNew && <span className="badge">novo arquivo</span>}
            </header>

            {error && <p className="error">{error}</p>}
            {notice && !error && <p className="notice">{notice}</p>}

            <div className="editor-body">
              <JsonNodeEditor
                node={node}
                onChange={(next) => {
                  setNode(next)
                  setDirty(true)
                  setNotice(null)
                }}
                suggestions={suggestions}
                depth={0}
              />
            </div>

            {showRaw && <pre className="json-preview">{jsonPreview}</pre>}
          </>
        )}
      </div>
    </section>
  )
}
