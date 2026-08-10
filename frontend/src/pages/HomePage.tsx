import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <main className="landing">
      <div className="landing__atmosphere" aria-hidden />
      <div className="landing__spire" aria-hidden />
      <div className="landing__content">
        <h1 className="landing__brand">SkySpire End</h1>
        <p className="landing__headline">Suba a torre. Deixe seu nome nos andares.</p>
        <p className="landing__support">
          Combate por eventos, progresso infinito e um mercado entre jogadores — tudo
          resolvido no servidor, animado na tela.
        </p>
        <div className="landing__ctas">
          <Link className="btn btn--primary" to="/login">
            Entrar
          </Link>
          <Link className="btn btn--ghost" to="/register">
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  )
}
