# Plan: STEM Lesson Content — Form 4 & Form 5 (KSSM)

**Date:** 2026-05-17  
**Author:** Planner agent  
**Goal:** Replace the 4 thin demo lessons with a rich, curriculum-aligned lesson+exercise catalogue covering Form 4 and Form 5 STEM subjects, drawn from the Malaysian KSSM textbook PDFs in `downloads/gurubesar-kssm-textbooks/`.

---

## Background & Findings

### Source material
| Location | What it contains |
|---|---|
| `downloads/gurubesar-kssm-textbooks/Tingkatan 4/STEM/` | PDF textbooks: Biology, Chemistry, Physics, Mathematics, Additional Mathematics, Science, Computer Science, Technical Graphics, Reka Cipta, Agriculture, Home Science, Sports Science, Asas Kelestarian |
| `downloads/gurubesar-kssm-textbooks/Tingkatan 5/STEM/` | Same subjects for Form 5 |
| `downloads/elaborated/Tingkatan 4/STEM/*.elaborated.json` | Pre-processed stubs — all core STEM lessons have 0 elaborations; only Agriculture & Asas Kelestarian have any content |
| `downloads/elaborated/Tingkatan 5/STEM/*.elaborated.json` | Same — sparse |

**Conclusion:** The elaborated JSON files are essentially empty for the priority subjects (Biology, Chemistry, Physics, Math, Computer Science). All new lesson content must be written from scratch, guided by the KSSM curriculum topic list inferred from the textbook structure.

### Database schema (relevant tables)
- `syllabus_items` — one row per topic/subtopic (subject, form_level, topic, subtopic, order_index)
- `lessons` — one row per teachable unit (title, content JSONB `{summary, blocks:[]}`, subject, form_level, difficulty, estimated_minutes)
- `lesson_syllabus_links` — many-to-many junction
- `quiz_questions` — exercises attached to a lesson (question_text, question_type, options JSONB, correct_answer JSONB, explanation, points, order_index)
- `progress` — student completion tracking (untouched by this plan)

### Existing seed data to remove
The `backend/scripts/seed-demo.js` inserts 4 demo lessons (Math, Science, English, History) plus linked syllabus items, quiz questions, classroom assignments, and progress records. All must be wiped before the new content is inserted.

### Content scope (priority order)
**Wave 0 priority (core SPM subjects):**
1. Biology (Biologi) — Form 4 & 5
2. Chemistry (Kimia) — Form 4 & 5
3. Physics (Fizik) — Form 4 & 5
4. Mathematics (Matematik) — Form 4 & 5
5. Additional Mathematics (Matematik Tambahan) — Form 4 & 5

**Wave 1 priority:**
6. Science (Sains) — Form 4 & 5
7. Computer Science (Sains Komputer) — Form 4 & 5

**Wave 2 (if capacity allows):**
8. Additional Science, Technical Graphics, Reka Cipta, Agriculture, Asas Kelestarian

### Content design principles
- Each lesson = one KSSM subtopic (e.g. "1.1 Organisasi Sel")
- **Lesson content blocks** (in order):
  1. `section` block — concept explanation (3–5 sentences, plain language)
  2. `section` block — worked example or real-world analogy
  3. `section` block — common misconceptions / things to watch out for
  4. `section` block — key terms table (term → definition, formatted as markdown table in `body`)
  5. `section` block — memory aid / mnemonic
- **Exercises** (5–7 per lesson, mixed types):
  - 2× `multiple_choice` (factual recall)
  - 1× `true_false` (misconception probe)
  - 1× `numeric` (calculation, for Math/Physics/Chemistry) OR `representation_match` (for Bio/CS)
  - 1× `step_order` (procedural knowledge)
  - 1× `error_diagnosis` (higher-order thinking)
  - Optional 1× `scenario` (application)
- Language: **English** for Biology & Physics (matching textbook edition); **Malay** for Chemistry, Mathematics, Add Math, Computer Science
- Difficulty distribution per subject: 40% easy, 40% medium, 20% hard
- `estimated_minutes`: easy=12, medium=18, hard=25

---

