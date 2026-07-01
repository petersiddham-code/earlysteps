# EarlySteps — A Home Support & Developmental Screening App for Families
### Complete Product Plan (v1.0)

> **Core promise to families:** *"We will never tell you your child is or isn't autistic. We will help you notice patterns, understand your child's support needs, give you practical things to try at home, and tell you clearly when it's time to see a professional."*

---

## 1. Product Vision

**Vision statement:** Every family — regardless of income, location, or waitlist access to specialists — deserves an early, respectful, practical starting point for understanding their child's development and taking action at home while pursuing formal support.

EarlySteps is **not** a diagnostic tool. It is a **screening, guidance, and home-support companion** that:
- Turns validated developmental-surveillance concepts (CDC, AAP, NICE, WHO, DSM-5 *descriptive* criteria — never used to "diagnose") into parent-friendly questions and child-friendly activities.
- Produces a plain-language profile of strengths and support needs across communication, social interaction, sensory, behaviour, learning, attention, motor, emotional regulation, and daily living.
- Delivers a rolling 4-week home activity plan, tracked over time.
- Tells families clearly, calmly, and non-alarmingly when formal assessment or urgent care is needed.

**What EarlySteps is not:** a diagnostic device, a replacement for a paediatrician/SLP/OT/psychologist, or a data-mining product. It is explicitly designed to sit *before* and *alongside* formal care, not instead of it.

---

## 2. Target Users

| Persona | Situation | Primary need |
|---|---|---|
| **Amara, 29** | Single mother, 2-year-old, no paediatric developmental specialist within 100km, 8–14 month public waitlist | "Am I imagining this? What can I do *tonight*?" |
| **The Kumars** | Dual-income, 4-year-old in preschool, teacher raised concerns | Structured next steps + language to talk to the paediatrician |
| **Grandmother-carer, 55** | Raising a 6-year-old grandchild, limited literacy, low income | Voice-first, simple, low-data-cost interface |
| **Teacher/community health worker** | Supports many families in low-resource settings | Bulk-friendly screening, referral list generation |
| **Parent of teenager, newly noticing signs** | Late recognition, masking, social/emotional struggles | Age-appropriate teen module, non-infantilising tone |

Common thread: **cannot afford or cannot access** private developmental paediatricians, SLPs, OTs, or psychologists for initial guidance, and need something *now*, in their language, on a low-cost phone.

---

## 3. Clinical & Ethical Foundation

### 3.1 Frameworks used (as descriptive references, never as diagnostic algorithms)
- **DSM-5** — used only to structure the *domains* (social communication, restricted/repetitive behaviours) — never quoted to a parent as "criteria met."
- **CDC "Learn the Signs. Act Early."** — milestone checklists by age, used for intake question banks.
- **NICE guideline NG128** (autism recognition, referral, diagnosis for under-19s, UK) — used for the "when to refer" logic and the red-flag list.
- **WHO autism care & support principles** — used for tone, rights-based framing, non-pathologising language, and the emphasis on functioning/support needs over labels.
- **AAP developmental surveillance & screening schedule** — used for age-banding of activities (e.g., surveillance at every well-visit, formal screening at 9, 18, 24/30 months) and general "surveillance vs. screening" structure.

### 3.2 Non-negotiable language rules
**Never say:** "your child is autistic," "your child is not autistic," "your child has autism," "normal/abnormal," "defect," "disorder" (in output copy), "broken," "wrong."

**Always say instead:**
- Levels: **Low signs observed / Some signs observed / Many signs observed**
- Recommendation tiers: **Support activities can begin now** / **Formal assessment is recommended** / **Formal assessment strongly recommended soon**
- Domains: *communication differences, social interaction style, sensory needs, repetitive/self-regulating behaviours, learning style, attention profile, motor skill development, emotional regulation, daily living skills*
- Support level (not severity/functioning label from DSM-5, softened): **mild support needs, moderate support needs, high support needs**
- Confidence: **low / medium / high** confidence — always shown next to any finding, because a screening tool is probabilistic, not diagnostic.

Every single screen that shows a result must carry a visible disclaimer:
> *"This is a screening tool, not a diagnosis. Only a qualified professional (paediatrician, psychologist, or developmental specialist) can diagnose autism."*

---

## 4. Feature Modules

### 4.1 Module 1 — Parent Intake
Adaptive questionnaire (branches by age band: 12–24mo / 2–3y / 3–5y / 5–12y / 13–18y). Delivered as **voice, text, or tap-to-select** (accessibility-first — many caregivers have low literacy).

Domains covered, each 3–8 questions, plain language with example ("Does your child point at things to show you, like a plane in the sky?"):
- Basic profile: age, sex, home language(s), bilingual exposure
- Birth/pregnancy history (optional, parent-reported, never required): prematurity, NICU stay, birth complications
- Speech/language milestones (first words, phrases, current sentence length)
- Social behaviour: eye contact, response to name, showing/sharing interest, joint attention
- Pretend play, imagination
- Repetitive movements/interests (hand-flapping, spinning, lining up toys, intense narrow interests)
- Sensory reactions (sound, touch, light, texture, taste, smell, pain)
- Food selectivity
- Sleep patterns
- Attention/focus, activity level
- Learning at home/school, teacher feedback if any
- Family history of autism/ADHD/learning differences (optional)
- **Strengths and interests** (asked early and often — this is not a deficit-hunting form)

Progress-save + resume; ~10–15 minutes; can be split across sessions; works offline and syncs later.

### 4.1b Question UX Design Patterns — "No Hard Questions" Rule

**The problem you noticed is real and well-documented:** clinicians often ask open-ended, jargon-loaded, or memory-heavy questions ("Describe your child's joint attention behaviours") that a tired, worried, non-specialist parent can't easily answer — so they either freeze, guess, or under-report. EarlySteps should never do this. Every intake question follows five hard rules:

