import { login, formatApiError } from "../api/auth";

import { navigate, saveSession } from "../router";



export function renderLogin(root: HTMLElement): void {

  root.innerHTML = `

    <section class="ui-panel mx-auto" aria-label="Login">

      <div class="ui-divider" role="presentation"></div>

      <form id="login-form" class="auth-form px-2 px-sm-4 py-3" novalidate>

        <div class="auth-field">

          <label class="auth-label" for="login-input">E-mail ou usuário</label>

          <input

            id="login-input"

            name="login"

            type="text"

            class="auth-input"

            autocomplete="username"

            required

            maxlength="256"

          />

        </div>

        <div class="auth-field">

          <label class="auth-label" for="login-password">Senha</label>

          <input

            id="login-password"

            name="password"

            type="password"

            class="auth-input"

            autocomplete="current-password"

            required

            maxlength="128"

          />

        </div>

        <p id="login-error" class="auth-error" role="alert" hidden></p>

        <div class="d-grid gap-3 mt-2">

          <button id="login-submit" type="submit" class="ui-btn">Entrar</button>

          <button id="login-back" type="button" class="ui-btn ui-btn--ghost">Voltar</button>

        </div>

      </form>

      <div class="ui-divider ui-divider--flip" role="presentation"></div>

    </section>

  `;



  const form = root.querySelector<HTMLFormElement>("#login-form")!;

  const errorEl = root.querySelector<HTMLParagraphElement>("#login-error")!;

  const submitBtn = root.querySelector<HTMLButtonElement>("#login-submit")!;



  root.querySelector<HTMLButtonElement>("#login-back")!.addEventListener("click", () => {

    navigate("home");

  });



  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    errorEl.hidden = true;

    errorEl.textContent = "";



    const data = new FormData(form);

    const loginValue = String(data.get("login") ?? "").trim();

    const password = String(data.get("password") ?? "");



    if (!loginValue || !password) {

      errorEl.textContent = "Preencha e-mail/usuário e senha.";

      errorEl.hidden = false;

      return;

    }



    submitBtn.disabled = true;



    try {

      const result = await login({ login: loginValue, password });

      saveSession(result.token, result.user);

      navigate("slots");

    } catch (err) {

      errorEl.classList.remove("auth-success");

      errorEl.textContent = formatApiError(err, "Não foi possível entrar. Tente novamente.");

      errorEl.hidden = false;

    } finally {

      submitBtn.disabled = false;

    }

  });

}