## KSSM Topic Map (lessons to create)

### Form 4 — Biology (18 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Cell as a Unit of Life | Cell organisation | easy |
| 2 | Cell as a Unit of Life | Cell structure & organelles | medium |
| 3 | Cell as a Unit of Life | Cell membrane & transport | medium |
| 4 | Cell Division | Mitosis — stages & significance | medium |
| 5 | Cell Division | Meiosis — stages & significance | medium |
| 6 | Nutrition | Types of nutrition in living things | easy |
| 7 | Nutrition | Human digestive system | medium |
| 8 | Nutrition | Absorption & assimilation | hard |
| 9 | Respiration | Aerobic vs anaerobic respiration | medium |
| 10 | Respiration | Human respiratory system | easy |
| 11 | Respiration | Gaseous exchange mechanism | medium |
| 12 | Dynamic Ecosystem | Population & community | easy |
| 13 | Dynamic Ecosystem | Food webs & energy flow | medium |
| 14 | Dynamic Ecosystem | Carbon & nitrogen cycles | hard |
| 15 | Endangered Ecosystem | Threats to biodiversity | easy |
| 16 | Endangered Ecosystem | Conservation strategies | medium |
| 17 | Coordination & Response | Nervous system | medium |
| 18 | Coordination & Response | Endocrine system | hard |

### Form 4 — Chemistry (14 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Matter | Particle theory & states of matter | easy |
| 2 | Matter | Elements, compounds & mixtures | easy |
| 3 | Atomic Structure | Proton, neutron, electron | easy |
| 4 | Atomic Structure | Electron configuration | medium |
| 5 | Chemical Formulae & Equations | Writing formulae | medium |
| 6 | Chemical Formulae & Equations | Balancing equations | medium |
| 7 | Periodic Table | Periods & groups | easy |
| 8 | Periodic Table | Properties of alkali metals & halogens | medium |
| 9 | Chemical Bonds | Ionic bonding | medium |
| 10 | Chemical Bonds | Covalent bonding | medium |
| 11 | Electrochemistry | Electrolysis concept | medium |
| 12 | Electrochemistry | Electrolysis of solutions | hard |
| 13 | Acids, Bases & Salts | Properties & pH | easy |
| 14 | Acids, Bases & Salts | Salt preparation methods | hard |

### Form 4 — Physics (14 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Measurement | SI units & scientific notation | easy |
| 2 | Measurement | Vernier caliper & micrometer | medium |
| 3 | Forces & Motion | Distance, displacement, speed, velocity | easy |
| 4 | Forces & Motion | Acceleration & equations of motion | medium |
| 5 | Forces & Motion | Newton's Laws | medium |
| 6 | Forces & Motion | Momentum & impulse | hard |
| 7 | Pressure | Pressure in solids & fluids | medium |
| 8 | Pressure | Atmospheric pressure & applications | medium |
| 9 | Energy | Forms & conservation of energy | easy |
| 10 | Energy | Work, power & efficiency | medium |
| 11 | Waves | Properties of waves | easy |
| 12 | Waves | Light reflection & refraction | medium |
| 13 | Electricity | Current, voltage & resistance | medium |
| 14 | Electricity | Series & parallel circuits | hard |

### Form 4 — Mathematics (10 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Functions | Function notation & types | easy |
| 2 | Functions | Composite & inverse functions | medium |
| 3 | Quadratic Functions | Vertex form & graph | medium |
| 4 | Quadratic Functions | Solving quadratic equations | medium |
| 5 | Systems of Equations | Simultaneous linear equations | medium |
| 6 | Indices & Logarithms | Laws of indices | easy |
| 7 | Indices & Logarithms | Laws of logarithms | medium |
| 8 | Coordinate Geometry | Distance, midpoint, gradient | easy |
| 9 | Coordinate Geometry | Equation of straight line | medium |
| 10 | Statistics | Measures of central tendency & dispersion | hard |

