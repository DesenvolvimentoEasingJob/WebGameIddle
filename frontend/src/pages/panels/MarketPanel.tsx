import { useEffect, useState } from 'react'
import { buyListing, cancelListing, fetchMarket, listOnMarket, type MarketListingRow } from '../../api/market'
import { fetchInventory } from '../../api/inventory'
import { ApiError } from '../../api/client'
import { useGameSession } from '../../game/GameSessionContext'
import { bagItemLabel, type BagItem } from '../../types/item'

export function MarketPanel() {
  const { refresh } = useGameSession()
  const [listings, setListings] = useState<MarketListingRow[]>([])
  const [bagItems, setBagItems] = useState<BagItem[]>([])
  const [bagIndex, setBagIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [m, inv] = await Promise.all([fetchMarket(), fetchInventory()])
      setListings(m)
      setBagItems(inv.items ?? [])
      if ((inv.items?.length ?? 0) > 0) {
        setBagIndex((current) => (current < inv.items.length ? current : 0))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selected = bagItems[bagIndex]

  async function onList() {
    setBusy(true)
    setError(null)
    try {
      await listOnMarket(bagIndex, qty, price)
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao anunciar')
    } finally {
      setBusy(false)
    }
  }

  async function onBuy(listingId: string) {
    setBusy(true)
    setError(null)
    try {
      await buyListing(listingId, 1)
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha na compra')
    } finally {
      setBusy(false)
    }
  }

  async function onCancel(listingId: string) {
    setBusy(true)
    try {
      await cancelListing(listingId)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao cancelar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="game-panel">
      <h1>Mercado</h1>
      <p className="hub__lead">Anúncio gratuito. Transferência do snapshot completo do item.</p>
      {error ? <p className="form-error">{error}</p> : null}

      <h2 className="game-panel__subtitle">Anunciar da bag</h2>
      <div className="create__actions">
        <select
          value={bagIndex}
          onChange={(e) => setBagIndex(Number(e.target.value))}
          aria-label="Item da bag"
        >
          {bagItems.length === 0 ? <option value={0}>Bag vazia</option> : null}
          {bagItems.map((it, i) => (
            <option key={it.instanceId ?? `${i}`} value={i}>
              [{i}] {bagItemLabel(it)}
              {it.qty > 1 ? ` ×${it.qty}` : ''}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={selected?.qty ?? 1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-label="Quantidade"
          disabled={selected?.stackable !== true}
        />
        <input
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          aria-label="Preço cada"
        />
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || bagItems.length === 0}
          onClick={() => void onList()}
        >
          Anunciar
        </button>
      </div>

      <h2 className="game-panel__subtitle">Listagens</h2>
      <ul className="market-list">
        {listings.map((row) => (
          <li key={row.id}>
            <strong>
              {row.item ? bagItemLabel(row.item) : row.itemId}
            </strong>{' '}
            · {row.quantity} un. · {row.priceEach} SkyCoin
            <div className="create__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void onBuy(row.id)}
              >
                Comprar 1
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => void onCancel(row.id)}
              >
                Cancelar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