1. **Closed-choice by default.** Multiple choice, dropdown, chip-select, or a slider/frequency scale — not a blank text box. Free text is always optional, never required.
2. **A concrete example baked into the question itself**, not hidden in a tooltip. The example does the explaining, so the parent never has to translate clinical language in their head.
3. **A support-text hint under every question** ("Not sure? Pick your best guess — you can change this later" or "This helps us understand X, not to judge anything").
4. **"I'm not sure" / "Not applicable" is always a visible option**, never a trap that forces a guess disguised as fact.
5. **One idea per question.** Never stack two behaviours into one ("Does your child make eye contact and respond to their name?") — split them, because a "sometimes" answer to a compound question is useless data.

**Before → After examples:**

| Domain | ❌ Clinician-style (hard to answer) | ✅ EarlySteps version |
|---|---|---|
| Eye contact | "Describe your child's eye contact patterns." | **"When you talk to [child] up close, do they usually look at your face?"**<br>◯ Almost always ◯ Sometimes ◯ Rarely ◯ Not sure<br>*hint: "It's okay if this varies — pick what happens most days."* |
| Response to name | "Does the child show a consistent response to name being called?" | **"If you call [child]'s name from across the room, what usually happens?"** (dropdown)<br>– Looks or comes right away<br>– Looks after 2–3 tries<br>– Doesn't seem to notice<br>– Depends on what they're doing<br>– Not sure |
| Joint attention | "Rate the child's joint attention behaviours." | **"Does [child] ever point at something just to show you, like a dog or a plane — not because they want it?"**<br>◯ Yes, often ◯ Sometimes ◯ Not that I've noticed ◯ Not sure<br>*hint: "This is different from pointing because they want something — we mean pointing just to share what they noticed."* |
| Repetitive behaviour | "Does the child exhibit stereotyped or repetitive motor mannerisms?" | **"Does [child] do the same movement over and over, like flapping hands, rocking, or spinning — especially when excited or upset?"** (chip multi-select)<br>[ Hand-flapping ] [ Rocking ] [ Spinning ] [ Lining up toys ] [ Something else ] [ None of these ] |
| Speech milestone | "At what age did the child achieve first words / two-word phrases?" | **"Roughly, when did [child] first start saying real words (not just babbling)?"** (age-range dropdown)<br>Before 12 months / 12–18 months / 18–24 months / After 2 years / Not talking with words yet / Not sure — and a follow-up slider: "About how many words does [child] use now?" (0–5 / 6–20 / 20–50 / 50+ / full sentences) |
| Sensory | "Describe any sensory sensitivities or aversions." | **"Does [child] get upset or cover their ears with loud sounds like a vacuum or hand dryer?"**<br>◯ Yes, a lot ◯ A little ◯ No ◯ Not sure — repeated as short one-idea cards for touch, light, taste/food texture, smell, so parents tap through instead of writing an essay |
| Emotional regulation | "How does the child regulate emotional dysregulation?" | **"When [child] gets very upset, what usually helps calm them down?"** (multi-select chips, optional)<br>[ Quiet space ] [ Hug/touch ] [ Favourite toy/object ] [ Nothing seems to help yet ] [ Not sure ] |

**Interaction patterns to use throughout the intake:**
- **Dropdowns** for anything with a natural range (age, frequency, word counts).
- **Chip/tag multi-select** for "which of these apply" items (repetitive behaviours, sensory triggers, calming strategies) — faster than typing and captures more than a single free-text answer would.
- **Emoji/icon sliders** (😊 → 😐 → 😣) for anything emotional or frequency-based, since they're readable even for low-literacy caregivers.
- **Big-tap yes/no/not-sure cards** for toddler-age questions — three large buttons, no scrolling.
- **Voice-to-choice option:** parent can also just speak naturally ("he does that sometimes when it's loud") and the app maps it to the closest option, showing the parent what it picked so they can correct it — best of both worlds for parents who find tapping through forms tedious.
- **Progress reassurance, not pressure:** show "Question 4 of 6 for this section" rather than a total count, and let parents skip and return — nothing should feel like an exam.
- **No timers, no "hurry up," no red error states** for unanswered optional fields.

This pattern should be applied to **every** question in the intake bank (§4.1) and to every self-report item in the observation activities (§4.2), especially for the primary-school and teen self-report flows, where wording that feels like a school test will shut kids down fast.

---

## 4.1c Full Parent Intake Question Bank

Below is the complete, ready-to-build question bank, using the closed-choice / dropdown / chip / hint pattern from §4.1b throughout. `[child]` is replaced in-app with the child's name or nickname.

Structure: **Universal questions** are asked once regardless of age. Then each **age band** has its own domain-by-domain set. Every question lists: **type**, **options**, and **hint** (the reassuring/explanatory support text shown under it). Free-text is offered as an *optional* "add anything else" box at the end of each domain section, never as the primary input.

### A. Universal Questions (asked once, any age)

**Basic profile**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| U1 | How old is [child]? | Dropdown (age picker: years + months) | — | "You can update this anytime." |
| U2 | What language(s) does your family mainly speak at home? | Chip multi-select | [English] [Spanish] [Mandarin] [Hindi] [Arabic] [French] [Other — type it] [Add another] | "Pick all that apply — it's okay if [child] hears more than one." |
| U3 | Does [child] hear more than one language regularly (e.g., from grandparents, daycare)? | Buttons | ◯ Yes ◯ No ◯ Not sure | "This just helps us understand their language environment — it's not a concern by itself." |

**Pregnancy & birth (optional section, clearly skippable)**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| U4 | Was [child] born on their due date, early, or late? | Dropdown | On time / A few weeks early / Very early (before 32 weeks) / Late / Not sure | "Totally optional — skip if you don't know or would rather not say." |
| U5 | Did [child] need any extra medical care right after birth (like a NICU stay)? | Buttons | ◯ Yes ◯ No ◯ Not sure ◯ Prefer not to say | — |
| U6 | Is there anyone else in the family — parents, siblings, cousins — with autism, ADHD, or a learning difference? | Buttons | ◯ Yes ◯ No ◯ Not sure ◯ Prefer not to say | "This helps us understand family patterns — it doesn't predict anything on its own." |