### Form 4 — Additional Mathematics (10 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Functions | Relations & functions | medium |
| 2 | Quadratic Equations | Discriminant & nature of roots | medium |
| 3 | Quadratic Inequalities | Solving & number line | medium |
| 4 | Simultaneous Equations | Linear-nonlinear systems | hard |
| 5 | Indices & Logarithms | Change of base & equations | hard |
| 6 | Coordinate Geometry | Locus & equations of circle | hard |
| 7 | Statistics | Permutations & combinations | medium |
| 8 | Statistics | Probability theory | medium |
| 9 | Differentiation | Gradient function & rules | hard |
| 10 | Integration | Definite & indefinite integrals | hard |

### Form 4 — Science (8 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Cell & Living Processes | Cell structure overview | easy |
| 2 | Forces & Motion (applied) | Newton in everyday life | easy |
| 3 | Energy | Renewable energy sources | easy |
| 4 | Biodiversity | Classification of living things | medium |
| 5 | Matter | Chemical & physical changes | easy |
| 6 | Reproduction | Asexual & sexual reproduction | medium |
| 7 | Technology | Smart materials | medium |
| 8 | Health | Infectious diseases & immunity | medium |

### Form 4 — Computer Science (8 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Computational Thinking | Decomposition & pattern recognition | easy |
| 2 | Computational Thinking | Abstraction & algorithms | medium |
| 3 | Programming Basics | Variables, data types, operators | easy |
| 4 | Programming Basics | Control structures (if/loop) | medium |
| 5 | Data Structures | Arrays & lists | medium |
| 6 | Networks | Network types & protocols | medium |
| 7 | Cybersecurity | Threats & protective measures | easy |
| 8 | Information Systems | Database concepts | medium |

### Form 5 — Biology (15 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Transport | Blood composition & functions | easy |
| 2 | Transport | Heart structure & cardiac cycle | medium |
| 3 | Transport | Blood vessels & circulation | medium |
| 4 | Transport in Plants | Xylem & phloem | medium |
| 5 | Immunity | Specific & non-specific immunity | medium |
| 6 | Immunity | Vaccination & antibiotics | easy |
| 7 | Reproduction | Male & female reproductive systems | medium |
| 8 | Reproduction | Fertilisation & development | hard |
| 9 | Growth | Growth patterns & hormones | medium |
| 10 | Heredity | Mendel's laws | medium |
| 11 | Heredity | Genetics terminology & crosses | hard |
| 12 | Variation | Continuous vs discontinuous variation | easy |
| 13 | Biotechnology | Genetic engineering overview | hard |
| 14 | Biotechnology | Applications in medicine & agriculture | medium |
| 15 | Homeostasis | Osmoregulation & thermoregulation | hard |

### Form 5 — Chemistry (10 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Rate of Reaction | Factors affecting rate | medium |
| 2 | Rate of Reaction | Collision theory & catalysts | hard |
| 3 | Carbon Compounds | Alkanes & alkenes | easy |
| 4 | Carbon Compounds | Polymers & plastics | medium |
| 5 | Oxidation & Reduction | Redox reactions | medium |
| 6 | Oxidation & Reduction | Rusting & prevention | easy |
| 7 | Thermochemistry | Exo- & endothermic reactions | medium |
| 8 | Thermochemistry | Heat of combustion & neutralisation | hard |
| 9 | Chemicals in Industry | Haber process & Contact process | hard |
| 10 | Chemicals in Industry | Alloys & synthetic polymers | medium |

### Form 5 — Physics (10 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Magnetism | Magnetic fields & flux density | easy |
| 2 | Electromagnetism | Faraday's law & induction | medium |
| 3 | Electromagnetism | Transformers & AC/DC | hard |
| 4 | Electronics | Semiconductor diodes & rectification | medium |
| 5 | Electronics | Transistor as a switch & amplifier | hard |
| 6 | Nuclear Physics | Radioactive decay & half-life | medium |
| 7 | Nuclear Physics | Fission, fusion & nuclear energy | hard |
| 8 | Thermodynamics | Gas laws (Boyle, Charles, Gay-Lussac) | medium |
| 9 | Waves | Sound waves & interference | medium |
| 10 | Optics | Lenses & optical instruments | medium |

