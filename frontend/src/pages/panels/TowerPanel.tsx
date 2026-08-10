import { useState } from 'react'
import { ConfirmModal } from '../../components/game/ConfirmModal'
import { MonsterEncounterPanel } from '../../components/game/MonsterEncounterPanel'
import { useGameSession } from '../../game/GameSessionContext'

const BOSS_ROOM = 10
const FARM_ROOMS = Array.from({ length: BOSS_ROOM - 1 }, (_, i) => i + 1)

type PendingConfirm =
  | {
      kind: 'boss'
      title: string
      body: string
      feeLabel: string
      confirmLabel: string
    }
  | {
      kind: 'registry'
      title: string
      body: string
      feeLabel: string
      confirmLabel: string
    }

export function TowerPanel() {
  const {
    state,
    floors,
    skyCoin,
    busy,
    playing,
    enter,
    toggleAuto,
    moveToRoom,
    battle,
    challenge,
    registerFloor,
    skipAnimation,
    ownership,
  } = useGameSession()

  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const maxFloor = state?.maxUnlockedFloor ?? 1
  const gateReady = (state?.maxUnlockedRoom ?? 1) >= BOSS_ROOM
  const atBossRoom = state?.room === BOSS_ROOM
  const gateFee = state?.bossGateFee ?? 0
  const registryFee = state?.floorRegistryFee ?? 0
  const attrMult = state?.registryAttrMult ?? 10
  const floorCleared = state ? maxFloor > state.floor : false
  const unlockedFloors = floors.length
    ? floors.filter((f) => f.number <= maxFloor)
    : Array.from({ length: maxFloor }, (_, i) => ({ number: i + 1, name: `Andar ${i + 1}` }))

  function openChallengeConfirm() {
    setPending({
      kind: 'boss',
      title: floorCleared ? 'Reenfrentar o chefe' : 'Enfrentar o chefe',
      body: floorCleared
        ? 'Derrota perde o XP deste nível. Vitória não libera andares novos — você já passou daqui.'
        : 'Derrota perde o XP deste nível. Vitória libera o próximo andar.',
      feeLabel: `Custo: ${gateFee} SkyCoin`,
      confirmLabel: 'Pagar e enfrentar',
    })
  }

  function openRegistryConfirm() {
    const target = ownership?.owned
      ? `o clone de ${ownership.ownerUsername ?? 'quem domina o andar'}`
      : `o chefe com atributos ×${attrMult}`
    setPending({
      kind: 'registry',
      title: ownership?.owned ? 'Desafiar o dono' : 'Registrar o andar',
      body:
        `Exige derrotar ${target}. É bem mais difícil que o chefe normal e a derrota perde o XP deste nível.`,
      feeLabel: `Custo: ${registryFee} SkyCoin`,
      confirmLabel: ownership?.owned ? 'Pagar e desafiar' : 'Pagar e registrar',
    })
  }

  function acceptPending() {
    if (!pending) return
    const kind = pending.kind
    setPending(null)
    if (kind === 'boss') void challenge()
    else void registerFloor()
  }

  return (
    <section className="game-panel">
      <h1>Torre</h1>
      {!state?.inTower ? (
        <div className="tower__enter">
          <p className="hub__lead">Entre em um andar liberado para começar a subida.</p>
          <div className="tower__floors" role="list">
            {unlockedFloors.map((floor) => (
              <button
                key={floor.number}
                type="button"
                role="listitem"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void enter(floor.number)}
              >
                {floor.number} — {floor.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="tower-panel__layout">
          <div className="tower-panel__controls">
            <div className="hub__meta hub__meta--compact">
              <div>
                <strong>{state.floorName ?? `Andar ${state.floor}`}</strong> · Sala{' '}
                {atBossRoom ? 'Chefe' : `${state.room}/9`}
              </div>
              <div>
                {state.characterName} · Nv. {state.level}
                {skyCoin != null ? ` · ${skyCoin} SC` : ''}
              </div>
              <div>
                Dono:{' '}
                {ownership?.owned ? ownership.ownerUsername ?? 'alguém' : 'livre'}
              </div>
            </div>

            <h2 className="game-panel__subtitle game-panel__subtitle--sm">Andares</h2>
            <div className="tower__floors tower__floors--compact" role="list">
              {unlockedFloors.map((floor) => {
                const current = floor.number === state.floor
                return (
                  <button
                    key={floor.number}
                    type="button"
                    role="listitem"
                    className={`tower__room${current ? ' tower__room--current' : ''}`}
                    disabled={busy || playing || current}
                    onClick={() => void enter(floor.number)}
                    title={floor.name}
                  >
                    {floor.number}
                  </button>
                )
              })}
            </div>

            <h2 className="game-panel__subtitle game-panel__subtitle--sm">Salas</h2>
            <div className="tower__rooms tower__rooms--compact" role="list">
              {FARM_ROOMS.map((room) => {
                const unlocked = room <= state.maxUnlockedRoom
                const current = room === state.room
                return (
                  <button
                    key={room}
                    type="button"
                    role="listitem"
                    className={`tower__room${current ? ' tower__room--current' : ''}${unlocked ? '' : ' tower__room--locked'}`}
                    disabled={!unlocked || busy || playing}
                    onClick={() => void moveToRoom(room)}
                  >
                    {room}
                  </button>
                )
              })}
              <button
                type="button"
                role="listitem"
                className={`tower__room tower__room--boss${atBossRoom ? ' tower__room--current' : ''}${gateReady ? '' : ' tower__room--locked'}`}
                disabled={!gateReady || busy || playing}
                onClick={() => void moveToRoom(BOSS_ROOM)}
                title={
                  gateReady
                    ? 'Sala do chefe — use o botão Chefe para pagar e enfrentar'
                    : 'Vença as salas 1–9 deste andar para liberar o chefe'
                }
              >
                Boss
              </button>
            </div>

            <div className="create__actions create__actions--compact">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={busy || playing || atBossRoom}
                onClick={() => void battle()}
              >
                {atBossRoom ? 'Sala 1–9' : 'Enfrentar'}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={busy || playing || !gateReady}
                onClick={openChallengeConfirm}
                title={
                  !gateReady
                    ? 'Vença as salas 1–9 deste andar para liberar o chefe'
                    : floorCleared
                      ? `Custa ${gateFee} SkyCoin — pode reenfrentar o chefe`
                      : `Custa ${gateFee} SkyCoin e libera o próximo andar`
                }
              >
                Chefe ({gateFee})
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy || playing || !gateReady}
                onClick={openRegistryConfirm}
                title={`Chefe ×${attrMult} ou clone do dono — custa ${registryFee} SkyCoin`}
              >
                {ownership?.owned ? 'Dono' : 'Registrar'} ({registryFee})
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void toggleAuto()}>
                Auto: {state.autoClimb ? 'ON' : 'OFF'}
              </button>
              {playing ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={skipAnimation}>
                  Pular
                </button>
              ) : null}
            </div>
          </div>

          <MonsterEncounterPanel />
        </div>
      )}

      {pending ? (
        <ConfirmModal
          title={pending.title}
          body={pending.body}
          feeLabel={pending.feeLabel}
          confirmLabel={pending.confirmLabel}
          onCancel={() => setPending(null)}
          onConfirm={acceptPending}
        />
      ) : null}
    </section>
  )
}
