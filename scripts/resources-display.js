/**
 * Feature 2 - Inline resources (HP, Stress, Evasion/Difficulty) in the combat tracker, GM only.
 *
 * Injected on every render of the combat tracker. No dedicated updateActor hook is needed:
 * core TokenDocument#_onRelatedUpdate already re-renders ui.combat when a combatant's actor
 * (or its items/effects) changes, which also covers derived values like character Evasion.
 */

const ROW_CLASS = "dhctc-resources";

export class ResourcesDisplay {
  static registerHooks() {
    Hooks.on("renderCombatTracker", (app, element) => this.#onRenderTracker(app, element));
  }

  /* -------------------------------------------- */

  /**
   * @param {foundry.applications.sidebar.tabs.CombatTracker} app
   * @param {HTMLElement} element
   */
  static #onRenderTracker(app, element) {
    if (!game.user.isGM) return;

    // Sidebar tab and its pop-out share the class of ui.combat; other trackers are left alone
    if (!ui.combat || !(app instanceof ui.combat.constructor)) return;

    const combat = app.viewed;
    if (!combat) return;

    for (const li of element.querySelectorAll("li.combatant[data-combatant-id]")) {
      try {
        li.querySelector(`.${ROW_CLASS}`)?.remove();
        const combatant = combat.combatants.get(li.dataset.combatantId);
        const row = this.#buildRow(combatant?.actor, li.ownerDocument);
        if (row) li.querySelector(".token-name .name")?.after(row);
      } catch (err) {
        // A broken combatant (e.g. a token without a valid actor) must never break the tracker
        console.warn("daggerheart-combat-tracker-companion | Could not render resources for a combatant", err);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Build the resource row for an actor, showing only the values that actor type has:
   * character: HP, Stress, Evasion · adversary: HP, Stress, Difficulty
   * companion: Stress, Evasion · npc: Difficulty (if set) · others: nothing.
   * @param {Actor|undefined} actor
   * @param {Document} doc    The document owning the tracker (differs from `document` in a detached window)
   * @returns {HTMLElement|null}
   */
  static #buildRow(actor, doc) {
    const system = actor?.system;
    if (!system) return null;

    const items = [];
    const { hitPoints, stress } = system.resources ?? {};
    if (hitPoints) items.push(this.#pool("dhctc-hp", "DHCTC.Tooltip.HP", hitPoints));
    if (stress) items.push(this.#pool("dhctc-stress", "DHCTC.Tooltip.Stress", stress));
    if (Number.isFinite(system.evasion)) {
      items.push(this.#single("dhctc-defense", "DHCTC.Tooltip.Evasion", system.evasion));
    } else if (Number.isFinite(system.difficulty)) {
      items.push(this.#single("dhctc-defense", "DHCTC.Tooltip.Difficulty", system.difficulty));
    }
    if (!items.length) return null;

    const row = doc.createElement("div");
    row.className = ROW_CLASS;
    for (const { cls, text, tooltip } of items) {
      const span = doc.createElement("span");
      span.className = cls;
      span.textContent = text;
      span.dataset.tooltip = tooltip;
      span.setAttribute("aria-label", tooltip);
      row.append(span);
    }
    return row;
  }

  /* -------------------------------------------- */

  /** A value/max resource. A missing or zero max is shown as-is ("0/0"), never divided by. */
  static #pool(cls, tooltipKey, { value, max }) {
    const data = { value: value ?? 0, max: max ?? 0 };
    return { cls, text: `${data.value}/${data.max}`, tooltip: game.i18n.format(tooltipKey, data) };
  }

  /** A single number (Evasion or Difficulty). */
  static #single(cls, tooltipKey, value) {
    return { cls, text: String(value), tooltip: game.i18n.format(tooltipKey, { value }) };
  }
}