### Form 5 — Mathematics (8 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Circular Measure | Radian & arc length | medium |
| 2 | Trigonometry | Sine, cosine, tangent rules | medium |
| 3 | Permutations & Combinations | Counting principles | medium |
| 4 | Probability | Probability distributions | hard |
| 5 | Matrices | Matrix operations & inverse | medium |
| 6 | Vectors | Vector operations in 2D | medium |
| 7 | Linear Programming | Formulating & solving LP problems | hard |
| 8 | Networks (Graphs) | Graph theory basics | medium |

### Form 5 — Additional Mathematics (10 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Circular Measure | Sector area & arc length | medium |
| 2 | Differentiation | Chain, product & quotient rules | hard |
| 3 | Integration | Area under curve & between curves | hard |
| 4 | Kinematics | Displacement, velocity, acceleration functions | hard |
| 5 | Trigonometric Functions | Graphs & transformations | medium |
| 6 | Permutations & Combinations | Advanced counting | medium |
| 7 | Probability Distributions | Binomial & normal distributions | hard |
| 8 | Vectors | Dot product & applications | hard |
| 9 | Linear Programming | Optimisation problems | hard |
| 10 | Motion Graphs | Interpreting displacement-time graphs | medium |

### Form 5 — Computer Science (7 lessons)
| # | Topic | Subtopic | Difficulty |
|---|---|---|---|
| 1 | Object-Oriented Programming | Classes, objects, encapsulation | medium |
| 2 | Object-Oriented Programming | Inheritance & polymorphism | hard |
| 3 | Algorithms | Sorting algorithms (Bubble, Selection) | medium |
| 4 | Algorithms | Searching algorithms | medium |
| 5 | Networks | Internet protocols & security | medium |
| 6 | Artificial Intelligence | ML concepts & applications | medium |
| 7 | Ethics in Computing | Privacy, IP, cybercrime | easy |

**Total lessons to create: ~152 lessons, ~760–1,064 quiz questions**

---

## Implementation Tasks

---

### Wave 0 — Blocking Tasks (must complete before anything else)

#### Task 0.1 — DB Migration: wipe demo content `[BLOCKING]`
**File:** `database/migrations/016_wipe_demo_lessons.sql`  
Write a migration that deletes all rows from `quiz_questions`, `progress`, `classroom_lessons`, `lesson_syllabus_links`, `lessons`, and `syllabus_items` in foreign-key-safe order. Also reset any auto-sequences if applicable. This must run first so the new seed has a clean slate.

**Dependency:** None — this is the starting gate.

#### Task 0.2 — Seed Script Scaffold `[BLOCKING]`
**File:** `backend/scripts/seed-stem-lessons.js` (new file)  
Create the scaffold of the new seed script: DB connection, transaction wrapper, helper functions `insertSyllabus(subject, formLevel, topic, subtopic, orderIndex)`, `insertLesson(syllabusId, title, subject, formLevel, difficulty, blocks)`, `insertQuestion(lessonId, type, question, options, correct, explanation, points, order)`, and a `main()` function that calls them in subject batches. No actual lesson data yet — just the wiring. Depends on Task 0.1 defining what gets cleared.

**Dependency:** Task 0.1 (migration must define cleared state).

---

### Wave 1 — Parallel Content Batches

All Wave 1 tasks share no files with each other. Each is a self-contained content module appended into the seed script as a named function. They can be handed to separate agents simultaneously.

**Dependency for all Wave 1 tasks:** Task 0.2 (seed scaffold must exist first).

#### Task 1.1 — Form 4 Biology Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4Biology(client)` — 18 lessons as mapped above. Each lesson: 5 content blocks (section: concept, worked example, misconceptions, key terms, mnemonic), 6 quiz questions (2× multiple_choice, 1× true_false, 1× representation_match, 1× step_order, 1× error_diagnosis). Language: English. Subject string: `"Biology"`.

#### Task 1.2 — Form 4 Chemistry Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4Chemistry(client)` — 14 lessons. Numeric questions for mole calculations, balancing equations (error_diagnosis), periodic table comparisons (representation_match). Language: Malay. Subject string: `"Kimia"`.

