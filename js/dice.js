/**
 * dice.js - Cryptographic Random Dice & 3D CSS Cube Visuals
 *
 * Generates unbiased Dayakattai dice rolls (0..3 each, double-zero = 12),
 * applies diminishing bonus probabilities to prevent runaways, and triggers 3D CSS tumbling.
 */
"use strict";

      function rand4() {
        const v = new Uint32Array(1);
        crypto.getRandomValues(v);
        return v[0] % 4;
      } // Exact: the 2^32 possible values divide evenly into four faces.
      function rollDice() {
        const a = rand4(),
          b = rand4();
        return { a, b, value: a === 0 && b === 0 ? 12 : a + b };
      }
      function randomUnit() {
        const value = new Uint32Array(1);
        crypto.getRandomValues(value);
        return value[0] / 2 ** 32;
      }
      function bonusDecision(value) {
        // Fair dice choose the value. Each previous bonus halves the chance
        // that another special value extends the same turn.
        const specialRoll = BONUS_VALUES.has(value),
          bonusDepth = Math.max(0, game.history.length - 1),
          bonusChance = specialRoll ? 0.5 ** bonusDepth : 0,
          bonusDraw = specialRoll && bonusChance < 1 ? randomUnit() : null,
          bonus = specialRoll && (bonusChance === 1 || bonusDraw < bonusChance);
        return { specialRoll, bonusDepth, bonusChance, bonusDraw, bonus };
      }

      function setDieFace(id, value, label) {
        const die = $(id),
          cube = die.querySelector(".diecube");
        cube.classList.remove("show-0", "show-1", "show-2", "show-3");
        cube.classList.add("show-" + value);
        die.setAttribute("aria-label", label);
      }
      function triggerDiceAnimation() {
        // Resetting these classes forces a fresh three-dimensional tumble even
        // when the same faces appear in two consecutive rolls.
        for (const id of ["dieA", "dieB"]) {
          const die = $(id),
            cube = die.querySelector(".diecube");
          die.classList.remove("tumbling");
          cube.classList.remove("rolling");
          void cube.offsetWidth;
          const animationSeconds = 1.15 / (demo ? demoSpeed : 1);
          cube.style.animationDuration = animationSeconds + "s";
          die.style.animationDuration = animationSeconds + "s";
          die.classList.add("tumbling");
          cube.classList.add("rolling");
          setTimeout(() => {
            die.classList.remove("tumbling");
            cube.classList.remove("rolling");
          }, scaledDemoDelay(1240));
        }
      }
