/**
 * i18n.js - Bilingual English / Tamil Localization Engine
 *
 * Provides authentic bilingual translations for game terminology, tactical
 * badges, status announcements, commentary speech, and UI navigation.
 * Default locale is English ("en"). Players can switch to Tamil ("ta") on demand.
 */
"use strict";

const I18N_LOCALES = {
  en: {
    "brand_name": "Dhayam",
    "brand_subtitle": "A traditional board game of Tamil Nadu",
    "lang_name": "English",
    "lang_toggle_btn": "\ud83c\udf10 \u0ba4\u0bae\u0bbf\u0bb4\u0bcd",
    "lang_toggle_title": "Switch to Tamil / \u0ba4\u0bae\u0bbf\u0bb4\u0bcd \u0bae\u0bca\u0bb4\u0bbf\u0b95\u0bcd\u0b95\u0bc1 \u0bae\u0bbe\u0bb1\u0bb5\u0bc1\u0bae\u0bcd",
    "menu_title": "\u2630 Game menu",
    "menu_new": "\uff0b New game",
    "menu_guide": "? How to play",
    "menu_demo": "\u2726 Demo",
    "menu_qr": "\ud83d\udcf1 Scan QR",
    "menu_settings": "\u2699\ufe0f Settings",
    "menu_copy_summary": "\ud83d\udccc Copy game summary",
    "menu_copy_turn_details": "\ud83e\uddfe Copy turn-by-turn details",
    "menu_share": "\ud83d\udce2 Share",
    "menu_shortcuts": "\u2328\ufe0f Keyboard & Voice shortcuts",
    "menu_diagnostics": "\ud83d\udeeb Copy diagnostics",
    "voice_commentary_on": "\ud83d\udd0a Voice commentary: On",
    "voice_commentary_off": "\ud83d\udd07 Voice commentary: Off",
    "voice_control_on": "\ud83c\udfa4 Voice: On",
    "voice_control_off": "\ud83c\udfa4 Voice: Off",
    "legend_path": "Flowing travel path",
    "legend_piece": "Available piece",
    "legend_safe": "Safe square",
    "legend_colors": "Player colors",
    "action_roll_dice": "\ud83c\udfb2 Roll Dice",
    "action_rolling": "\ud83c\udfb2 Rolling\u2026",
    "action_move_selected": "\ud83d\udc49 Move Selected Piece",
    "action_enter_piece": "\u2728 Enter Piece",
    "action_pass_turn": "Pass turn",
    "action_new_match": "\ud83c\udfc6 New match",
    "action_moving": "Moving\u2026",
    "action_waiting_for": "Waiting for {name}\u2026",
    "action_thinking": "{name} is thinking\u2026",
    "action_pass": "Pass",
    "action_all_rolls": "All {count} rolls",
    "action_opening_entry": "＋ Opening entry allowance",
    "action_enter_roll_chip": "＋ Enter a piece",
    "winner_title": "{name} wins!",
    "status_winner_detail": "{name} brought all six pieces to the center. The game is complete.",
    "status_waiting_peer": "Waiting for {name} to {action}…",
    "status_roll_dice": "roll dice",
    "status_make_move": "make a move",
    "status_roll_prompt_normal": "Roll the Dayakattai dice · Follow the glowing route around the board.",
    "status_roll_prompt_bonus": "Roll the Dayakattai dice · bonus throw! Follow the glowing route around the board.",
    "status_opening_entry": "Use this player’s first-round entry allowance to put a piece on the board.",
    "status_choose_roll": "Choose a roll, then tap a gold-outlined {avatar} piece. {count} move{plural} available.",
    "toast_dice_rolled": "👉 Dice rolled! Pick a piece to move.",
    "warn_already_rolled_html": "<strong style=\"color:#ffa94d;\">⚠️ Dice already rolled!</strong> Tap a piece on the board or click \"Move selected piece\".",
    "dhayam_bonus_badge": "✨ Dhayam! · Bonus throw",
    "home_count": "{count}/6 home",
    "welcome_title": "Welcome to Dhayam",
    "welcome_text": "Start a game to play.",
    "turn_title": "{name}\u2019s turn",
    "roll_prompt": "Roll the dice to begin your turn.",
    "move_prompt": "Choose a piece to move.",
    "choose_piece_stack": "Choose a numbered piece below the stack.",
    "roll_first_prompt": "Roll the dice first to see legal moves.",
    "cannot_move_roll": "{name}\u2019s piece #{num} cannot move with the current dice rolls.",
    "warn_already_rolled": "\u26a0\ufe0f Dice already rolled! Tap a piece on the board or click \"Move selected piece\".",
    "no_legal_moves_passed": "No legal moves \u2014 turn passed.",
    "winner_announcement": "{name} has won the match!",
    "badge_goal": "GOAL",
    "badge_capture": "CAPTURE",
    "badge_sanctuary": "SAFE",
    "badge_enter": "ENTER",
    "last_roll": "Last Roll",
    "dhayam": "Dhayam",
    "bonus_throw": "\u2728 Bonus throw ({val})",
    "normal_roll": "Normal roll",
    "bonus_chain_complete": "Bonus chain complete",
    "dice_helper_init": "Two traditional dice \u00b7 Click dice to roll.<br>Roll 1, 5, 6, or 12 for a bonus throw.",
    "dice_click_to_roll": "Click to roll dice",
    "dice_already_rolled_title": "Dice already rolled \u2014 Select a piece to move",
    "family_table": "Family table",
    "waiting": "Waiting",
    "on_board": "On board",
    "home": "Home",
    "turn_badge": "Turn",
    "capture_needed": "Capture needed",
    "capture_earned": "\u2694\ufe0f Capture earned (+50)",
    "points_unit": "pts",
    "bonus_unit": "bonus",
    "leader_star_title": "\u2b50 Match Leader (1st Place)",
    "game_info_solo": "1 human \u00b7 {computers} computer{plural}",
    "game_info_multi": "{players} players \u00b7 Local pass-and-play",
    "modal_got_it": "Got it",
    "modal_close": "Close",
    "modal_start_game": "Start game",
    "modal_cancel": "Cancel",
    "modal_reset_title": "Reset the match?",
    "modal_reset_text": "This clears the current game and its audit. Copy the game audit first if you want to keep it for analysis.",
    "modal_reset_confirm": "Reset match",
    "modal_how_to_play_title": "How to Play Dhayam",
    "modal_share_title": "Share Dhayam",
    "modal_new_game_title": "New family game",
    "speech_roll_dhayam": "{name} rolled a 1 — Dhayam! That earns another roll. Roll again!",
    "speech_roll_bonus": "{name} rolled {val}! That earns a bonus throw. Roll again!",
    "speech_roll_normal": "{name} rolled {val}. Pick your piece and advance along the path.",
    "speech_roll_pass": "{name} rolled {val}, but the path is blocked this time. Passing to the next player.",
    "speech_move_enter": "{name} brings a piece onto the board.",
    "speech_move_opening_enter": "{name} uses the opening entry allowance to bring a piece onto the board.",
    "speech_move_advance": "{name} advances forward {values} squares.",
    "speech_move_capture": "Capture! {victim} is captured and returns to reserve!",
    "speech_move_goal": "Congratulations {name}! The piece reaches the center goal!",
    "speech_winner": "Congratulations {name}! {name} wins the match!",
    "speech_audio_on": "Voice commentary is on.",
    "speech_voice_on": "Voice control enabled. You can say: Roll dice, Move, New game, or Exit.",
    "speech_voice_off": "Voice commands disabled.",
  },
  ta: {
    "brand_name": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8",
    "brand_subtitle": "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd\u0ba8\u0bbe\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bcd \u0baa\u0bbe\u0bb0\u0bae\u0bcd\u0baa\u0bb0\u0bbf\u0baf \u0baa\u0bb2\u0b95\u0bc8 \u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1",
    "lang_name": "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd",
    "lang_toggle_btn": "\ud83c\udf10 English",
    "lang_toggle_title": "Switch to English / \u0b86\u0b99\u0bcd\u0b95\u0bbf\u0bb2 \u0bae\u0bca\u0bb4\u0bbf\u0b95\u0bcd\u0b95\u0bc1 \u0bae\u0bbe\u0bb1\u0bb5\u0bc1\u0bae\u0bcd",
    "menu_title": "\u2630 \u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1 \u0baa\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bb2\u0bcd",
    "menu_new": "\uff0b \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd",
    "menu_guide": "? \u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f\u0bc1\u0bae\u0bcd \u0bae\u0bc1\u0bb1\u0bc8",
    "menu_demo": "\u2726 \u0b9a\u0bc6\u0baf\u0bb2\u0bcd\u0bae\u0bc1\u0bb1\u0bc8 \u0bb5\u0bbf\u0bb3\u0b95\u0bcd\u0b95\u0bae\u0bcd",
    "menu_qr": "\ud83d\udcf1 QR \u0b95\u0bc1\u0bb1\u0bbf\u0baf\u0bc0\u0b9f\u0bc1",
    "menu_settings": "\u2699\ufe0f \u0b85\u0bae\u0bc8\u0baa\u0bcd\u0baa\u0bc1\u0b95\u0bb3\u0bcd",
    "menu_copy_summary": "\ud83d\udccc \u0b86\u0b9f\u0bcd\u0b9f \u0b9a\u0bc1\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0ba4\u0bcd\u0ba4\u0bc8 \u0ba8\u0b95\u0bb2\u0bc6\u0b9f\u0bc1",
    "menu_copy_turn_details": "\ud83e\uddfe \u0bae\u0bc1\u0bb1\u0bc8 \u0bb5\u0bbf\u0bb5\u0bb0\u0b99\u0bcd\u0b95\u0bb3\u0bc8 \u0ba8\u0b95\u0bb2\u0bc6\u0b9f\u0bc1",
    "menu_share": "\ud83d\udce2 \u0baa\u0b95\u0bbf\u0bb0\u0bcd",
    "menu_shortcuts": "\u2328\ufe0f \u0bb5\u0bbf\u0b9a\u0bc8\u0baa\u0bcd\u0baa\u0bb2\u0b95\u0bc8 & \u0b95\u0bc1\u0bb0\u0bb2\u0bcd \u0b95\u0bc1\u0bb1\u0bc1\u0b95\u0bcd\u0b95\u0bc1\u0bb5\u0bb4\u0bbf\u0b95\u0bb3\u0bcd",
    "menu_diagnostics": "\ud83d\udeeb \u0b95\u0ba3\u0bbf\u0ba9\u0bbf \u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bc8 \u0ba8\u0b95\u0bb2\u0bc6\u0b9f\u0bc1",
    "voice_commentary_on": "\ud83d\udd0a \u0b95\u0bc1\u0bb0\u0bb2\u0bcd \u0bb5\u0bb0\u0bcd\u0ba3\u0ba9\u0bc8: \u0b87\u0baf\u0b95\u0bcd\u0b95\u0bae\u0bcd",
    "voice_commentary_off": "\ud83d\udd07 \u0b95\u0bc1\u0bb0\u0bb2\u0bcd \u0bb5\u0bb0\u0bcd\u0ba3\u0ba9\u0bc8: \u0ba8\u0bbf\u0bb1\u0bc1\u0ba4\u0bcd\u0ba4\u0bae\u0bcd",
    "voice_control_on": "\ud83c\udfa4 \u0b95\u0bc1\u0bb0\u0bb2\u0bcd: \u0b87\u0baf\u0b95\u0bcd\u0b95\u0bae\u0bcd",
    "voice_control_off": "\ud83c\udfa4 \u0b95\u0bc1\u0bb0\u0bb2\u0bcd: \u0ba8\u0bbf\u0bb1\u0bc1\u0ba4\u0bcd\u0ba4\u0bae\u0bcd",
    "legend_path": "\u0ba8\u0b95\u0bb0\u0bc1\u0bae\u0bcd \u0baa\u0bbe\u0ba4\u0bc8",
    "legend_piece": "\u0ba8\u0b95\u0bb0\u0b95\u0bcd\u0b95\u0bc2\u0b9f\u0bbf\u0baf \u0b95\u0bbe\u0baf\u0bcd",
    "legend_safe": "\u0bae\u0bb2\u0bc8 (\u0baa\u0bbe\u0ba4\u0bc1\u0b95\u0bbe\u0baa\u0bcd\u0baa\u0bc1 \u0b95\u0b9f\u0bcd\u0b9f\u0bae\u0bcd)",
    "legend_colors": "\u0b86\u0b9f\u0bcd\u0b9f\u0b95\u0bcd\u0b95\u0bbe\u0bb0\u0bb0\u0bcd \u0ba8\u0bbf\u0bb1\u0b99\u0bcd\u0b95\u0bb3\u0bcd",
    "action_roll_dice": "\ud83c\udfb2 \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1",
    "action_rolling": "\ud83c\udfb2 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0b95\u0bbf\u0bb1\u0ba4\u0bc1\u2026",
    "action_move_selected": "\ud83d\udc49 \u0b95\u0bbe\u0baf\u0bc8 \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1",
    "action_enter_piece": "\u2728 \u0b95\u0bb3\u0bae\u0bcd \u0baa\u0bc1\u0b95\u0bc1",
    "action_pass_turn": "\u0bae\u0bc1\u0bb1\u0bc8\u0baf\u0bc8 \u0bb5\u0bbf\u0b9f\u0bc1",
    "action_new_match": "\ud83c\udfc6 \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd",
    "action_moving": "\u0ba8\u0b95\u0bb0\u0bcd\u0b95\u0bbf\u0bb1\u0ba4\u0bc1\u2026",
    "action_waiting_for": "{name}-\u0b95\u0bcd\u0b95\u0bbe\u0b95 \u0b95\u0bbe\u0ba4\u0bcd\u0ba4\u0bbf\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bbf\u0bb1\u0ba4\u0bc1\u2026",
    "action_thinking": "{name} \u0b9a\u0bbf\u0ba8\u0bcd\u0ba4\u0bbf\u0b95\u0bcd\u0b95\u0bbf\u0bb1\u0bbe\u0bb0\u0bcd\u2026",
    "action_pass": "\u0bb5\u0bbf\u0b9f\u0bc1",
    "action_all_rolls": "\u0b85\u0ba9\u0bc8\u0ba4\u0bcd\u0ba4\u0bc1 {count} \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bcd\u0b95\u0bb3\u0bc1\u0bae\u0bcd",
    "action_opening_entry": "\uff0b \u0bae\u0bc1\u0ba4\u0bb2\u0bcd \u0b9a\u0bc1\u0bb1\u0bcd\u0bb1\u0bc1 \u0b95\u0bb3\u0bae\u0bcd \u0baa\u0bc1\u0b95\u0bc1",
    "action_enter_roll_chip": "\uff0b \u0b95\u0bb3\u0bae\u0bcd \u0baa\u0bc1\u0b95\u0bc1",
    "winner_title": "{name} \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0bbe\u0bb0\u0bcd!",
    "status_winner_detail": "{name} \u0b86\u0bb1\u0bc1 \u0b95\u0bbe\u0baf\u0bcd\u0b95\u0bb3\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0baa\u0bb0\u0bae\u0baa\u0ba4\u0ba4\u0bcd\u0ba4\u0bbf\u0bb1\u0bcd\u0b95\u0bc1 \u0b95\u0bca\u0ba3\u0bcd\u0b9f\u0bc1 \u0b9a\u0bc7\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1 \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0bbe\u0bb0\u0bcd.",
    "status_waiting_peer": "{name} {action}\u0b95\u0bcd\u0b95\u0bbe\u0b95\u0b95\u0bcd \u0b95\u0bbe\u0ba4\u0bcd\u0ba4\u0bbf\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bbf\u0bb1\u0ba4\u0bc1\u2026",
    "status_roll_dice": "\u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1\u0bb5\u0ba4\u0bb1\u0bcd",
    "status_make_move": "\u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\u0bb5\u0ba4\u0bb1\u0bcd",
    "status_roll_prompt_normal": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0baf\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd \u00b7 \u0baa\u0bb2\u0b95\u0bc8\u0baf\u0bbf\u0ba9\u0bcd \u0b92\u0bb3\u0bbf\u0bb0\u0bc1\u0bae\u0bcd \u0baa\u0bbe\u0ba4\u0bc8\u0baf\u0bc8\u0baa\u0bcd \u0baa\u0bbf\u0ba9\u0bcd\u0baa\u0bb1\u0bcd\u0bb1\u0bb5\u0bc1\u0bae\u0bcd.",
    "status_roll_prompt_bonus": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0baf\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd \u00b7 \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1! \u0baa\u0bb2\u0b95\u0bc8\u0baf\u0bbf\u0ba9\u0bcd \u0b92\u0bb3\u0bbf\u0bb0\u0bc1\u0bae\u0bcd \u0baa\u0bbe\u0ba4\u0bc8\u0baf\u0bc8\u0baa\u0bcd \u0baa\u0bbf\u0ba9\u0bcd\u0baa\u0bb1\u0bcd\u0bb1\u0bb5\u0bc1\u0bae\u0bcd.",
    "status_opening_entry": "\u0b87\u0ba8\u0bcd\u0ba4 \u0b86\u0b9f\u0bcd\u0b9f\u0b95\u0bcd\u0b95\u0bbe\u0bb0\u0bb0\u0bbf\u0ba9\u0bcd \u0bae\u0bc1\u0ba4\u0bb2\u0bcd \u0b9a\u0bc1\u0bb1\u0bcd\u0bb1\u0bc1 \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc8\u0baa\u0bcd \u0baa\u0baf\u0ba9\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bbf \u0b95\u0bb3\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0b95\u0bbe\u0baf\u0bcd \u0b87\u0bb1\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    "status_choose_roll": "\u0b92\u0bb0\u0bc1 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1, \u0ba4\u0b99\u0bcd\u0b95 \u0bb5\u0bb0\u0bc8\u0baf\u0bc6\u0bb2\u0bcd\u0bb2\u0bc8 \u0b95\u0bca\u0ba3\u0bcd\u0b9f {avatar} \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd. {count} \u0ba8\u0b95\u0bb0\u0bcd\u0bb5\u0bc1\u0b95\u0bb3\u0bcd \u0b89\u0bb3\u0bcd\u0bb3\u0ba9.",
    "toast_dice_rolled": "\ud83d\udc49 \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbe\u0baf\u0bbf\u0bb1\u0bcd\u0bb1\u0bc1! \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    "warn_already_rolled_html": "<strong style=\"color:#ffa94d;\">\u26a0\ufe0f \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbe\u0baf\u0bbf\u0bb1\u0bcd\u0bb1\u0bc1!</strong> \u0baa\u0bb2\u0b95\u0bc8\u0baf\u0bbf\u0bb2\u0bcd \u0b89\u0bb3\u0bcd\u0bb3 \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd \u0b85\u0bb2\u0bcd\u0bb2\u0ba4\u0bc1 \"\u0b95\u0bbe\u0baf\u0bc8 \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\" \u0baa\u0bca\u0ba4\u0bcd\u0ba4\u0bbe\u0ba9\u0bc8 \u0b85\u0bb4\u0bc1\u0ba4\u0bcd\u0ba4\u0bb5\u0bc1\u0bae\u0bcd.",
    "dhayam_bonus_badge": "\u2728 \u0ba4\u0bbe\u0baf\u0bae\u0bcd! \u00b7 \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1",
    "home_count": "{count}/6 \u0baa\u0bb0\u0bae\u0baa\u0ba4\u0bae\u0bcd",
    "welcome_title": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0b95\u0bcd\u0b95\u0bc1 \u0ba8\u0bb2\u0bcd\u0bb5\u0bb0\u0bb5\u0bc1",
    "welcome_text": "\u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f \u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bc8\u0ba4\u0bcd \u0ba4\u0bca\u0b9f\u0b99\u0bcd\u0b95\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
    "turn_title": "{name}-\u0ba9\u0bcd \u0bae\u0bc1\u0bb1\u0bc8",
    "roll_prompt": "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0bae\u0bc1\u0bb1\u0bc8\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bca\u0b9f\u0b99\u0bcd\u0b95 \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0baf\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd.",
    "move_prompt": "\u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4 \u0b92\u0bb0\u0bc1 \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    "choose_piece_stack": "\u0b85\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bbf\u0bb2\u0bcd \u0b89\u0bb3\u0bcd\u0bb3 \u0b92\u0bb0\u0bc1 \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    "roll_first_prompt": "\u0ba8\u0b95\u0bb0\u0bcd\u0bb5\u0bc1\u0b95\u0bb3\u0bc8\u0baa\u0bcd \u0baa\u0bbe\u0bb0\u0bcd\u0b95\u0bcd\u0b95 \u0bae\u0bc1\u0ba4\u0bb2\u0bbf\u0bb2\u0bcd \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0baf\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd.",
    "cannot_move_roll": "{name}-\u0ba9\u0bcd \u0b95\u0bbe\u0baf\u0bcd #{num} \u0ba4\u0bb1\u0bcd\u0baa\u0bcb\u0ba4\u0bc8\u0baf \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bbf\u0bb2\u0bcd \u0ba8\u0b95\u0bb0 \u0bae\u0bc1\u0b9f\u0bbf\u0baf\u0bbe\u0ba4\u0bc1.",
    "warn_already_rolled": "\u26a0\ufe0f \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbe\u0baf\u0bbf\u0bb1\u0bcd\u0bb1\u0bc1! \u0baa\u0bb2\u0b95\u0bc8\u0baf\u0bbf\u0bb2\u0bcd \u0b89\u0bb3\u0bcd\u0bb3 \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd \u0b85\u0bb2\u0bcd\u0bb2\u0ba4\u0bc1 \"\u0b95\u0bbe\u0baf\u0bc8 \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\" \u0baa\u0bca\u0ba4\u0bcd\u0ba4\u0bbe\u0ba9\u0bc8 \u0b85\u0bb4\u0bc1\u0ba4\u0bcd\u0ba4\u0bb5\u0bc1\u0bae\u0bcd.",
    "no_legal_moves_passed": "\u0ba8\u0b95\u0bb0\u0bcd\u0bb5\u0bc1\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8 \u2014 \u0bae\u0bc1\u0bb1\u0bc8 \u0b85\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bb5\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1 \u0b9a\u0bc6\u0ba9\u0bcd\u0bb1\u0ba4\u0bc1.",
    "winner_announcement": "{name} \u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0bc1 \u0bb5\u0bbe\u0b95\u0bc8 \u0b9a\u0bc2\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd!",
    "badge_goal": "\u0baa\u0bb0\u0bae\u0baa\u0ba4\u0bae\u0bcd",
    "badge_capture": "\u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1",
    "badge_sanctuary": "\u0bae\u0bb2\u0bc8",
    "badge_enter": "\u0b95\u0bb3\u0bae\u0bcd \u0baa\u0bc1\u0b95\u0bc1",
    "last_roll": "\u0b95\u0b9f\u0bc8\u0b9a\u0bbf \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bcd",
    "dhayam": "\u0ba4\u0bbe\u0baf\u0bae\u0bcd",
    "bonus_throw": "\u2728 \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1 ({val})",
    "normal_roll": "\u0b9a\u0bbe\u0ba4\u0bbe\u0bb0\u0ba3 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bcd",
    "bonus_chain_complete": "\u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1 \u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "dice_helper_init": "\u0b87\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1 \u0baa\u0bbe\u0bb0\u0bae\u0bcd\u0baa\u0bb0\u0bbf\u0baf \u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0b95\u0bb3\u0bcd \u00b7 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f \u0ba4\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd.<br>1, 5, 6, \u0b85\u0bb2\u0bcd\u0bb2\u0ba4\u0bc1 12 \u0bb5\u0bbf\u0bb4\u0bc1\u0ba8\u0bcd\u0ba4\u0bbe\u0bb2\u0bcd \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bcd.",
    "dice_click_to_roll": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8\u0baf\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f \u0ba4\u0b9f\u0bcd\u0b9f\u0bb5\u0bc1\u0bae\u0bcd",
    "dice_already_rolled_title": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbe\u0baf\u0bbf\u0bb1\u0bcd\u0bb1\u0bc1 \u2014 \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd",
    "family_table": "\u0b95\u0bc1\u0b9f\u0bc1\u0bae\u0bcd\u0baa \u0b85\u0bb0\u0b99\u0bcd\u0b95\u0bae\u0bcd",
    "waiting": "\u0b95\u0bbe\u0ba4\u0bcd\u0ba4\u0bbf\u0bb0\u0bc1\u0baa\u0bcd\u0baa\u0bb5\u0bc8",
    "on_board": "\u0b95\u0bb3\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd",
    "home": "\u0baa\u0bb0\u0bae\u0baa\u0ba4\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd",
    "turn_badge": "\u0bae\u0bc1\u0bb1\u0bc8",
    "capture_needed": "\u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1 \u0ba4\u0bc7\u0bb5\u0bc8",
    "capture_earned": "\u2694\ufe0f \u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1 \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0ba4\u0bc1 (+50)",
    "points_unit": "\u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd",
    "bonus_unit": "\u0baa\u0bcb\u0ba9\u0bb8\u0bcd",
    "leader_star_title": "\u2b50 \u0bae\u0bc1\u0ba4\u0bb2\u0bbf\u0b9f\u0bae\u0bcd (\u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd \u0ba4\u0bb2\u0bc8\u0bb5\u0bb0\u0bcd)",
    "game_info_solo": "1 \u0bae\u0ba9\u0bbf\u0ba4\u0bb0\u0bcd \u00b7 {computers} \u0b95\u0ba3\u0bbf\u0ba9\u0bbf",
    "game_info_multi": "{players} \u0b86\u0b9f\u0bcd\u0b9f\u0b95\u0bcd\u0b95\u0bbe\u0bb0\u0bb0\u0bcd\u0b95\u0bb3\u0bcd \u00b7 \u0b89\u0bb3\u0bcd\u0bb3\u0bc2\u0bb0\u0bcd \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd",
    "modal_got_it": "\u0baa\u0bc1\u0bb0\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "modal_close": "\u0bae\u0bc2\u0b9f\u0bc1",
    "modal_start_game": "\u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bc8\u0ba4\u0bcd \u0ba4\u0bca\u0b9f\u0b99\u0bcd\u0b95\u0bc1",
    "modal_cancel": "\u0bb0\u0ba4\u0bcd\u0ba4\u0bc1",
    "modal_reset_title": "\u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bc8 \u0bae\u0bc0\u0b9f\u0bcd\u0b9f\u0bae\u0bc8\u0b95\u0bcd\u0b95\u0bb5\u0bbe?",
    "modal_reset_text": "\u0b87\u0ba4\u0bc1 \u0ba4\u0bb1\u0bcd\u0baa\u0bcb\u0ba4\u0bc8\u0baf \u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0b85\u0bb4\u0bbf\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd. \u0baa\u0b95\u0bc1\u0baa\u0bcd\u0baa\u0bbe\u0baf\u0bcd\u0bb5\u0bbf\u0bb1\u0bcd\u0b95\u0bc1 \u0ba4\u0bc7\u0bb5\u0bc8\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bbe\u0bb2\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bc8 \u0bae\u0bc1\u0ba9\u0bcd\u0baa\u0bc7 \u0ba8\u0b95\u0bb2\u0bc6\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    "modal_reset_confirm": "\u0bae\u0bc0\u0b9f\u0bcd\u0b9f\u0bae\u0bc8",
    "modal_how_to_play_title": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f\u0bc1\u0bae\u0bcd \u0bae\u0bc1\u0bb1\u0bc8",
    "modal_share_title": "\u0ba4\u0bbe\u0baf\u0b95\u0bcd\u0b95\u0b9f\u0bcd\u0b9f\u0bc8 \u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f\u0bcd\u0b9f\u0bc8\u0baa\u0bcd \u0baa\u0b95\u0bbf\u0bb0\u0bcd",
    "modal_new_game_title": "\u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b95\u0bc1\u0b9f\u0bc1\u0bae\u0bcd\u0baa \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd",
    "speech_roll_dhayam": "{name} \u0ba4\u0bbe\u0baf\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1, \u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd!",
    "speech_roll_bonus": "{name} {val} \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1, \u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd!",
    "speech_roll_normal": "{name} {val} \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd. \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1 \u0bae\u0bc1\u0ba9\u0bcd\u0ba9\u0bc7\u0bb1\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
    "speech_roll_pass": "{name} {val} \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd, \u0b86\u0ba9\u0bbe\u0bb2\u0bcd \u0bb5\u0bb4\u0bbf \u0b85\u0b9f\u0bc8\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bc1\u0bb3\u0bcd\u0bb3\u0ba4\u0bc1. \u0b85\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bb5\u0bb0\u0bcd \u0bae\u0bc1\u0bb1\u0bc8.",
    "speech_move_enter": "{name} \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b95\u0bbe\u0baf\u0bc8 \u0b95\u0bb3\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0b87\u0bb1\u0b95\u0bcd\u0b95\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd.",
    "speech_move_opening_enter": "{name} \u0bae\u0bc1\u0ba4\u0bb2\u0bcd \u0b9a\u0bc1\u0bb1\u0bcd\u0bb1\u0bbf\u0ba9\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc8\u0baa\u0bcd \u0baa\u0baf\u0ba9\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bbf \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b95\u0bbe\u0baf\u0bc8 \u0b95\u0bb3\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0b87\u0bb1\u0b95\u0bcd\u0b95\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd.",
    "speech_move_advance": "{name} \u0b95\u0bbe\u0baf\u0bc8 {values} \u0b95\u0b9f\u0bcd\u0b9f\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd.",
    "speech_move_capture": "\u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1! {victim} \u0b95\u0bbe\u0baf\u0bcd \u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1!",
    "speech_move_goal": "\u0bb5\u0bbe\u0bb4\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\u0b95\u0bb3\u0bcd {name}! \u0b95\u0bbe\u0baf\u0bcd \u0baa\u0bb0\u0bae\u0baa\u0ba4\u0ba4\u0bcd\u0ba4\u0bc8 \u0b85\u0b9f\u0bc8\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1!",
    "speech_winner": "{name} \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0bbe\u0bb0\u0bcd! \u0bb5\u0bbe\u0bb4\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\u0b95\u0bb3\u0bcd!",
    "speech_audio_on": "\u0b95\u0bc1\u0bb0\u0bb2\u0bcd \u0bb5\u0bb0\u0bcd\u0ba3\u0ba9\u0bc8 \u0b87\u0baf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1.",
    "speech_voice_on": "\u0b95\u0bc1\u0bb0\u0bb2\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0bc1\u0baa\u0bcd\u0baa\u0bbe\u0b9f\u0bc1 \u0b87\u0baf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1. \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1, \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1, \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd \u0b8e\u0ba9\u0bcd\u0bb1\u0bc1 \u0b95\u0bc2\u0bb1\u0bb2\u0bbe\u0bae\u0bcd.",
    "speech_voice_off": "\u0b95\u0bc1\u0bb0\u0bb2\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0bc1\u0baa\u0bcd\u0baa\u0bbe\u0b9f\u0bc1 \u0ba8\u0bbf\u0bb1\u0bc1\u0ba4\u0bcd\u0ba4\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1.",
  },
};

