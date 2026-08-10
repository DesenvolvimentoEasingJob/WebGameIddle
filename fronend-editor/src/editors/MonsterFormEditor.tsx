import { useEffect, useMemo, useState } from 'react'
import {
  BASE_STAT_SUGGESTIONS,
  MONSTER_BEHAVIORS,
  type MonsterFormData,
  type MonsterLootForm,
} from '../lib/monsterModel'

interface MonsterFormEditorProps {
  value: MonsterFormData
  idLocked: boolean
  itemIds: string[]
  onChange: (next: MonsterFormData) => void
  onGenerateSprite?: () => void
  onAnimateIdle?: () => void
  spriteBusy?: boolean
  animateBusy?: boolean
  apiBase?: string
  /** Cache-bust query for /api/assets/monsters/... (same filename after regenerate). */
  previewBurst?: number
}

export function MonsterFormEditor({
  value,
  idLocked,
  itemIds,
  onChange,
  onGenerateSprite,
  onAnimateIdle,
  spriteBusy = false,
  animateBusy = false,
  apiBase = '',
  previewBurst = 0,
}: MonsterFormEditorProps) {
  const [statKey, setStatKey] = useState('')
  const [statValue, setStatValue] = useState('0')
  const [defKey, setDefKey] = useState('')
  const [defValue, setDefValue] = useState('0')
  const [skillDraft, setSkillDraft] = useState('')

  const previewSrc = useMemo(
    () => resolveSpritePreview(value.assets.sprite, apiBase, previewBurst),
    [value.assets.sprite, apiBase, previewBurst],
  )

  const idleFrameUrls = useMemo(() => {
    const frames = value.assets.idle?.frames ?? []
    return frames
      .map((f) => resolveSpritePreview(f, apiBase, previewBurst))
      .filter((u): u is string => !!u)
  }, [value.assets.idle?.frames, apiBase, previewBurst])

  const idleFps = value.assets.idle?.fps && value.assets.idle.fps > 0 ? value.assets.idle.fps : 6
  const [idleFrame, setIdleFrame] = useState(0)

  useEffect(() => {
    setIdleFrame(0)
  }, [idleFrameUrls.join('|')])

  useEffect(() => {
    if (idleFrameUrls.length <= 1) return
    const ms = Math.max(50, Math.round(1000 / idleFps))
    const id = window.setInterval(() => {
      setIdleFrame((i) => (i + 1) % idleFrameUrls.length)
    }, ms)
    return () => window.clearInterval(id)
  }, [idleFrameUrls, idleFps])

  const idlePreview =
    idleFrameUrls.length > 0 ? idleFrameUrls[idleFrame % idleFrameUrls.length] : null

  function patch(partial: Partial<MonsterFormData>) {
    onChange({ ...value, ...partial })
  }

  function patchAssets(partial: Partial<MonsterFormData['assets']>) {
    onChange({ ...value, assets: { ...value.assets, ...partial } })
  }

  function addBaseStat() {
    const key = statKey.trim()
    if (!key) return
    const num = Number(statValue)
    if (!Number.isFinite(num)) return
    patch({ baseStats: { ...value.baseStats, [key]: num } })
    setStatKey('')
    setStatValue('0')
  }

  function removeBaseStat(key: string) {
    const next = { ...value.baseStats }
    delete next[key]
    patch({ baseStats: next })
  }

  function addBonusDef() {
    const key = defKey.trim()
    if (!key) return
    const num = Number(defValue)
    if (!Number.isFinite(num)) return
    patch({ bonusDefense: { ...value.bonusDefense, [key]: num } })
    setDefKey('')
    setDefValue('0')
  }

  function removeBonusDef(key: string) {
    const next = { ...value.bonusDefense }
    delete next[key]
    patch({ bonusDefense: next })
  }

  function addSkill() {
    const s = skillDraft.trim()
    if (!s) return
    patch({ skills: [...value.skills, s] })
    setSkillDraft('')
  }

  function updateLoot(index: number, partial: Partial<MonsterLootForm>) {
    patch({
      loot: value.loot.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    })
  }

  function addLoot() {
    patch({
      loot: [
        ...value.loot,
        { itemId: itemIds[0] ?? 'scrap', chance: 0.1, qtyMin: 1, qtyMax: 1 },
      ],
    })
  }

  function removeLoot(index: number) {
    patch({ loot: value.loot.filter((_, i) => i !== index) })
  }

  return (
    <div className="item-form">
      <div className="item-form__grid">
        <label className="field">
          <span className="field__label">id</span>
          <input
            type="text"
            value={value.id}
            disabled={idLocked}
            placeholder="ex.: cave-slime"
            onChange={(e) => patch({ id: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">nome</span>
          <input
            type="text"
            value={value.name}
            placeholder="Nome do monstro"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>

        <label className="field item-form__full">
          <span className="field__label">descrição</span>
          <textarea
            rows={3}
            value={value.description}
            placeholder="Aparência e flavor — salva no JSON e enriquece Gerar sprite / Animar"
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>

        <label className="field item-form__full">
          <span className="field__label">complemento generativo (opcional)</span>
          <textarea
            rows={2}
            value={value.generativeComplement}
            placeholder="Extras só deste mob — acrescenta ao complemento global (Config)"
            onChange={(e) => patch({ generativeComplement: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">level</span>
          <input
            type="number"
            min={1}
            value={value.level}
            onChange={(e) => patch({ level: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field__label">hp</span>
          <input
            type="number"
            min={1}
            value={value.hp}
            onChange={(e) => patch({ hp: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field__label">behavior</span>
          <select value={value.behavior} onChange={(e) => patch({ behavior: e.target.value })}>
            {MONSTER_BEHAVIORS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            {!MONSTER_BEHAVIORS.includes(value.behavior as (typeof MONSTER_BEHAVIORS)[number]) &&
            value.behavior ? (
              <option value={value.behavior}>{value.behavior} (custom)</option>
            ) : null}
          </select>
        </label>

        <label className="field">
          <span className="field__label">rarityLuck</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={value.rarityLuck}
            onChange={(e) => patch({ rarityLuck: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field__label">skyCoinDrop min</span>
          <input
            type="number"
            min={0}
            value={value.skyCoinDropMin}
            onChange={(e) => patch({ skyCoinDropMin: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field__label">skyCoinDrop max</span>
          <input
            type="number"
            min={0}
            value={value.skyCoinDropMax}
            onChange={(e) => patch({ skyCoinDropMax: Number(e.target.value) })}
          />
        </label>
      </div>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>baseStats</h3>
          <p className="muted small">Combate: dmgBase / defBase (e opcionais).</p>
        </header>
        <ul className="item-stats">
          {Object.entries(value.baseStats).map(([key, num]) => (
            <li key={key} className="item-stats__row">
              <code>{key}</code>
              <input
                type="number"
                className="jse-value--num"
                value={num}
                onChange={(e) =>
                  patch({ baseStats: { ...value.baseStats, [key]: Number(e.target.value) } })
                }
              />
              <button type="button" className="jse-remove" onClick={() => removeBaseStat(key)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="item-stats__add">
          <input
            type="text"
            list="monster-stat-suggestions"
            placeholder="chave (ex.: dmgBase)"
            value={statKey}
            onChange={(e) => setStatKey(e.target.value)}
          />
          <datalist id="monster-stat-suggestions">
            {BASE_STAT_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input type="number" value={statValue} onChange={(e) => setStatValue(e.target.value)} />
          <button type="button" className="btn" onClick={addBaseStat}>
            + Stat
          </button>
        </div>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>bonusDefense</h3>
          <p className="muted small">Resistências nomeadas (ex.: fireResistance).</p>
        </header>
        <ul className="item-stats">
          {Object.entries(value.bonusDefense).map(([key, num]) => (
            <li key={key} className="item-stats__row">
              <code>{key}</code>
              <input
                type="number"
                value={num}
                onChange={(e) =>
                  patch({
                    bonusDefense: { ...value.bonusDefense, [key]: Number(e.target.value) },
                  })
                }
              />
              <button type="button" className="jse-remove" onClick={() => removeBonusDef(key)}>
                ×
              </button>
            </li>
          ))}
          {Object.keys(value.bonusDefense).length === 0 && (
            <li className="muted small">Nenhuma resistência.</li>
          )}
        </ul>
        <div className="item-stats__add">
          <input
            type="text"
            placeholder="ex.: fireResistance"
            value={defKey}
            onChange={(e) => setDefKey(e.target.value)}
          />
          <input type="number" value={defValue} onChange={(e) => setDefValue(e.target.value)} />
          <button type="button" className="btn" onClick={addBonusDef}>
            + Resistência
          </button>
        </div>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>skills</h3>
        </header>
        <ul className="item-stats">
          {value.skills.map((s, i) => (
            <li key={`${s}-${i}`} className="item-stats__row">
              <code>{s}</code>
              <button
                type="button"
                className="jse-remove"
                onClick={() => patch({ skills: value.skills.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </li>
          ))}
          {value.skills.length === 0 && <li className="muted small">Nenhuma skill.</li>}
        </ul>
        <div className="item-stats__add">
          <input
            type="text"
            placeholder="skill id"
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
          />
          <button type="button" className="btn" onClick={addSkill}>
            + Skill
          </button>
        </div>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>loot</h3>
          <p className="muted small">Tabela de drop — itemIds de content/items.</p>
        </header>
        <ul className="item-stats">
          {value.loot.map((row, i) => (
            <li key={i} className="item-stats__row monster-loot-row">
              <input
                type="text"
                list="monster-item-ids"
                placeholder="itemId"
                value={row.itemId}
                onChange={(e) => updateLoot(i, { itemId: e.target.value })}
              />
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                title="chance"
                value={row.chance}
                onChange={(e) => updateLoot(i, { chance: Number(e.target.value) })}
              />
              <input
                type="number"
                min={1}
                title="qty min"
                value={row.qtyMin}
                onChange={(e) => updateLoot(i, { qtyMin: Number(e.target.value) })}
              />
              <input
                type="number"
                min={1}
                title="qty max"
                value={row.qtyMax}
                onChange={(e) => updateLoot(i, { qtyMax: Number(e.target.value) })}
              />
              <button type="button" className="jse-remove" onClick={() => removeLoot(i)}>
                ×
              </button>
            </li>
          ))}
          {value.loot.length === 0 && <li className="muted small">Sem loot.</li>}
        </ul>
        <datalist id="monster-item-ids">
          {itemIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        <button type="button" className="btn" onClick={addLoot}>
          + Loot
        </button>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>Sprite</h3>
          <p className="muted small">
            assets.sprite — PixelLab Standard (pixflux) ou Pro (generate-image-v2).
          </p>
        </header>
        <div className="item-icon-row">
          <label className="field item-icon-row__path">
            <span className="field__label">assets.sprite</span>
            <input
              type="text"
              value={value.assets.sprite}
              onChange={(e) => patchAssets({ sprite: e.target.value })}
            />
          </label>
          {onGenerateSprite && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onGenerateSprite}
              disabled={spriteBusy || animateBusy || !value.id.trim()}
              title={!value.id.trim() ? 'Defina o id antes' : undefined}
            >
              {spriteBusy ? 'Gerando…' : 'Gerar sprite'}
            </button>
          )}
          <div className="item-icon-preview">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                width={value.assets.width || 56}
                height={value.assets.height || 56}
                style={{
                  width: value.assets.width || 56,
                  height: value.assets.height || 56,
                  objectFit: 'contain',
                  imageRendering: 'pixelated',
                }}
              />
            ) : (
              <span className="muted small">sem preview</span>
            )}
          </div>
        </div>
        <div className="item-form__grid">
          <label className="field">
            <span className="field__label">assets.width (apresentação)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={value.assets.width}
              onChange={(e) =>
                patchAssets({ width: Math.max(1, Math.round(Number(e.target.value) || 1)) })
              }
            />
          </label>
          <label className="field">
            <span className="field__label">assets.height (apresentação)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={value.assets.height}
              onChange={(e) =>
                patchAssets({ height: Math.max(1, Math.round(Number(e.target.value) || 1)) })
              }
            />
          </label>
        </div>
        <p className="muted small">
          Tamanho no combat footer (px). Mobs normais: 56×56; chefes de andar: tipicamente 112×112.
        </p>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>Animação idle (combat)</h3>
          <p className="muted small">
            Usa o sprite estático como referência → PixelLab Standard (
            <code>animate-with-text</code>) ou Pro (<code>animate-with-text-v2</code>), direção
            east. Para o combat footer.
          </p>
        </header>
        <div className="item-icon-row">
          {onAnimateIdle && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onAnimateIdle}
              disabled={animateBusy || spriteBusy || !value.id.trim()}
              title={
                !value.id.trim()
                  ? 'Defina o id antes'
                  : 'Requer PNG em data/assets/monsters/{id}.png'
              }
            >
              {animateBusy ? 'Animando…' : 'Animar'}
            </button>
          )}
          <div className="item-icon-preview item-icon-preview--idle">
            {idlePreview ? (
              <img
                src={idlePreview}
                alt=""
                width={64}
                height={64}
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
            ) : (
              <span className="muted small">sem idle</span>
            )}
          </div>
          {value.assets.idle && value.assets.idle.frames.length > 0 ? (
            <p className="muted small">
              {value.assets.idle.frameCount || value.assets.idle.frames.length} frames ·{' '}
              {value.assets.idle.fps} fps · {value.assets.idle.direction}
            </p>
          ) : (
            <p className="muted small">Gere o sprite primeiro, depois clique em Animar.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export function resolveSpritePreview(
  sprite: string,
  apiBase: string,
  cacheBust = 0,
): string | null {
  const path = sprite.trim()
  if (!path) return null

  let url: string
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    if (!cacheBust || path.startsWith('data:')) return path
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}v=${cacheBust}`
  }
  if (path.startsWith('/api/')) {
    url = `${apiBase.replace(/\/$/, '')}${path}`
  } else {
    // Content convention /assets/monsters/{id}.png → API serve
    const m = path.match(/^\/assets\/monsters\/([^/]+\.png)$/i)
    if (m) {
      url = `${apiBase.replace(/\/$/, '')}/api/assets/monsters/${m[1]}`
    } else {
      url = path
    }
  }

  if (!cacheBust) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${cacheBust}`
}
