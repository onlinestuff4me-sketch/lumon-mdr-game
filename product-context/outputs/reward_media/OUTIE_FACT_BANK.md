# Outie Fact Bank and Wellness Playback Specification

Status: implementation-ready content handoff  
Last updated: 2026-08-25  
Audience: Claude or another implementation agent

## Non-negotiable rules

- `CANON_WELLNESS_CLAIM` means the underlying sentence is spoken as a Wellness fact or recovered Wellness memory in the show. It is a claim made by Lumon, not independently verified biography. The game sentence below is a paraphrase, not transcript copy.
- `ORIGINAL_APOCRYPHA` means the fact is game-original and must never be described as show canon.
- Display and speak the exact same `text` value.
- Never derive facts from private or inferred player data.
- Never imitate Ms. Casey or Dichen Lachman. Use an original, calm, emotionally neutral performance.
- Persist the selected fact ID before opening the card. Seen facts do not repeat until the eligible pool is exhausted.
- Default content rating excludes `mature: true`; mature facts require an explicit content setting.

## Show-derived fact bank

All wording is adapted for the game. Source episodes are *Half Loop* (S1E2), *What’s for Dinner?* (S1E8), and *Trojan’s Horse* (S2E5). Reference checks: [S1E2 recap and session inventory](https://metawitches.com/2022/03/29/severance-season-1-episode-2-half-loop-recap/), [S1E8 episode transcript](https://www.springfieldspringfield.co.uk/view_episode_scripts.php?episode=s01e08&tv-show=severance-2022), and [S2E5 recap of Mark’s recovered Wellness statements](https://www.destructoid.com/severance-season-2-episode-5-trojans-horse-ending-explained/). Every row below has lore label `CANON_WELLNESS_CLAIM`.

| ID | Text used by card and speech | Episode | Production note |
|---|---|---|---|
| `OF_CANON_001` | Your outie is known for generosity. | S1E2 | Irving session; paraphrase |
| `OF_CANON_002` | Your outie receives music with appreciation. | S1E2 | Irving session; paraphrase |
| `OF_CANON_003` | Your outie offers friendship to children, older people, and those whose minds trouble them. | S1E2 | Irving session; sensitively paraphrased |
| `OF_CANON_004` | Your outie once helped another person lift an object of considerable weight. | S1E2 | Irving session; paraphrase |
| `OF_CANON_005` | Your outie attends dances and is welcomed by the other dancers. | S1E2 | Irving session; paraphrase |
| `OF_CANON_006` | Your outie appreciates films and possesses a machine capable of playing them. | S1E2 | Irving session; paraphrase |
| `OF_CANON_007` | Your outie moves through water with unusual grace. | S1E2 | Irving session; paraphrase |
| `OF_CANON_008` | Your outie has been assessed as splendid. | S1E2 | Irving session; paraphrase |
| `OF_CANON_009` | Your outie was recently victorious in a game. | S1E2 | Irving session; paraphrase |
| `OF_CANON_010` | Your outie assigns meaningful value to water. | S1E2 | Irving session; paraphrase |
| `OF_CANON_011` | Your outie once appeared in a newspaper beside a trophy. | S1E2 | Irving session; paraphrase |
| `OF_CANON_012` | Your outie is not easily intimidated by muggers or knaves. | S1E2 | Irving session; close paraphrase |
| `OF_CANON_013` | Your outie enjoys what is described as the sound of radar. | S1E2 | Irving session; preserve “radar” clue |
| `OF_CANON_014` | Your outie is considered capable in kissing and lovemaking. | S1E2 | Irving session; `mature: true` |
| `OF_CANON_015` | Your outie behaves with kindness. | S1E8 | Mark session; paraphrase |
| `OF_CANON_016` | Your outie has improved a person’s day by smiling. | S1E8 | Mark session; paraphrase |
| `OF_CANON_017` | Your outie makes time for people even when time is inconvenient. | S1E8 | Mark session; paraphrase |
| `OF_CANON_018` | Your outie can assemble a tent in fewer than three minutes. | S1E8 | Mark session; paraphrase |
| `OF_CANON_019` | Your outie can distinguish a beautiful rock from an ordinary one. | S1E8 | Mark session; paraphrase |
| `OF_CANON_020` | Your outie listens to music while shaving, but not while showering. | S2E5 | Mark memory fragment; close paraphrase |
| `OF_CANON_021` | Your outie can parallel park in fewer than twenty seconds. | S2E5 | Mark memory fragment; close paraphrase |
| `OF_CANON_022` | Your outie moves on roller skates with grace. | S2E5 | Mark memory fragment; paraphrase |
| `OF_CANON_023` | Your outie pays gas and electric bills within three business days. | S2E5 | Mark memory fragment; close paraphrase |
| `OF_CANON_024` | Your outie prefers two scoops of ice cream, provided they share one flavor. | S2E5 | Mark memory fragment; paraphrase |
| `OF_CANON_025` | Your outie once caught a butterfly. | S2E5 | Mark memory fragment; close paraphrase |

Canon note: the show presents these as Lumon’s claims. Some connect to later on-screen details, but the game must not assert that every Wellness claim is objectively true. Any claim that Wellness is principally a reintegration test remains `FAN_THEORY` unless future canon confirms it.

## Game-original fact bank

| ID | Text used by card and speech | Lore label |
|---|---|---|
| `OF_ORIGINAL_001` | Your outie returns shopping carts without requiring recognition. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_002` | Your outie has folded a fitted sheet into an acceptable rectangle. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_003` | Your outie pauses films before leaving the room. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_004` | Your outie notices when a plant has become quietly thirsty. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_005` | Your outie once selected a pear at the precise moment of ripeness. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_006` | Your outie owns a towel whose purpose remains specific but unexplained. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_007` | Your outie can identify the correct lid for nearly every container. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_008` | Your outie sharpens pencils to approximately equal lengths. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_009` | Your outie closes cabinet doors on the first attempt. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_010` | Your outie can tell passing rain from rain that has settled in. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_011` | Your outie has given a stranger directions that proved sufficient. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_012` | Your outie has repaired a button and continued wearing the shirt. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_013` | Your outie permits tea to steep for the recommended interval. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_014` | Your outie knows when a room would benefit from a lamp. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_015` | Your outie can hear when a refrigerator door is not fully closed. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_016` | Your outie washes dishes before the remaining food becomes difficult. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_017` | Your outie keeps one drawer in complete and durable order. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_018` | Your outie can recognize a receipt that deserves to be retained. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_019` | Your outie remembers which side of the bed contains the unfinished book. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_020` | Your outie prefers spoons of moderate and dependable depth. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_021` | Your outie carries groceries in a manner that protects the bread. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_022` | Your outie has untangled a cable without assigning blame. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_023` | Your outie can locate the quietest chair in an unfamiliar room. | `ORIGINAL_APOCRYPHA` |
| `OF_ORIGINAL_024` | Your outie has waited for paint to dry before touching it. | `ORIGINAL_APOCRYPHA` |

## Scheduled fact-card rewards

These are deterministic reward presentations. Their identity remains classified in the Incentive Forecast until unlocked.

| Sub-ID | Trigger | Pool preference |
|---|---|---|
| `R03_FILE_3` | `filesCompleted >= 3` | show-derived |
| `R03_BIN_10` | `binsTotal >= 10` | original |
| `R03_FILE_13` | `filesCompleted >= 13` | show-derived |
| `R03_RESUME_2` | `resumeCount >= 2` | original |
| `R03_BIN_25` | `binsTotal >= 25` | show-derived |
| `R03_PERFECT_1` | `perfectScreensTotal >= 1` | original |
| `R03_BIN_60` | `binsTotal >= 60` | original |
| `R03_RESUME_4` | `resumeCount >= 4` | show-derived |
| `R03_BIN_300` | `binsTotal >= 300` | show-derived |
| `R03_RESUME_8` | `resumeCount >= 8` | original |

## Scheduled Wellness sessions

| Sub-ID | Trigger | Facts | Mix |
|---|---|---:|---|
| `R06_SESSION_1` | `filesCompleted >= 9` | 3 | two show-derived, one original |
| `R06_SESSION_2` | `filesCompleted >= 18` | 4 | two show-derived, two original |
| `R06_SESSION_3` | `binsTotal >= 250` | 5 | two show-derived, three original |
| `R06_SESSION_BALANCED` | each temper `>= 25` bins | 4 | two show-derived, two original |

Selection rules:

1. Filter out seen IDs, disallowed spoiler tiers, and mature facts when disabled.
2. Draw from the requested mix using a deterministic seed stored in the save.
3. Persist selected IDs and event state as `earned_pending` before opening.
4. Show the cream fact card, typeset the exact fact at runtime, and begin speech after the card settles.
5. Highlight one sentence at a time while its audio plays. Captions remain visible even with sound off.
6. Pause 650–900 ms between facts. Offer `CONTINUE` only after the current sentence completes.
7. Add every heard fact to the Wellness archive with its player-facing sentence. Do not expose canon labels unless the optional lore-source view is enabled.

## Speech direction and TTS prompt

Copy/paste prompt:

```text
Read the supplied Outie fact exactly as written. Use an original adult voice with calm, neutral warmth and precise diction. Pace: approximately 130 words per minute. Emotional range: restrained and reassuring, never intimate, comic, ominous, or judgmental. Do not imitate any actor or character voice. Do not add an introduction, reaction, sigh, or closing phrase. Leave 700 milliseconds of silence after the final word.
```

Runtime audio requirements:

- Normalize speech to a comfortable dialogue loudness and duck the Wellness music bed beneath it.
- Cache shipped voice clips offline; do not require a network service during the session.
- If speech generation fails, the card and caption remain sufficient and the event continues.
- User preference among facts may change harmless cosmetic analytics only; it never alters rewards, difficulty, or narrative truth.