#### Task 1.3 — Form 4 Physics Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4Physics(client)` — 14 lessons. Heavy use of `numeric` type for equations-of-motion calculations and circuit problems. Language: English. Subject string: `"Physics"`.

#### Task 1.4 — Form 4 Mathematics Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4Maths(client)` — 10 lessons. All `numeric` and `step_order` exercises; worked examples must show full algebraic steps in body text. Language: Malay. Subject string: `"Matematik"`.

#### Task 1.5 — Form 4 Additional Mathematics Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4AddMaths(client)` — 10 lessons. Differentiation/integration worked examples, `numeric` and `scenario` question types. Language: Malay. Subject string: `"Matematik Tambahan"`.

#### Task 1.6 — Form 4 Science Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4Science(client)` — 8 lessons. Mix of conceptual (multiple_choice, true_false) and applied (scenario, diagram_label) questions. Language: Malay. Subject string: `"Sains"`.

#### Task 1.7 — Form 4 Computer Science Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm4CompSci(client)` — 8 lessons. `code_trace` and `step_order` question types for programming lessons; `multiple_choice` for theory. Language: Malay. Subject string: `"Sains Komputer"`.

#### Task 1.8 — Form 5 Biology Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm5Biology(client)` — 15 lessons. Genetics lessons use `representation_match` (Punnett squares), biotechnology uses `scenario`. Language: English. Subject string: `"Biology"`.

#### Task 1.9 — Form 5 Chemistry Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm5Chemistry(client)` — 10 lessons. Rate-of-reaction graphs use `data_interpret`, thermochemistry uses `numeric`. Language: Malay. Subject string: `"Kimia"`.

#### Task 1.10 — Form 5 Physics Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm5Physics(client)` — 10 lessons. Nuclear decay uses `numeric` (half-life), transformer calculations use `numeric`, electronics uses `scenario`. Language: Malay (Form 5 textbook is Malay). Subject string: `"Fizik"`.

#### Task 1.11 — Form 5 Mathematics Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm5Maths(client)` — 8 lessons. Matrices use `step_order`, linear programming uses `scenario`. Language: Malay. Subject string: `"Matematik"`.

#### Task 1.12 — Form 5 Additional Mathematics Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm5AddMaths(client)` — 10 lessons. Kinematics uses `numeric`, probability distributions use `numeric` with tolerance. Language: Malay. Subject string: `"Matematik Tambahan"`.

#### Task 1.13 — Form 5 Computer Science Content `[PARALLEL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
Implement function `seedForm5CompSci(client)` — 7 lessons. OOP uses `code_trace`, sorting algorithms use `step_order`. Language: Malay. Subject string: `"Sains Komputer"`.

---

### Wave 2 — Sequential Integration Tasks

These run after all Wave 1 content functions exist.

#### Task 2.1 — Wire all subject functions into main() `[SEQUENTIAL]`
**File:** `backend/scripts/seed-stem-lessons.js`  
In `main()`, call all 13 subject seed functions inside a single database transaction, in a logical order (Form 4 before Form 5, core subjects first). Add progress logging (`console.log`) before each batch. Add a final summary count query.

**Dependency:** All Wave 1 tasks (Tasks 1.1–1.13).

#### Task 2.2 — Update migration runner to include new migration `[SEQUENTIAL]`
**File:** `backend/scripts/migrate.js`  
Confirm migration `016_wipe_demo_lessons.sql` is picked up by the existing runner (check if it uses alphabetical/numeric ordering). If the runner scans the migrations folder automatically, no change needed — just document. If it has a hardcoded list, add entry `016_wipe_demo_lessons.sql`.

**Dependency:** Task 0.1 (migration file must exist).

#### Task 2.3 — Update seed-demo.js to skip lesson/syllabus seeding `[SEQUENTIAL]`
**File:** `backend/scripts/seed-demo.js`  
Remove the `seedSyllabus()`, `seedLessons()`, and `seedQuizQuestions()` calls from `main()` (or gate them with `process.env.SKIP_LESSON_SEED`). Keep user, classroom, and progress seeding intact so the demo environment still has users and classrooms, but lessons now come from `seed-stem-lessons.js` instead.

