/**
 * Feature 3 - Spotlight fairness log, GM only.
 *
 * Counts how many times each combatant received the Spotlight in the current combat and how many
 * Spotlight changes ago they last had it, and shows it in the combat tracker for player characters.
 * A character is highlighted when it trails the most-spotlighted character by at least the
 * `spotlightGapThreshold` setting (default 2).
 *
 * Detection: Daggerheart gives the Spotlight with `combat.update({turn, round: round + 1})`
 * (DhCombatTracker#setCombatantSpotlight). Core turn fix-ups after adding/removing combatants are
 * local (updateSource) and never change the round, so "round changed + new holder" is a Spotlight event.
 * Data lives in flags on the Combat: kept across reloads, gone when the combat is deleted.
 */

import { MODULE_ID } from "./daggerheart-combat-tracker-companion.js";

const FLAG = "spotlight";
const BADGE_CLASS = "dhctc-spotlight";

export class SpotlightLog {
  /** Serializes flag writes so rapid Spotlight changes never overwrite each other. */
  static #queue = Promise.resolve();

  static registerHooks() {
    Hooks.on("updateCombat", (combat, changed) => this.#onUpdateCombat(combat, changed));
    Hooks.on("renderCombatTracker", (app, element) => this.#onRenderTracker(app, element));
  }

  /* -------------------------------------------- */
  /*  Recording                                   */
  /* -------------------------------------------- */

  /**
   * `updateCombat` fires on every client: only the active GM writes the flags.
   * @param {Combat} combat
   * @param {object} changed
   */
  static #onUpdateCombat(combat, changed) {
    if (!("round" in changed) || !game.users.activeGM?.isSelf) return;
    const holderId = combat.combatant?.id ?? null; // Captured now: the queue may run later
    this.#queue = this.#queue
      .then(() => this.#record(combat, holderId))
      .catch(err => console.error(`${MODULE_ID} | Failed to record Spotlight`, err));
  }

  /**
   * @param {Combat} combat
   * @param {string|null} holderId   Combatant holding the Spotlight after the update, null if nobody
   */
  static async #record(combat, holderId) {
    if (!game.combats.has(combat.id)) return;
    const data = this.#getData(combat);
    if (holderId === data.current) return; // Not a Spotlight change

    data.current = holderId;
    if (holderId) {
      data.seq += 1;
      const entry = (data.combatants[holderId] ??= { count: 0, lastSeq: 0 });
      entry.count += 1;
      entry.lastSeq = data.seq;
    }
    await combat.setFlag(MODULE_ID, FLAG, data);
  }

  /**
   * @param {Combat} combat
   * @returns {{seq: number, current: string|null, combatants: Record<string, {count: number, lastSeq: number}>}}
   */
  static #getData(combat) {
    const data = foundry.utils.deepClone(combat.getFlag(MODULE_ID, FLAG) ?? {});
    return { seq: data.seq ?? 0, current: data.current ?? null, combatants: data.combatants ?? {} };
  }

  /* -------------------------------------------- */
  /*  Display                                     */
  /* -------------------------------------------- */

  /**
   * @param {foundry.applications.sidebar.tabs.CombatTracker} app
   * @param {HTMLElement} element
   */
  static #onRenderTracker(app, element) {
    if (!game.user.isGM) return;
    if (!ui.combat || !(app instanceof ui.combat.constructor)) return;

    const combat = app.viewed;
    if (!combat?.started) return;

    const data = this.#getData(combat);
    const characters = combat.combatants.filter(c => !c.isNPC);
    const counts = characters.map(c => data.combatants[c.id]?.count ?? 0);
    const max = Math.max(...counts);
    const threshold = game.settings.get(MODULE_ID, "spotlightGapThreshold");

    for (const combatant of characters) {
      try {
        const li = element.querySelector(`li.combatant[data-combatant-id="${combatant.id}"]`);
        if (!li) continue;
        li.querySelector(`.${BADGE_CLASS}`)?.remove();

        const entry = data.combatants[combatant.id];
        const count = entry?.count ?? 0;
        const neglected = (max - count) >= threshold;
        const badge = this.#buildBadge(li.ownerDocument, count, this.#tooltip(data, combatant.id, entry, neglected));
        badge.classList.toggle("dhctc-neglected", neglected);

        // Join the resource row if present, otherwise sit under the name on its own
        const row = li.querySelector(".dhctc-resources");
        if (row) row.append(badge);
        else li.querySelector(".token-name .name")?.after(badge);
      } catch (err) {
        console.warn(`${MODULE_ID} | Could not render Spotlight badge for a combatant`, err);
      }
    }
  }

  /**
   * @param {Document} doc
   * @param {number} count
   * @param {string} tooltip
   * @returns {HTMLElement}
   */
  static #buildBadge(doc, count, tooltip) {
    const badge = doc.createElement("span");
    badge.className = BADGE_CLASS;
    badge.dataset.tooltip = tooltip;
    badge.setAttribute("aria-label", tooltip);
    const icon = doc.createElement("i");
    icon.className = "fa-solid fa-hand";
    icon.inert = true;
    badge.append(icon, ` ${count}`);
    return badge;
  }

  static #tooltip(data, combatantId, entry, neglected) {
    let text;
    if (!entry) text = game.i18n.localize("DHCTC.Spotlight.Never");
    else if (data.current === combatantId) text = game.i18n.format("DHCTC.Spotlight.Current", { count: entry.count });
    else text = game.i18n.format("DHCTC.Spotlight.Ago", { count: entry.count, ago: data.seq - entry.lastSeq });
    if (neglected) text += ` · ${game.i18n.localize("DHCTC.Spotlight.Neglected")}`;
    return text;
  }
}
