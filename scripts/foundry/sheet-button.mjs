/**
 * Entry points on the dnd5e item sheet (C1): an icon in the window title bar (same technique as dnd5e's own
 * toggles) and an entry in the "⋮" header controls menu. GM only, eligible items only.
 */
import { MODULE_ID } from "../constants.mjs";
import { isEligible } from "../core/classify.mjs";

export const OPEN_CLASS = `${MODULE_ID}-open`;
const ICON = "fa-hammer";

/** @returns {boolean} */
export function canShowButton(item, user) {
  return Boolean(item && user?.isGM && isEligible(item));
}

async function openDialog(item) {
  const { RecipeDialog } = await import("./recipe-dialog.mjs");
  return RecipeDialog.open(item);
}

/** Create the title bar icon before the sheet's own copy-UUID / close controls. */
function createHeaderIcon(element, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("header-control", "icon", "fa-solid", ICON, OPEN_CLASS);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  const header = element.querySelector(".window-header");
  const sibling = header?.querySelector('[data-action="copyUuid"], [data-action="close"]');
  if (sibling) sibling.before(button);
  else header?.append(button);
  return button;
}

/**
 * Hook `renderItemSheet5e` (also fired for the container sheet). The icon is created once and removed when the
 * item stops being eligible.
 * @param {ItemSheet5e} app
 * @param {HTMLElement} element
 */
export function onRenderItemSheet(app, element) {
  const item = app.item ?? app.document;
  const root = element instanceof HTMLElement ? element : app.element;
  if (!root) return;
  let button = root.querySelector(`.${OPEN_CLASS}`);
  if (!canShowButton(item, game.user)) {
    button?.remove();
    return;
  }
  button ??= createHeaderIcon(root, () => openDialog(item));
  const label = game.i18n.localize(`${MODULE_ID}.Button.Open`);
  button.dataset.tooltip = label;
  button.dataset.tooltipDirection = "DOWN";
  button.setAttribute("aria-label", label);
}

/**
 * Hook `getHeaderControlsItemSheet5e`: entry of the "⋮" menu, evaluated each time the menu opens.
 * @param {ItemSheet5e} app
 * @param {ApplicationHeaderControlsEntry[]} controls
 */
export function onGetHeaderControls(app, controls) {
  const item = app.item ?? app.document;
  if (!canShowButton(item, game.user)) return;
  controls.push({
    action: OPEN_CLASS,
    icon: `fa-solid ${ICON}`,
    label: `${MODULE_ID}.Button.Open`,
    onClick: () => openDialog(item)
  });
}
