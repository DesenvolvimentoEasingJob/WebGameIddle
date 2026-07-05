import { navigate, isLoggedIn } from "../router";

export function renderHome(root: HTMLElement): void {
  const loggedIn = isLoggedIn();

  root.innerHTML = `
    <section class="ui-panel mx-auto" aria-label="Acesso ao jogo">
      <div class="ui-divider" role="presentation"></div>
      <div class="d-grid gap-3 px-2 px-sm-4 py-3">
        ${
          loggedIn
            ? `<button id="btn-continue" type="button" class="ui-btn">Continuar</button>`
            : `<button id="btn-login" type="button" class="ui-btn">Login</button>
               <button id="btn-create" type="button" class="ui-btn">Criar Conta</button>`
        }
      </div>
      <div class="ui-divider ui-divider--flip" role="presentation"></div>
    </section>
  `;

  if (loggedIn) {
    root.querySelector<HTMLButtonElement>("#btn-continue")!.addEventListener("click", () => {
      navigate("slots");
    });
    return;
  }

  root.querySelector<HTMLButtonElement>("#btn-login")!.addEventListener("click", () => {
    navigate("login");
  });

  root.querySelector<HTMLButtonElement>("#btn-create")!.addEventListener("click", () => {
    navigate("register");
  });
}
