import { useEffect, useState } from 'react'
import { useGameSession } from '../../game/GameSessionContext'
import { resolveMonsterSpriteUrl } from '../../game/monsterAssets'
import type { EncounterMonster } from '../../types/api'

export function MonsterEncounterPanel() {
  const { state, enemies, playing, focusedEnemySlot } = useGameSession()
  const encounter = state?.roomEncounter
  const [imgFailed, setImgFailed] = useState(false)

  const monsters = encounter?.monsters ?? []
  const focusSlot =
    playing && focusedEnemySlot != null
      ? focusedEnemySlot
      : playing
        ? (enemies.find((e) => e.alive)?.slot ?? enemies[0]?.slot ?? 0)
        : 0
  const monster: EncounterMonster | null = monsters[focusSlot] ?? monsters[0] ?? null

  useEffect(() => {
    setImgFailed(false)
  }, [monster?.id, monster?.sprite])

  if (!state?.inTower) {
    return null
  }

  const roomTitle =
    encounter?.type === 'boss' || state.room >= 10
      ? 'Chefe'
      : encounter
        ? `Sala ${encounter.room}`
        : 'Encontro'

  const src = resolveMonsterSpriteUrl(monster?.sprite)
  const showImg = Boolean(src) && !imgFailed
  const goldMin = monster?.skyCoinDropMin
  const goldMax = monster?.skyCoinDropMax
  const hasGold =
    goldMin != null && goldMax != null && Number.isFinite(goldMin) && Number.isFinite(goldMax)
  const goldLabel =
    hasGold && goldMin === goldMax ? `${goldMin} SC` : hasGold ? `${goldMin}–${goldMax} SC` : null

  const luckRaw = monster?.rarityLuck
  const hasLuck = luckRaw != null && Number.isFinite(luckRaw)
  const luckLabel = hasLuck
    ? luckRaw > 0
      ? `Luck ${Number.isInteger(luckRaw) ? String(luckRaw) : luckRaw.toFixed(1)}`
      : 'normal'
    : null

  return (
    <aside className="encounter-panel" aria-label="Monstro enfrentado">
      {!monster ? (
        <p className="encounter-panel__empty">Escolha uma sala para ver o desafio.</p>
      ) : (
        <article className="encounter-panel__card">
          <header className="encounter-panel__titlebar">
            <h3 className="encounter-panel__name">
              <span className="encounter-panel__name-text">{monster.name}</span>
              <span className="encounter-panel__room"> — {roomTitle}</span>
            </h3>
            <span className="encounter-panel__meta">Nv. {monster.level}</span>
          </header>

          <div className="encounter-panel__art" aria-hidden>
            {showImg ? (
              <img
                className="encounter-panel__sprite"
                src={src!}
                alt=""
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="tower__sprite tower__sprite--enemy encounter-panel__sprite-fallback" />
            )}
          </div>

          {monster.description ? (
            <p className="encounter-panel__description">{monster.description}</p>
          ) : (
            <p className="encounter-panel__description encounter-panel__description--empty">
              Sem descrição.
            </p>
          )}

          <dl className="encounter-panel__stats">
            <div className="encounter-panel__stat-row">
              <dt>HP</dt>
              <dd>{monster.hp}</dd>
            </div>
            <div className="encounter-panel__stat-row">
              <dt>Dano</dt>
              <dd>{monster.dmgBase}</dd>
            </div>
            <div className="encounter-panel__stat-row">
              <dt>Defesa</dt>
              <dd>{monster.defBase}</dd>
            </div>
            {goldLabel ? (
              <div className="encounter-panel__stat-row">
                <dt>Gold</dt>
                <dd>{goldLabel}</dd>
              </div>
            ) : null}
            {luckLabel ? (
              <div className="encounter-panel__stat-row">
                <dt>Raridade</dt>
                <dd title="Enviesa o roll de raridade do gear ao matar este monstro">
                  {luckLabel}
                </dd>
              </div>
            ) : null}
          </dl>
        </article>
      )}
    </aside>
  )
}