**Family & school concerns**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| U7 | What made you want to check in today? | Chip multi-select | [Something I noticed myself] [A teacher/carer mentioned something] [A doctor suggested it] [I'm just being proactive] [A family member raised it] [Other] | "There's no wrong answer — we just want to understand your starting point." |
| U8 | On a scale of how worried you feel right now, where would you put yourself? | Emoji slider | 😌 Not very worried → 😟 Very worried | "However you're feeling is valid — this just helps us support you better." |

**Strengths & interests (always asked, always first in tone)**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| U9 | What does [child] love doing most? | Chip multi-select + optional text | [Music] [Drawing/art] [Building/blocks] [Books] [Screens/videos] [Outdoor play] [Animals] [Numbers/letters] [Sports] [Other — type it] | "This isn't a small question — we build the whole support plan around what [child] already enjoys." |
| U10 | What's something [child] is really good at? | Optional short text or chip list | [Remembering details] [Being kind/gentle] [Making people laugh] [Focus on things they love] [Physical skills] [Other] | "Brag a little — this matters as much as anything else in this form." |

---

### B. Toddler (12–36 months)

**Speech & language**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T1 | Roughly when did [child] first say a real word (not babbling)? | Dropdown | Before 12mo / 12–18mo / 18–24mo / After 2 years / Not yet / Not sure | "A rough guess is perfectly fine." |
| T2 | About how many words does [child] use now, even if not always clear? | Dropdown | None yet / A few (1–5) / Some (6–20) / Many (20–50) / Short sentences (2+ words together) | — |
| T3 | Does [child] try to talk, point, or use gestures to tell you what they want? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Rarely ◯ Not sure | "Any way of communicating counts — words, sounds, pointing, or pulling you toward something." |

**Social behaviour**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T4 | When you call [child]'s name from across the room, what usually happens? | Dropdown | Looks or comes right away / Looks after a few tries / Doesn't seem to notice / Depends what they're doing / Not sure | — |
| T5 | When you talk to [child] up close, do they usually look at your face? | Buttons | ◯ Almost always ◯ Sometimes ◯ Rarely ◯ Not sure | "It's fine if this varies — pick what happens most days." |
| T6 | Does [child] ever point at something just to show you — like a dog outside — not because they want it? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Not that I've noticed ◯ Not sure | "This is different from pointing because they want something handed to them." |
| T7 | Does [child] smile back when you smile at them? | Buttons | ◯ Yes, usually ◯ Sometimes ◯ Rarely ◯ Not sure | — |

**Play**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T8 | Does [child] copy things you do, like clapping or waving bye-bye? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Rarely ◯ Not sure | — |
| T9 | Does [child] play pretend yet, like feeding a teddy bear or "talking" on a toy phone? | Buttons | ◯ Yes ◯ Starting to ◯ Not yet ◯ Not sure | "This usually starts a little later, so 'not yet' is very common at this age." |

**Repetitive behaviour**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T10 | Does [child] do the same movement over and over — like hand-flapping, rocking, or spinning — especially when excited or upset? | Chip multi-select | [Hand-flapping] [Rocking] [Spinning] [Lining up toys] [Something else] [None of these] | "Lots of toddlers do some of this sometimes — we're just building a picture." |
| T11 | Does [child] get very upset with small changes, like a different route home or a moved piece of furniture? | Buttons | ◯ Yes, a lot ◯ A little ◯ Not really ◯ Not sure | — |

**Sensory**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T12 | Does [child] get upset or cover their ears at loud sounds (vacuum, hand dryer, blender)? | Buttons | ◯ Yes, a lot ◯ A little ◯ No ◯ Not sure | — |
| T13 | Does [child] avoid certain textures — clothes tags, grass, messy play (sand, paint)? | Buttons | ◯ Yes, a lot ◯ A little ◯ No ◯ Not sure | — |

**Food & sleep**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T14 | How would you describe [child]'s eating? | Buttons | ◯ Eats a wide variety ◯ Somewhat picky ◯ Very picky / few accepted foods ◯ Not sure | — |
| T15 | How is [child] sleeping most nights? | Buttons | ◯ Sleeps well ◯ Some difficulty falling/staying asleep ◯ Significant sleep struggles ◯ Not sure | — |

**Attention**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| T16 | Can [child] focus on an activity they enjoy (like a puzzle or book) for a little while? | Buttons | ◯ Yes, several minutes ◯ Briefly ◯ Very hard to hold attention ◯ Not sure | — |

---

### C. Preschool (3–5 years)

**Speech & language**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P1 | How does [child] usually talk? | Dropdown | Full sentences / Short phrases (2–3 words) / Single words / Mostly sounds/gestures / Not yet talking | — |
| P2 | Can most people outside the family understand [child] when they talk? | Buttons | ◯ Yes, easily ◯ Sometimes, with effort ◯ Rarely ◯ Not sure | — |
| P3 | Does [child] ask questions, like "why" or "what's that"? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Rarely ◯ Not sure | — |
| P4 | Does [child] repeat words or phrases they've heard (from a show, or from you) instead of using their own words? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Rarely ◯ Not sure | "This is called 'echoing' — it's common and not something to worry about by itself." |

**Social behaviour**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P5 | When you call [child]'s name, what usually happens? | Dropdown | Looks/comes right away / After a few tries / Rarely responds / Depends on activity / Not sure | — |
| P6 | Does [child] look at your face during conversation? | Buttons | ◯ Almost always ◯ Sometimes ◯ Rarely ◯ Not sure | — |
| P7 | Does [child] enjoy playing with other children? | Buttons | ◯ Yes, seeks it out ◯ Plays alongside but not really "with" others ◯ Prefers playing alone ◯ Not sure | — |
| P8 | Does [child] show you things they're excited about (a drawing, a bug they found)? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Rarely ◯ Not sure | — |

**Play & imagination**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P9 | Does [child] play pretend — like running a "shop," being an animal, or acting out a story? | Buttons | ◯ Yes, often ◯ Sometimes ◯ Rarely/not yet ◯ Not sure | — |
| P10 | Can [child] take turns in a simple game? | Buttons | ◯ Yes, usually ◯ With reminders ◯ Struggles a lot ◯ Not sure | — |

**Emotions & faces**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P11 | Can [child] tell when you're happy, sad, or upset, just from your face or voice? | Buttons | ◯ Yes, usually ◯ Sometimes ◯ Rarely ◯ Not sure | — |

**Repetitive behaviour**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P12 | Does [child] have a movement they repeat a lot — flapping, rocking, spinning, toe-walking? | Chip multi-select | [Hand-flapping] [Rocking] [Spinning] [Toe-walking] [Lining things up] [Something else] [None of these] | — |
| P13 | Does [child] have a very intense interest in one topic (dinosaurs, trains, numbers) that's hard to shift away from? | Buttons | ◯ Yes, very intense ◯ A strong interest, but flexible ◯ Not particularly ◯ Not sure | "Strong interests are a strength too — we're just mapping the picture." |
| P14 | Does [child] get very distressed by small changes in routine? | Buttons | ◯ Yes, a lot ◯ A little ◯ Not really ◯ Not sure | — |

**Sensory & food**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P15 | Any strong reactions to loud sounds, bright lights, or certain textures? | Chip multi-select | [Loud sounds] [Bright lights] [Clothing textures] [Food textures] [Touch/hugs] [None noticed] | — |
| P16 | How would you describe [child]'s eating? | Buttons | ◯ Eats a wide variety ◯ Somewhat picky ◯ Very picky / few accepted foods ◯ Not sure | — |

**Attention & learning**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| P17 | Can [child] sit and focus on an activity they enjoy for a little while? | Buttons | ◯ Yes, several minutes+ ◯ Briefly ◯ Very hard to hold attention ◯ Not sure | — |
| P18 | Has a teacher or carer mentioned any concerns about [child]? | Buttons + optional text | ◯ Yes ◯ No ◯ Not in preschool/daycare yet | "If yes, feel free to note what they said — totally optional." |

---

### D. Primary School (6–12 years)

**Speech & language**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| PR1 | How does [child] communicate day-to-day? | Buttons | ◯ Talks in full conversations ◯ Talks but struggles with back-and-forth ◯ Mostly short answers ◯ Limited spoken language | — |
| PR2 | Does [child] understand jokes, sarcasm, or figures of speech (like "it's raining cats and dogs")? | Buttons | ◯ Yes, usually ◯ Sometimes, needs it explained ◯ Often takes things very literally ◯ Not sure | — |
| PR3 | Can [child] retell a short story or explain what happened at school? | Buttons | ◯ Yes, easily ◯ With some prompting ◯ Finds this hard ◯ Not sure | — |

**Social behaviour**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| PR4 | Does [child] have friends they regularly play or talk with? | Buttons | ◯ Yes, a few close friends ◯ Knows people but few close friendships ◯ Struggles to make/keep friends ◯ Not sure | — |
| PR5 | In a conversation, does [child] take turns talking and listening, or mostly talk about their own topics? | Buttons | ◯ Good back-and-forth ◯ Mostly talks about their own interests ◯ Rarely initiates conversation ◯ Not sure | — |
| PR6 | Does [child] pick up on how others are feeling without being told? | Buttons | ◯ Yes, usually ◯ Sometimes ◯ Often doesn't notice ◯ Not sure | — |
| PR7 | Has [child] mentioned feeling left out, different, or having trouble with friendships? | Buttons + optional text | ◯ Yes ◯ No ◯ Not sure | "If yes, a short note helps but isn't required." |

**Repetitive behaviour & interests**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| PR8 | Does [child] have an intense interest they talk about a lot, or want the same routine every day? | Buttons | ◯ Yes, very intense/rigid ◯ Strong interest, fairly flexible ◯ Not particularly ◯ Not sure | — |
| PR9 | Any repeated movements (hand movements, rocking) especially when excited, stressed, or focused? | Chip multi-select | [Hand movements] [Rocking] [Fidgeting objects] [Pacing] [Something else] [None noticed] | — |

**Sensory**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| PR10 | Any strong reactions to sounds, lights, textures, or crowded/noisy places? | Chip multi-select | [Loud sounds] [Bright lights] [Crowded spaces] [Clothing textures] [Food textures] [None noticed] | — |

**Attention & learning**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| PR11 | Can [child] focus on schoolwork or a task they don't love, without a lot of reminders? | Buttons | ◯ Yes, usually ◯ Needs frequent reminders ◯ Finds this very hard ◯ Not sure | — |
| PR12 | Has a teacher raised any concerns about [child]'s learning, behaviour, or social skills? | Buttons + optional text | ◯ Yes ◯ No ◯ Not sure | "Feel free to summarize what they said, if you'd like." |
| PR13 | How does [child] handle frustration or things not going their way? | Buttons | ◯ Copes fairly well ◯ Gets upset but recovers ◯ Big reactions, hard to calm down ◯ Not sure | — |

**Daily living**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| PR14 | Can [child] manage daily tasks for their age (dressing, packing a school bag, basic hygiene)? | Buttons | ◯ Mostly independent ◯ Needs some reminders/help ◯ Needs a lot of support ◯ Not sure | — |

---

### E. Teen (13–18 years) — asked with a parallel, gentler self-report version for the teen

**Parent version — communication & social**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| TE1 | How would you describe [teen]'s conversations with others? | Buttons | ◯ Comfortable, easy back-and-forth ◯ Can talk but finds small talk hard ◯ Prefers not to talk much with others ◯ Not sure | — |
| TE2 | Does [teen] have close friends or a consistent social group? | Buttons | ◯ Yes ◯ A little, mostly online or occasional ◯ Not really ◯ Not sure | — |
| TE3 | Does [teen] seem to notice or care about unwritten social rules (e.g., personal space, taking turns in group chats)? | Buttons | ◯ Yes, generally ◯ Sometimes misses these ◯ Often seems unaware ◯ Not sure | — |

**Parent version — interests, routine, sensory**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| TE4 | Does [teen] have a very deep, specific interest they spend a lot of time on? | Buttons | ◯ Yes, quite intense ◯ Has strong hobbies, fairly balanced ◯ Not particularly ◯ Not sure | "Deep interests are often a real strength — not just a concern flag." |
| TE5 | How does [teen] react to changes in plans or routine? | Buttons | ◯ Adjusts fairly easily ◯ Gets uncomfortable but copes ◯ Finds it very distressing ◯ Not sure | — |
| TE6 | Any strong reactions to sounds, lights, textures, or crowded places? | Chip multi-select | [Loud sounds] [Bright lights] [Crowded places] [Clothing textures] [None noticed] | — |

**Parent version — emotional & daily living**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| TE7 | How does [teen] cope with stress or frustration? | Buttons | ◯ Manages fairly well ◯ Struggles but has some coping strategies ◯ Very difficult to manage ◯ Not sure | — |
| TE8 | Has [teen] mentioned feeling anxious, low, different from peers, or misunderstood? | Buttons + optional text | ◯ Yes ◯ No ◯ Not sure | "If comfortable, a short note helps — no pressure to share details." |
| TE9 | Can [teen] independently manage things like their schedule, hygiene routine, or basic responsibilities for their age? | Buttons | ◯ Mostly independent ◯ Needs some support ◯ Needs a lot of support ◯ Not sure | — |

**Teen self-report version (optional, gentler tone, same domains, asked directly to the teen with parent permission)**
| # | Question | Type | Options | Hint |
|---|---|---|---|---|
| TS1 | How do you usually feel in group conversations? | Buttons | 😊 Comfortable / 😐 It's okay / 😣 Draining or hard | "There's no right answer — just what feels true for you." |
| TS2 | Do you ever feel like you're missing social cues other people seem to just "get"? | Buttons | ◯ Often ◯ Sometimes ◯ Not really | — |
| TS3 | Is there a topic or hobby you could talk about for hours? | Optional text or chips | [Yes — tell us] [Not really] | "We'd genuinely love to know — this helps us understand you, not judge you." |
| TS4 | Do loud places, bright lights, or certain textures ever feel overwhelming? | Chip multi-select | [Loud places] [Bright lights] [Textures/clothes] [Crowds] [None of these] | — |
| TS5 | How do you usually calm down when you're stressed or upset? | Optional text or chips | [Alone time] [Music] [Physical activity] [Talking to someone] [My hobby/interest] [Nothing really helps yet] | — |

---

### 4.2 Module 2 — Child Observation Activities (age-banded)

| Age band | Sample activities |
|---|---|
| **Toddler (12–36mo)** | Name-response check ("call child's name 3x, observe"), point-and-name objects, simple 1-step instruction ("give me the ball"), imitation game (clap, wave), sensory preference tap-choice (soft/loud icons), parent-guided pretend play prompt (feed the teddy) |
| **Preschool (3–5y)** | Describe-a-picture (show image, record response), 2-step instruction, emotion-face matching game, turn-taking bubble-pop game, "what happens next" story picture sequence, simple motor imitation (hop, spin arms), daily-living checklist (dresses self, uses spoon) |
| **Primary (6–12y)** | Retell a short story (audio/text), conversation turn-taking mini chat with AI avatar, social-scenario questions ("your friend is sad, what do you do?"), visual pattern/sequence puzzle, writing/typing sample, sensory checklist self-report, daily-living checklist (ties shoes, packs bag) |
| **Teen (13–18y)** | Self-report questionnaire (with parent supplement), social scenario reasoning (text-based), written reflection prompt, sensory/emotional regulation self-checklist, independence/daily-living self-assessment, optional peer-relationship questions |

All activities are **recorded as structured responses** (multiple choice, short audio, short video *only with explicit consent*, drawing/typing). Nothing is scored as "pass/fail" — everything maps to a domain profile.

### 4.3 Module 3 — AI Analysis Engine
Produces a structured profile (see §8 Scoring Logic and §9 Prompts) across 7 domains + strengths, with a support-level estimate and a confidence rating. Every AI-generated sentence must be traceable to a specific intake answer or activity result (no invented claims) and phrased in the respectful vocabulary of §3.2.

### 4.4 Module 4 — Results Page
- One-screen plain-language summary ("Here's what we noticed")
- Traffic-light bar per domain (green/amber/red = low/some/many signs) — **never** a single autism-likelihood number
- Top 5 strengths (always shown first, above support needs)
- Top 5 support needs
- "This week" — 3 small, doable actions
- "What to track next" — 2–3 things to observe
- Clear assessment-recommendation banner when triggered

### 4.5 Module 5 — Home Support Plan (4-week rolling plan)
- Daily 10-minute activity, rotating across: speech/language, social communication, sensory regulation, emotional regulation, independence/daily living
- Ready-made **parent scripts** ("Say: 'First brush teeth, then story time'")
- Reward-system templates (sticker chart, token board)
- Weekly checklist + gentle reminder notifications
- Library of named routines: *Look-Point-Name*, *First-Then board*, *Picture choice board*, *Emotion cards*, *Turn-taking games*, *Story retelling*, *Role-play kits* (shop/bus/school/doctor), *Calm-down breathing routine*, *Visual daily schedule*

### 4.6 Module 6 — Progress Tracking
Weekly/biweekly micro check-ins (2–3 minutes) tracking: speech clarity, word/sentence count, name-response, eye-contact comfort, social response, frustration/meltdown frequency, sensory triggers, sleep, food, school/teacher feedback, free-text parent notes, and optional audio/video samples (opt-in, auto-expiring). Visual trend graphs, not just numbers — parents see *movement*, not a grade.

### 4.7 Module 7 — Privacy & Safety
- Explicit, plain-language consent screens (separate consent for: data storage, AI analysis, audio/video capture, sharing with a professional)
- All child data encrypted at rest and in transit; media encrypted with per-family keys
- No data sold, no third-party ad targeting, no data broker sharing — ever
- One-tap "Delete everything" with real deletion (not soft-delete) and confirmation
- "How the AI works and its limits" explainer, always accessible
- Media (audio/video) storage is **opt-in only**, auto-deleted after a parent-set window (default 90 days) unless explicitly saved
- Offline-first core flows (intake, activities, plan viewing) with sync-when-connected

### 4.8 Module 8 — Red-Flag Escalation
Calm, non-alarming, but clear. Triggered by specific patterns (loss of previously-acquired words/skills, no response to name after repeated well-conducted attempts, no functional communication method at all, signs of self-injury risk, severe feeding/growth concern, severe sleep disruption, sudden significant behaviour change, any safety concern) →
> *"Some of what you've shared suggests your child may benefit from being seen soon by a doctor. This doesn't mean something is seriously wrong — it means a professional should take a closer look. Here's what to do next: [steps + local resource finder]."*
Self-injury-risk or immediate-safety triggers surface an additional calm resource block with local emergency guidance (no diagnostic language, no shaming).

### 4.9 Module 9 — Screens (see §5)

---

## 5. Screen-by-Screen Design

1. **Splash/Onboarding** — warm illustration, 3 slides: "You're not alone" / "This is a screening & support tool, not a diagnosis" / "Free, private, at your pace"
2. **Consent Center** — layered consent (data storage / AI use / media capture / professional sharing), each togglable, each with a 1-line plain explanation
3. **Child Profile Setup** — name/nickname, age, language(s), avatar picker (no photo required)
4. **Parent Questionnaire** — chat-style or form-style toggle, progress bar, save & resume, voice input option
5. **Child Activity Hub** — age-appropriate activity cards, "Play a game with [child]" framing, timer-free (no pressure)
6. **Observation Recorder** — audio/photo/video capture screen with a persistent consent reminder and a "skip, I'll describe instead" option
7. **AI Summary (Results)** — traffic-light domain bars, strengths-first layout, disclaimer banner pinned at top
8. **Support Plan** — weekly calendar view, today's activity card, script + reward + checklist
9. **Progress Dashboard** — trend graphs per tracked metric, milestone celebration moments
10. **Parent Learning Library** — bite-size articles/videos ("What is joint attention?", "How to find a free assessment near you"), searchable, offline-downloadable
11. **Reports** — exportable PDF summary for paediatrician/school (see §6)
12. **Settings** — language, notifications, offline mode, accessibility (font size, voice speed, high-contrast)
13. **Privacy Controls** — view stored data, delete data, manage media retention window, export data (data portability)

---

## 6. Technical Architecture

| Layer | Recommendation | Why |
|---|---|---|
| Mobile framework | **React Native (Expo)** | Single codebase for iOS/Android, strong offline-storage tooling, wide low-end-device support |
| Backend | **Node.js/NestJS** on a managed cloud (or self-hosted for cost control) | Typed, scalable, good for modular services (intake, scoring, plan-gen) |
| Database | **PostgreSQL** (structured profiles/scores) + **object storage** (S3-compatible, encrypted) for opt-in media | Relational integrity for longitudinal tracking + cheap encrypted blob storage |
| AI model use | LLM (Claude) for: question generation/adaptation, free-text analysis, summary writing, plan generation, coaching chatbot — **always constrained by a rules-based scoring layer**, never the sole decision-maker on support level | Keeps a deterministic, auditable scoring core; LLM handles language, not the clinical judgment threshold |
| Speech-to-text | On-device (e.g., Whisper-tiny/base, quantized) for offline transcription, with optional cloud fallback | Privacy + offline support + low bandwidth cost |
| Image/video analysis | Only run **after explicit per-instance consent**; processed then discarded unless parent chooses to retain | Minimizes sensitive-data footprint |
| Offline storage | SQLite (mobile) + background sync queue | Core flows work with no connectivity |
| Security | End-to-end encryption for media, encryption-at-rest for DB, role-based access, audit logs, no plaintext PII in logs | Child health data = highest sensitivity tier |
| Admin dashboard | Web app for content team: manage question banks, activity libraries, translations, red-flag rule tuning | Non-engineers can update clinical content without app releases |
| Report generation | Server-side PDF generation (e.g., a headless templating service) producing a clinician-readable summary (domain scores, timeline, parent-reported history, NOT a diagnosis) | Bridges the app to real-world formal assessment |

---

## 7. Data Model (simplified)

```
Family
 ├─ id, consent_flags{}, locale, low_bandwidth_mode
 └─ Children[]
     ├─ id, nickname, age_band, languages[]
     ├─ IntakeResponses[] (domain, question_id, answer, timestamp)
     ├─ ActivityResults[] (activity_id, age_band, modality, response_data, timestamp)
     ├─ DomainProfile (communication, social, repetitive_behaviour, sensory,
     │                 learning, attention, motor, emotional_regulation,
     │                 daily_living) → {level: low/some/many, confidence, evidence_refs[]}
     ├─ SupportLevelEstimate (mild/moderate/high, confidence)
     ├─ RedFlags[] (type, triggered_at, resolved_bool)
     ├─ SupportPlans[] (week_number, tasks[], scripts[], rewards[], checklist_state)
     ├─ ProgressLogs[] (metric, value, timestamp, note)
     ├─ MediaAssets[] (type, consent_id, retention_expiry, encrypted_uri) [opt-in]
     └─ Reports[] (generated_at, pdf_uri, shared_with[])
```

---

## 8. Scoring Logic

**Principle: deterministic, transparent, auditable — the LLM explains scores, it does not invent them.**

1. Each intake question and activity result maps to one or more **domain indicators** with a weighted point value (weights derived from CDC/AAP milestone importance and NICE red-flag weighting — heavier weight on well-evidenced items like loss-of-skills or no-name-response).
2. Domain score = sum of triggered indicator weights, normalized 0–100, then bucketed:
   - 0–33 → **Low signs observed**
   - 34–66 → **Some signs observed**
   - 67–100 → **Many signs observed**
3. **Confidence** is separate from score: based on (a) completeness of intake, (b) number of corroborating data points (parent report + activity + optional teacher input), (c) consistency across sources. Sparse data → confidence capped at "low" regardless of score.
4. **Support-level estimate** (mild/moderate/high) = weighted combination of domain scores, biased toward the two heaviest-evidence NICE/DSM-5 domains (social communication, repetitive/restricted behaviours), cross-checked against daily-living/independence scores.
5. **Red-flag rules are independent of the scoring model** — they are hard triggers (e.g., "loss of previously acquired words" = immediate escalation regardless of overall score), so a single serious sign can never get diluted into a "low" average.
6. Any score is recomputed, never silently overwritten, each time new data arrives — full history retained for trend graphs and for the eventual clinician report.

---

## 9. LLM Prompting System

> All prompts are used as the *language layer* on top of the deterministic scoring engine above. The LLM is never asked to output a diagnosis, a numeric autism-likelihood score, or unhedged clinical claims. Every system prompt below includes the same non-negotiable guardrail block.

**Shared guardrail block (prepended to every system prompt):**
```
You are a supportive, respectful assistant inside a family developmental-screening app.
Rules you must never break:
1. Never state or imply a diagnosis ("your child is/is not autistic/has autism").
2. Only use these result labels: "Low signs observed", "Some signs observed",
   "Many signs observed", "Support activities can begin now",
   "Formal assessment is recommended", "Formal assessment strongly recommended soon".
3. Only use these support-level terms: mild support needs, moderate support needs,
   high support needs — always paired with a confidence level (low/medium/high).
4. Never use words like defect, abnormal, disorder-as-label, broken, wrong, deficient.
   Use: support needs, developmental differences, communication differences,
   sensory needs, learning style.
5. Always lead with strengths before support needs.
6. Base every statement only on the structured data provided to you. Never invent
   facts, milestones, or observations not present in the input.
7. Keep tone warm, calm, plain-language (aim for a caregiver reading level, not
   clinical jargon), and never alarmist.
8. If the input includes a red-flag trigger, calmly and clearly recommend prompt
   professional follow-up without causing panic.
```

**9.1 Parent Questionnaire Generation**
```
Task: Given the child's age_band and any prior answers, select/adapt the next
3-5 intake questions from the approved question bank for [age_band] covering
domains not yet sufficiently answered: [list of under-covered domains].
Phrase each question in warm, concrete, example-based parent language
(e.g., "Does [child] point to show you something interesting, like a bird or a
plane?"). Output as JSON: [{id, domain, text, response_type}].
Do not introduce new clinical criteria not present in the approved bank.
```

**9.2 Child Response Analysis**
```
Task: Given one child activity result (age_band, activity_type, raw response
data), extract structured indicators relevant to domain: [domain].
Output JSON: {indicators: [{indicator_id, present: bool, evidence_quote}],
notes: plain-language 1-sentence observation using approved vocabulary}.
Do not assign a score yourself — scoring is handled by the deterministic engine.
```

**9.3 Autism-Sign Screening Summary (Results Page copy)**
```
Task: Given the computed DomainProfile (levels + confidence per domain),
SupportLevelEstimate, and top evidence_refs, write the Results Page copy:
- 2-sentence plain-language overall summary
- top 5 strengths (from evidence with positive/typical indicators)
- top 5 support needs (respectful phrasing)
- 3 "this week" actions
- 2-3 "what to track next" items
Always include the fixed disclaimer sentence verbatim:
"This is a screening tool, not a diagnosis. Only a qualified professional can
diagnose autism."
```

**9.4 Support Plan Generation**
```
Task: Given DomainProfile and family context (age_band, home language,
available time, siblings/support at home), generate a 4-week home plan.
For each week, choose 5-7 activities from the approved activity library
matched to the highest-need domains, balanced with at least one strength-based
"confidence building" activity. Include a parent script (verbatim short phrase),
a reward suggestion, and a 1-line "why this helps" note per activity.
Output structured JSON matching the SupportPlans schema.
```

**9.5 Progress Comparison**
```
Task: Given ProgressLogs across two or more time points for the same metrics,
summarize the trend in plain language (improving / steady / worth watching —
never "worsening" in alarmist tone; use "this is an area to keep an eye on").
Highlight one genuine positive change first. Flag if a metric matches a
red-flag rule (regression pattern) and route to the escalation module.
```

**9.6 Parent Coaching Chatbot**
```
Task: You are a warm, practical coaching companion for a parent using this app.
Answer questions about the child's activities, plan, or general development
using only the approved knowledge base and the child's own DomainProfile/plan
data provided in context. If asked "does my child have autism," respond with
empathy and redirect to: "I can't answer that — only a qualified professional
can. Here's what I can tell you from what we've observed so far... and here's
how to find an assessment near you." Never speculate beyond provided data.
```

**9.7 Clinician Report Generation**
```
Task: Given full DomainProfile history, IntakeResponses, ActivityResults, and
ProgressLogs for a child, generate a structured, factual summary suitable for
a paediatrician or specialist: parent-reported history, observed patterns by
domain (with dates and evidence), support level estimate with confidence,
red-flags triggered and when. Use neutral clinical-adjacent but non-diagnostic
language. End with: "This report is generated from a parent-facing screening
app and is intended to support, not replace, formal clinical assessment."
```

---

## 10. Consolidated Safety Rules

1. No diagnostic claims, ever, in any surface (UI copy, AI output, PDF reports, notifications).
2. Every result screen and report carries the disclaimer.
3. Confidence level always shown next to any finding.
4. Strengths always shown before/alongside support needs, never omitted.
5. Red-flag rules are hard-coded and independent of the general scoring model.
6. Escalation language is calm, specific, and action-oriented — never fear-based.
7. All media capture is opt-in, purpose-limited, time-boxed, and deletable.
8. No selling or third-party sharing of data; sharing with a professional requires a separate explicit action by the parent.
9. AI limitations are explained in plain language and always accessible from Settings and the Results page.
10. A visible, one-tap path to crisis/urgent-care resources is present wherever a self-injury or safety red flag is shown — kept calm and practical, not alarmist.

---

## 11. MVP vs. Advanced Version

**MVP (Phase 1 — 3–4 months):**
- Parent intake (toddler + preschool age bands only)
- 10–12 core observation activities (text/tap/audio only, no video)
- Deterministic scoring engine + LLM-written results summary
- Results page with traffic lights, strengths, support needs, disclaimer
- Basic 4-week support plan (static library, lightly personalized)
- Simple progress tracker (5 key metrics, manual log)
- Red-flag escalation (rule-based, core triggers only)
- Consent center, data deletion, offline core flows
- 2 languages at launch (chosen by target market)

**Advanced (Phase 2+):**
- Primary school + teen age bands, self-report flows
- Video-based activities with on-device analysis (opt-in)
- Full parent coaching chatbot
- Clinician-facing PDF report generation + secure share link
- Teacher/community-health-worker bulk mode
- Multi-language expansion (10+), voice-first UI for low-literacy caregivers
- Wearable/sleep-tracker integrations (optional, opt-in)
- Community support groups / peer forums (moderated)
- Adaptive question banks that learn which questions are most informative per region

---

## 12. Monetisation for Low-Income Families

- **Freemium core, never paywalled at the safety layer:** intake, screening, results, red-flag escalation, and basic support plan are **always free**.
- **Optional low-cost tier** (e.g., $1–3/month or local-equivalent, with automatic fee waivers on self-reported low income, no verification friction): unlocks extended activity library, PDF reports, multi-child profiles, advanced progress analytics.
- **NGO/government/insurer sponsorship model:** health ministries, school districts, or NGOs can sponsor free premium access for a region/school in bulk (B2B2C), keeping the parent-facing product free.
- **No ads, ever, targeting children or families based on health data** — a small number of general, non-targeted ethical sponsorships (e.g., "supported by [children's health foundation]") are acceptable if fully separated from data use.
- **Grant/philanthropic funding** for initial development and ongoing free-tier subsidy, given the explicit equity mission.

---

## 13. Launch Plan

1. **Clinical advisory review** — partner with 2–3 developmental paediatricians/SLPs/psychologists (ideally from underserved regions) to review every question, activity, scoring weight, and piece of result/escalation copy before any public release.
2. **Closed pilot (100–300 families)** in one language/region, partnered with a community clinic or NGO for real-world validation and to catch tone/comprehension issues.
3. **Pilot outcome review** — compare app-flagged "formal assessment recommended" cases against actual clinical outcomes where families consented to share, to sanity-check the scoring weights (not to "prove" diagnostic accuracy — the tool doesn't diagnose).
4. **Soft public launch** in pilot region/language, with in-app feedback loop and a visible "report a concern about this app" channel.
5. **Iterate** on question banks, activity library, and translations based on real usage and clinician feedback.
6. **Scale** to additional languages/regions, add age bands, begin B2B2C sponsorship conversations with NGOs/ministries of health.

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Parents misread screening result as a diagnosis | Persistent disclaimers, careful copy review, no numeric "likelihood" scores shown, clinical advisory sign-off on all result copy |
| Over- or under-flagging support needs (false reassurance or unnecessary alarm) | Deterministic, clinically-weighted scoring engine (not LLM-only), confidence levels always shown, pilot validation against real outcomes, red-flags hard-coded separately from general scoring |
| Sensitive child health data breach | Encryption at rest/in transit, opt-in-only media, short retention windows, no plaintext PII in logs, regular security audits |
| App used as a substitute for care rather than a bridge to it | Constant "next step" framing toward formal assessment, resource-finder for free/low-cost local assessment services, no design pattern that discourages seeking professional help |
| Cultural/language mismatch in questions or activities | Local clinical advisors per region, community pilot before wider release, avoid direct literal translation — culturally adapt examples |
| Low-literacy or low-tech-access caregivers excluded | Voice-first input, icon-based UI, offline mode, low-data-usage design, community health worker-assisted mode |
| AI hallucinating clinical-sounding claims | Guardrail system prompt on every call, strict "only from provided data" instruction, deterministic scoring layer as source of truth, human clinical review of prompt outputs pre-launch |
| Families in acute crisis (self-harm risk) mishandled by an automated tool | Immediate, calm, resource-forward escalation path; never attempt to counsel crisis situations within the coaching chatbot; always route to real human/professional resources |
| Regulatory classification as a medical device in some jurisdictions | Legal review per market; explicit "wellness/screening support tool, not a medical device" positioning; avoid diagnostic claims in all marketing and store listings; consult local health-app regulations before each regional launch |

---

*End of product plan. This document is a starting design framework — every piece of clinical content, wording, and scoring weight must be reviewed and signed off by qualified paediatric/developmental professionals before real families use it.*
