import { useCallback, useEffect, useState } from 'react'
import { getContent, putContent } from '../api/contentFs'
import {
  BALANCE_FIELDS,
  emptyGlobalConfig,
  globalConfigToJson,
  parseGlobalConfig,
  validateGlobalConfig,
  type GlobalBalanceForm,
  type GlobalConfigForm,
} from '../lib/configModel'

export function ConfigEditor() {
  const [form, setForm] = useState<GlobalConfigForm | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const loaded = await getContent<Record<string, unknown>>('config', 'global')
      setForm(parseGlobalConfig(loaded))
    } catch {
      setForm(emptyGlobalConfig())
      setNotice('global.json ausente — template carregado. Salve para criar o arquivo.')
      setDirty(true)
    }
  }, [])

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao carregar config/global.json')
    })
  }, [refresh])

  function patch(partial: Partial<GlobalConfigForm>) {
    if (!form) return
    setForm({ ...form, ...partial })
    setDirty(true)
    setNotice(null)
  }

  function patchBalance(key: keyof GlobalBalanceForm, value: number) {
    if (!form) return
    setForm({ ...form, balance: { ...form.balance, [key]: value } })
    setDirty(true)
    setNotice(null)
  }

  async function save() {
    if (!form) return
    const validation = validateGlobalConfig(form)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body = globalConfigToJson(form)
      await putContent('config', 'global', body as { id: string })
      setForm(parseGlobalConfig(body))
      setDirty(false)
      setNotice('Salvo em content/config/global.json — a API lê o arquivo sem rebuild.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="editor-layout editor-layout--single">
      <div className="editor-main">
        <header className="editor-toolbar">
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem' }}>Config global</h1>
            <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
              <code>content/config/global.json</code> — generative + balance. Secrets ficam no{' '}
              <code>.env</code>.
            </p>
          </div>
          <div className="editor-toolbar__actions">
            <button type="button" className="btn btn--primary" onClick={save} disabled={busy || !form}>
              Salvar
            </button>
          </div>
          {dirty && <span className="badge badge--warn">não salvo</span>}
        </header>

        {error && <p className="error">{error}</p>}
        {notice && !error && <p className="notice">{notice}</p>}

        {!form ? (
          <p className="muted">Carregando…</p>
        ) : (
          <div className="editor-body item-form">
            <section className="item-form__section" style={{ borderTop: 'none', paddingTop: 0 }}>
              <header className="item-form__section-head">
                <h3>Generative</h3>
                <p className="muted small">
                  Complementos globais injetados nos prompts de arte (PixelLab / Gemini), junto com a
                  description de cada entidade.
                </p>
              </header>
              <label className="field">
                <span className="field__label">monsterImageComplement</span>
                <textarea
                  rows={3}
                  value={form.monsterImageComplement}
                  onChange={(e) => patch({ monsterImageComplement: e.target.value })}
                  placeholder="pixel art, facing left…"
                />
              </label>
              <label className="field">
                <span className="field__label">floorImageComplement</span>
                <textarea
                  rows={4}
                  value={form.floorImageComplement}
                  onChange={(e) => patch({ floorImageComplement: e.target.value })}
                  placeholder="pixel art, ultrawide 21:9 combat arena, ground at bottom…"
                />
                <span className="field__hint">
                  Padrão da arena de combate (21:9, chão embaixo, side view). Andares podem acrescentar
                  extras em generativeComplement.
                </span>
              </label>
            </section>

            <section className="item-form__section">
              <header className="item-form__section-head">
                <h3>Balance</h3>
                <p className="muted small">
                  Multiplicadores do jogo. Env ainda pode sobrescrever se a variável estiver setada.
                </p>
              </header>
              <div className="item-form__grid">
                {BALANCE_FIELDS.map((f) => (
                  <label key={f.key} className="field">
                    <span className="field__label">{f.label}</span>
                    <input
                      type="number"
                      step={f.step ?? '1'}
                      value={form.balance[f.key]}
                      onChange={(e) => patchBalance(f.key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
