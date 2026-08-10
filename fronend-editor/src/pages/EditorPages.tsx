import { AttributesEditor } from '../editors/AttributesEditor'
import { ConfigEditor } from '../editors/ConfigEditor'
import { FloorsEditor } from '../editors/FloorsEditor'
import { ItemsEditor } from '../editors/ItemsEditor'
import { MonstersEditor } from '../editors/MonstersEditor'

export function HomePage() {
  return (
    <section className="editor-panel">
      <header className="editor-panel__header">
        <h1>SkySpire Content Editor</h1>
        <p className="muted">
          Ferramenta <strong>somente para desenvolvedores</strong>. Grava JSON direto em{' '}
          <code>content/</code> no monorepo. Não publique esta app.
        </p>
      </header>
      <ul className="home-links">
        <li>
          <strong>Monstros</strong> — formulário UX + rascunho IA + sprite PixelLab ·{' '}
          <code>content/monsters/</code>
        </li>
        <li>
          <strong>Itens</strong> — formulário UX + rascunho IA + ícone PixelLab ·{' '}
          <code>content/items/</code>
        </li>
        <li>
          <strong>Atributos</strong> — fórmulas + card Gemini · <code>content/attributes/core.json</code>
        </li>
        <li>
          <strong>Andares</strong> — salas + rascunho IA + background Gemini ·{' '}
          <code>content/floors/</code>
        </li>
        <li>
          <strong>Config</strong> — generative + balance · <code>content/config/global.json</code>
        </li>
      </ul>
      <p className="muted">
        Em cada editor: selecione um arquivo para alterar propriedades, ou use <strong>+ Novo</strong> /{' '}
        <strong>Duplicar</strong>. Após salvar, a API do jogo lê o arquivo novo sem rebuild.
      </p>
    </section>
  )
}

export function MonstersPage() {
  return <MonstersEditor />
}

export function ItemsPage() {
  return <ItemsEditor />
}

export function AttributesPage() {
  return <AttributesEditor />
}

export function FloorsPage() {
  return <FloorsEditor />
}

export function ConfigPage() {
  return <ConfigEditor />
}