**Dependency:** Task 2.1 (new seed script must be finalised before old one is trimmed).

#### Task 2.4 — Integration smoke test `[SEQUENTIAL]`
**File:** `backend/test/learning.routes.test.ts`  
Add a test block `"STEM lesson catalogue"` that:
1. Calls `GET /api/learning/catalog?formLevel=4` and asserts count ≥ 60 lessons
2. Calls `GET /api/learning/catalog?subject=Biology&formLevel=4` and asserts count ≥ 18
3. Fetches one Biology lesson and asserts it has ≥ 5 content blocks and ≥ 6 quiz questions
4. Submits a mock answer payload and asserts a 200 with a score field

**Dependency:** Task 2.1 (seed must be complete to have test data).

#### Task 2.5 — Update docker-compose seed step `[SEQUENTIAL]`
**File:** `docker-compose.yml`  
If there is a seed service or entrypoint that calls `seed-demo.js`, add a sequential call to `seed-stem-lessons.js` after it. If seed is run manually, add a comment in the file and update `README.md` with the new setup command sequence.

**Dependency:** Task 2.1.

---

## Execution Waves Summary

```
Wave 0 (Blocking — run sequentially, in order):
  Task 0.1 → Task 0.2

Wave 1 (Parallel — spawn 13 agents simultaneously after Wave 0):
  Task 1.1  Form 4 Biology
  Task 1.2  Form 4 Chemistry
  Task 1.3  Form 4 Physics
  Task 1.4  Form 4 Mathematics
  Task 1.5  Form 4 Add Maths
  Task 1.6  Form 4 Science
  Task 1.7  Form 4 Computer Science
  Task 1.8  Form 5 Biology
  Task 1.9  Form 5 Chemistry
  Task 1.10 Form 5 Physics
  Task 1.11 Form 5 Mathematics
  Task 1.12 Form 5 Add Maths
  Task 1.13 Form 5 Computer Science

Wave 2 (Sequential — after all Wave 1 agents complete):
  Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4 → Task 2.5
```

---

## Quality Constraints for Content Agents

Every content agent (Tasks 1.1–1.13) MUST follow these rules:

1. **Accuracy first** — All facts, formulas, and worked examples must be correct per KSSM curriculum. When in doubt, use the most standard textbook phrasing.
2. **No placeholder text** — Every block body must be real lesson content. No "Lorem ipsum", no "TODO", no "explain X here".
3. **question_type compliance** — Only use types supported by the DB check constraint: `multiple_choice`, `true_false`, `fill_blank`, `matching`, `representation_match`, `missing_step`, `step_order`, `numeric`, `diagram_label`, `error_diagnosis`, `prediction`, `code_trace`, `data_interpret`, `scenario`.
4. **correct_answer format**:
   - `multiple_choice` → `{"optionIndex": 0}` (0-based)
   - `true_false` → `"true"` or `"false"`
   - `numeric` → `{"value": 9.8, "tolerance": 0.1, "unit": "m/s²"}`
   - `step_order` → array of step strings in correct order
   - `representation_match` → object `{"A": "definition of A", "B": "definition of B"}`
   - `error_diagnosis` → string describing the error
5. **No external URLs** — Do not use `embed` blocks (no YouTube links in seeded content).
6. **Bilingual key terms** — Each key-terms section block must include the Malay term in brackets where the lesson is in English, e.g. "Mitosis (Mitosis)", "Nucleus (Nukleus)".
7. **SQL injection safety** — All string values must use parameterised queries (`$1, $2, …`) via the `pg` client — never string interpolation.

---

## Files Touched Summary

| File | Change type |
|---|---|
| `database/migrations/016_wipe_demo_lessons.sql` | New — wipe migration |
| `backend/scripts/seed-stem-lessons.js` | New — full STEM seed |
| `backend/scripts/seed-demo.js` | Modified — remove lesson seeding |
| `backend/scripts/migrate.js` | Modified (if needed) — register migration |
| `backend/test/learning.routes.test.ts` | Modified — add STEM catalogue tests |
| `docker-compose.yml` | Modified — add seed step |
