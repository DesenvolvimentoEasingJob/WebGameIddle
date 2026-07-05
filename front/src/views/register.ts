import { register, formatApiError } from "../api/auth";

import { navigate, saveSession } from "../router";



const MIN_PASSWORD_LENGTH = 8;



export function renderRegister(root: HTMLElement): void {

  root.innerHTML = `

    <section class="ui-panel mx-auto" aria-label="Criar conta">

      <div class="ui-divider" role="presentation"></div>

      <form id="register-form" class="auth-form px-2 px-sm-4 py-3" novalidate>

        <div class="auth-field">

          <label class="auth-label" for="register-email">E-mail</label>

          <input

            id="register-email"

            name="email"

            type="email"

            class="auth-input"

            autocomplete="email"

            required

            maxlength="256"

          />

        </div>

        <div class="auth-field">

          <label class="auth-label" for="register-username">Usuário</label>

          <input

            id="register-username"

            name="username"

            type="text"

            class="auth-input"

            autocomplete="username"

            required

            minlength="3"

            maxlength="32"

            pattern="[A-Za-z0-9_]+"

            title="Letras, números e underscore"

          />

          <span class="auth-hint">3–32 caracteres: letras, números e _</span>

        </div>

        <div class="auth-field">

          <label class="auth-label" for="register-password">Senha</label>

          <input

            id="register-password"

            name="password"

            type="password"

            class="auth-input"

            autocomplete="new-password"

            required

            minlength="${MIN_PASSWORD_LENGTH}"

            maxlength="128"

          />

          <span class="auth-hint">Mínimo de ${MIN_PASSWORD_LENGTH} caracteres</span>

        </div>

        <div class="auth-field">

          <label class="auth-label" for="register-confirm">Confirmar senha</label>

          <input

            id="register-confirm"

            name="confirmPassword"

            type="password"

            class="auth-input"

            autocomplete="new-password"

            required

            minlength="${MIN_PASSWORD_LENGTH}"

            maxlength="128"

          />

        </div>

        <p id="register-error" class="auth-error" role="alert" hidden></p>

        <div class="d-grid gap-3 mt-2">

          <button id="register-submit" type="submit" class="ui-btn">Criar Conta</button>

          <button id="register-back" type="button" class="ui-btn ui-btn--ghost">Voltar</button>

        </div>

      </form>

      <div class="ui-divider ui-divider--flip" role="presentation"></div>

    </section>

  `;



  const form = root.querySelector<HTMLFormElement>("#register-form")!;

  const errorEl = root.querySelector<HTMLParagraphElement>("#register-error")!;

  const submitBtn = root.querySelector<HTMLButtonElement>("#register-submit")!;



  root.querySelector<HTMLButtonElement>("#register-back")!.addEventListener("click", () => {

    navigate("home");

  });



  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    errorEl.hidden = true;

    errorEl.textContent = "";

    errorEl.classList.remove("auth-success");



    const data = new FormData(form);

    const email = String(data.get("email") ?? "").trim();

    const username = String(data.get("username") ?? "").trim();

    const password = String(data.get("password") ?? "");

    const confirmPassword = String(data.get("confirmPassword") ?? "");



    if (username.length < 3) {

      errorEl.textContent = "O usuário deve ter no mínimo 3 caracteres.";

      errorEl.hidden = false;

      return;

    }



    if (!/^[a-zA-Z0-9_]+$/.test(username)) {

      errorEl.textContent = "Use apenas letras, números e underscore no usuário.";

      errorEl.hidden = false;

      return;

    }



    if (password.length < MIN_PASSWORD_LENGTH) {

      errorEl.textContent = `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;

      errorEl.hidden = false;

      return;

    }



    if (password !== confirmPassword) {

      errorEl.textContent = "As senhas não coincidem.";

      errorEl.hidden = false;

      return;

    }



    submitBtn.disabled = true;



    try {

      const result = await register({ email, username, password, confirmPassword });

      saveSession(result.token, result.user);

      navigate("slots");

    } catch (err) {

      errorEl.textContent = formatApiError(err, "Não foi possível criar a conta. Tente novamente.");

      errorEl.hidden = false;

    } finally {

      submitBtn.disabled = false;

    }

  });

}