let currentLanguage = "en";

try {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("dhayam_lang") : null;
  if (saved === "ta" || saved === "en") currentLanguage = saved;
} catch {}

function getLanguage() {
  return currentLanguage;
}

function t(key, params) {
  const localeDict = I18N_LOCALES[currentLanguage] || I18N_LOCALES.en;
  let str = (localeDict && localeDict[key]) || (I18N_LOCALES.en && I18N_LOCALES.en[key]) || key;
  if (params && typeof params === "object") {
    for (const [pKey, pVal] of Object.entries(params)) {
      str = str.replace(new RegExp("\\{" + pKey + "\\}", "g"), String(pVal));
    }
  }
  return str;
}

function updateStaticTranslations() {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.lang = currentLanguage;

  const brandNameEl = document.getElementById("brandName");
  if (brandNameEl) brandNameEl.textContent = t("brand_name");

  const brandSubEl = document.querySelector(".brand .sub");
  if (brandSubEl) brandSubEl.textContent = t("brand_subtitle");

  const langToggleBtn = document.getElementById("langToggle");
  if (langToggleBtn) {
    langToggleBtn.textContent = t("lang_toggle_btn");
    langToggleBtn.title = t("lang_toggle_title");
  }

  const menuTrigger = document.querySelector(".menu-trigger span");
  if (menuTrigger) menuTrigger.textContent = t("menu_title").replace("☰ ", "");

  const menuMap = {
    newBtn: "menu_new",
    guideBtn: "menu_guide",
    demoBtn: "menu_demo",
    qrBtn: "menu_qr",
    settingsBtn: "menu_settings",
    copyGameSummaryBtn: "menu_copy_summary",
    copyTurnDetailsBtn: "menu_copy_turn_details",
    shareBtn: "menu_share",
    keyboardHelpBtn: "menu_shortcuts",
    flightRecorderTopBtn: "menu_diagnostics",
  };
  for (const [id, key] of Object.entries(menuMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  const legendItems = document.querySelectorAll(".boardlegend .legenditem");
  if (legendItems.length >= 4) {
    legendItems[0].innerHTML = "<span class=\"legendarrow\">〰</span> " + t("legend_path");
    legendItems[1].innerHTML = "<span class=\"legendmove\"></span> " + t("legend_piece");
    legendItems[2].innerHTML = "<span class=\"legendsafe\">✿</span> " + t("legend_safe");
  }

  const familyH2 = document.querySelector(".side .panel h2");
  if (familyH2) familyH2.textContent = t("family_table");

  const modalCancel = document.getElementById("modalCancel");
  if (modalCancel && modalCancel.textContent === "Close") modalCancel.textContent = t("modal_close");
}

function setLanguage(lang) {
  if (lang !== "en" && lang !== "ta") return;
  currentLanguage = lang;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem("dhayam_lang", lang);
  } catch {}
  if (typeof FlightRecorder !== "undefined") {
    FlightRecorder.record("LANGUAGE_CHANGED", { lang });
  }
  updateStaticTranslations();
  if (typeof render === "function") render();
  if (typeof updateAudioToggle === "function") updateAudioToggle();
  if (typeof updateVoiceToggle === "function") updateVoiceToggle();
}

function toggleLanguage() {
  setLanguage(currentLanguage === "en" ? "ta" : "en");
}

if (typeof window !== "undefined") {
  window.I18N_LOCALES = I18N_LOCALES;
  window.currentLanguage = currentLanguage;
  window.getLanguage = getLanguage;
  window.setLanguage = setLanguage;
  window.toggleLanguage = toggleLanguage;
  window.t = t;
  window.updateStaticTranslations = updateStaticTranslations;
}

if (typeof globalThis !== "undefined") {
  globalThis.t = t;
  globalThis.getLanguage = getLanguage;
  globalThis.setLanguage = setLanguage;
  globalThis.toggleLanguage = toggleLanguage;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateStaticTranslations);
  } else {
    updateStaticTranslations();
  }
}
