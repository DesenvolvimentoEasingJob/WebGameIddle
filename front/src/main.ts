import "bootstrap/dist/css/bootstrap.min.css";

import "./style.css";

import loginBg from "../assets/backgrounds/login-bg.png";
import gameBg from "../assets/backgrounds/prohibited-bg.png";

import gameTitle from "../assets/branding/game-title.png";

import { installAtlasCSSVars } from "./ui/atlas";

import { getScreen, onScreenChange, isLoggedIn, navigate, restoreLoggedInNavigation } from "./router";

import { renderHome } from "./views/home";

import { renderLogin } from "./views/login";

import { renderRegister } from "./views/register";

import { renderSlots } from "./views/slots";

import { renderCreateRace } from "./views/create-race";

import { renderCreateClass } from "./views/create-class";
import { renderGameHub } from "./views/game-hub";

function applyBrandingAssets(): void {
  document.documentElement.style.setProperty("--login-bg", `url("${loginBg}")`);
  document.documentElement.style.setProperty("--game-bg", `url("${gameBg}")`);



  const titleImg = document.querySelector<HTMLImageElement>(".game-title-img");

  if (titleImg) {

    titleImg.src = gameTitle;

    titleImg.removeAttribute("width");

    titleImg.removeAttribute("height");

  }

}



function applyScreenBackground(): void {
  document.getElementById("app")?.classList.toggle("app-bg--game", getScreen() === "game");
}

function renderScreen(): void {

  const root = document.getElementById("screen-root");

  if (!root) return;

  applyScreenBackground();

  switch (getScreen()) {

    case "login":

      renderLogin(root);

      break;

    case "register":

      renderRegister(root);

      break;

    case "slots":

      renderSlots(root);

      break;

    case "create-race":

      renderCreateRace(root);

      break;

    case "create-class":

      renderCreateClass(root);

      break;

    case "game":

      renderGameHub(root);

      break;

    default:

      renderHome(root);

      break;

  }

}



async function bootstrap(): Promise<void> {

  applyBrandingAssets();

  await installAtlasCSSVars();



  onScreenChange(renderScreen);

  if (isLoggedIn()) {
    navigate(restoreLoggedInNavigation());
  } else {
    renderScreen();
  }

}



void bootstrap();

