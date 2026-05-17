const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  databaseUrlFromParts();

const client = new Client({ connectionString });
const seedStats = {
  syllabus: 0,
  lessons: 0,
  questions: 0,
};

function estimatedMinutesForDifficulty(difficulty) {
  if (difficulty === 'easy') return 12;
  if (difficulty === 'hard') return 25;
  return 18;
}

function section(title, body) {
  return {
    type: 'section',
    title,
    body,
  };
}

async function insertSyllabus(client, subject, formLevel, topic, subtopic, orderIndex) {
  seedStats.syllabus += 1;
  const result = await client.query(
    `INSERT INTO syllabus_items (subject, form_level, topic, subtopic, order_index, content, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (subject, form_level, topic, subtopic)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [
      subject,
      formLevel,
      topic,
      subtopic || null,
      orderIndex,
      JSON.stringify({ summary: subtopic ? `${topic}: ${subtopic}` : topic }),
    ]
  );
  return result.rows[0].id;
}

async function insertLesson(client, syllabusId, title, subject, formLevel, difficulty, estimatedMinutes, blocks) {
  seedStats.lessons += 1;
  const content = {
    summary: blocks[0]?.body || title,
    blocks,
  };
  const result = await client.query(
    `INSERT INTO lessons (title, content, subject, form_level, difficulty, estimated_minutes, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
     ON CONFLICT (title, subject, form_level)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [
      title,
      JSON.stringify(content),
      subject,
      formLevel,
      difficulty,
      estimatedMinutes || estimatedMinutesForDifficulty(difficulty),
    ]
  );
  const lessonId = result.rows[0].id;

  await client.query(
    `INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id)
     VALUES ($1, $2)`,
    [lessonId, syllabusId]
  );

  return lessonId;
}

async function insertQuestion(client, lessonId, type, questionText, options, correctAnswer, explanation, points, orderIndex) {
  seedStats.questions += 1;
  const result = await client.query(
    `INSERT INTO quiz_questions (lesson_id, question_text, question_type, options, correct_answer, explanation, points, order_index, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     ON CONFLICT (lesson_id, order_index)
     DO UPDATE SET question_text = EXCLUDED.question_text
     RETURNING id`,
    [
      lessonId,
      questionText,
      type,
      JSON.stringify(options || []),
      JSON.stringify(correctAnswer),
      explanation || null,
      points || 1,
      orderIndex,
    ]
  );
  return result.rows[0].id;
}

async function seedForm4Biology(client) {
  const subject = 'Biology';
  const formLevel = 4;

  const mc = (question, options, optionIndex, explanation) => ({
    type: 'multiple_choice',
    question,
    options,
    correct: { optionIndex },
    explanation,
  });

  const tf = (question, answer, explanation) => ({
    type: 'true_false',
    question,
    options: ['True', 'False'],
    correct: answer ? 'true' : 'false',
    explanation,
  });

  const representationMatch = (question, pairs, explanation) => ({
    type: 'representation_match',
    question,
    options: Object.entries(pairs).map(([prompt, answer]) => ({ prompt, answer })),
    correct: pairs,
    explanation,
  });

  const stepOrder = (question, correct, explanation) => ({
    type: 'step_order',
    question,
    options: correct.slice().reverse(),
    correct,
    explanation,
  });

  const errorDiagnosis = (question, correct, explanation) => ({
    type: 'error_diagnosis',
    question,
    options: [],
    correct,
    explanation,
  });

  const lessons = [
    {
      topic: 'Cell as a Unit of Life',
      subtopic: 'Cell organisation',
      title: 'Cell Organisation',
      difficulty: 'easy',
      blocks: [
        section('Concept', `Multicellular organisms are organised in a clear hierarchy: cell, tissue, organ, organ system and organism. A cell is the basic structural and functional unit of life. Cells with similar structure and function form a tissue, and different tissues cooperate to form an organ. Several organs then work together in an organ system to carry out a major life process.`),
        section('Worked Example', `In the human digestive system, epithelial cells line the intestine, muscle cells move food by peristalsis, and gland cells secrete digestive juices. Similar cells form tissues, those tissues combine into organs such as the stomach and small intestine, and the organs cooperate as the digestive system. The whole system supports the organism by breaking down food and absorbing nutrients.`),
        section('Misconceptions', `A tissue is not just any random group of cells; the cells must have a similar structure and function. An organ is more complex than a tissue because it contains several tissue types. An organ system is not a single organ, but a coordinated group of organs.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Cell (Sel) | Basic structural and functional unit of life. |
| Tissue (Tisu) | Group of similar cells working together for a specific function. |
| Organ (Organ) | Structure made of different tissues working together. |
| Organ system (Sistem organ) | Group of organs coordinating a major body function. |
| Multicellular organism (Organisma multisel) | Living thing made of many specialised cells. |`),
        section('Mnemonic', `Remember C-T-O-S-O: Cells Team up as tissues; tissues Organise as organs; organs Serve the Organism.`),
      ],
      questions: [
        mc('Which sequence shows the correct organisation of a multicellular organism?', ['Cell -> tissue -> organ -> organ system -> organism', 'Tissue -> cell -> organ -> organism -> organ system', 'Organ -> tissue -> cell -> organ system -> organism', 'Cell -> organ -> tissue -> organism -> organ system'], 0, 'The biological hierarchy moves from the simplest living unit to the complete organism.'),
        mc('Which example is an organ rather than a cell, tissue, or organ system?', ['Red blood cell', 'Muscle tissue', 'Stomach', 'Digestive system'], 2, 'The stomach contains epithelial, muscle, connective and nervous tissues, so it is an organ.'),
        tf('A tissue is made of different organs working together.', false, 'Different organs working together form an organ system; a tissue is made of similar cells.'),
        representationMatch('Match each level of organisation with its description.', {
          Cell: 'Basic unit of life',
          Tissue: 'Similar cells with a common function',
          Organ: 'Different tissues working together',
          'Organ system': 'Several organs coordinating one major process',
        }, 'Each level is built from the level before it.'),
        stepOrder('Arrange the levels of organisation from simplest to most complex.', ['Identify the cell', 'Group similar cells as a tissue', 'Combine different tissues into an organ', 'Coordinate organs into an organ system', 'Relate the organ system to the whole organism'], 'Cells are the base level, and the whole organism is the most complex level.'),
        errorDiagnosis('A pupil says the heart is a tissue because it contains muscle cells. What is the error?', 'The heart is an organ because it contains several tissues working together, not only one type of tissue.', 'Cardiac muscle is an important tissue in the heart, but the heart also contains connective, nervous and epithelial tissues.'),
      ],
    },
    {
      topic: 'Cell as a Unit of Life',
      subtopic: 'Cell structure & organelles',
      title: 'Cell Structure and Organelles',
      difficulty: 'medium',
      blocks: [
        section('Concept', `Animal and plant cells are eukaryotic cells, meaning their genetic material is enclosed in a nucleus. Organelles are specialised structures that carry out particular functions inside the cell. The nucleus controls cell activities, mitochondria release energy by aerobic respiration, ribosomes synthesise proteins, and the cytoplasm is the site of many metabolic reactions. Plant cells also have a cellulose cell wall, chloroplasts and a large vacuole.`),
        section('Worked Example', `A palisade mesophyll cell is adapted for photosynthesis. It has many chloroplasts to absorb light, a large vacuole that helps maintain cell shape, and a cell wall that provides support. A red blood cell, in contrast, lacks a nucleus when mature and is shaped to transport oxygen efficiently.`),
        section('Misconceptions', `The cell wall is not the same as the plasma membrane; the wall is a rigid outer support, while the membrane controls movement of substances. Chloroplasts are not found in animal cells. Mitochondria do not make food; they release usable energy from food molecules.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Nucleus (Nukleus) | Organelle containing genetic material and controlling cell activities. |
| Mitochondrion (Mitokondrion) | Site of aerobic respiration and ATP release. |
| Ribosome (Ribosom) | Small structure where proteins are synthesised. |
| Chloroplast (Kloroplas) | Plant organelle containing chlorophyll for photosynthesis. |
| Vacuole (Vakuol) | Fluid-filled space that helps storage and support in plant cells. |
| Cell wall (Dinding sel) | Rigid cellulose layer that supports plant cells. |`),
        section('Mnemonic', `N-M-R-C-V-W: Nucleus manages, Mitochondria release energy, Ribosomes build protein, Chloroplasts catch light, Vacuoles store, Walls support.`),
      ],
      questions: [
        mc('Which organelle controls most cell activities because it contains genetic material?', ['Nucleus', 'Mitochondrion', 'Ribosome', 'Vacuole'], 0, 'The nucleus contains DNA and controls cell activities.'),
        mc('Which structure provides rigid support in plant cells but is absent from animal cells?', ['Plasma membrane', 'Cell wall', 'Mitochondrion', 'Cytoplasm'], 1, 'The cellulose cell wall supports plant cells.'),
        tf('Mitochondria are sites of aerobic respiration that release usable energy for the cell.', true, 'Mitochondria carry out aerobic respiration and release ATP.'),
        representationMatch('Match each organelle with its main function.', {
          Nucleus: 'Controls cell activities and stores DNA',
          Mitochondrion: 'Releases energy by aerobic respiration',
          Ribosome: 'Synthesises proteins',
          Chloroplast: 'Absorbs light for photosynthesis',
        }, 'Organelles are specialised for particular cell functions.'),
        stepOrder('A student is deciding whether a cell is plant or animal. Arrange the observations in a sensible order.', ['Observe the cell boundary under the microscope', 'Identify the nucleus and cytoplasm', 'Look for a rigid cell wall', 'Look for chloroplasts and a large vacuole', 'Conclude whether the cell is plant or animal'], 'Cell identification should begin with general structures before using plant-specific structures.'),
        errorDiagnosis('A student says ribosomes store genetic material and control the cell. What is the error?', 'Ribosomes synthesise proteins; the nucleus stores genetic material and controls most cell activities.', 'Ribosomes and nuclei have different roles in eukaryotic cells.'),
      ],
    },
    {
      topic: 'Cell as a Unit of Life',
      subtopic: 'Cell membrane & transport',
      title: 'Cell Membrane and Transport',
      difficulty: 'medium',
      blocks: [
        section('Concept', `The plasma membrane is selectively permeable, so it controls which substances enter and leave the cell. Diffusion moves particles from a region of higher concentration to lower concentration without energy input. Osmosis is the diffusion of water molecules through a selectively permeable membrane from higher water potential to lower water potential. Active transport moves substances against a concentration gradient and requires energy from respiration.`),
        section('Worked Example', `When plant cells are placed in pure water, water enters by osmosis and the cells become turgid because the cell wall resists bursting. In a concentrated salt solution, water leaves the cells by osmosis and the cytoplasm pulls away from the cell wall, causing plasmolysis. Root hair cells can also absorb mineral ions by active transport when ion concentration is lower in the soil than inside the cell.`),
        section('Misconceptions', `Osmosis involves water only, not every dissolved particle. Diffusion and osmosis do not require ATP, but active transport does. A cell membrane is not fully permeable; it is selectively permeable.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Plasma membrane (Membran plasma) | Selectively permeable boundary around the cell. |
| Diffusion (Resapan) | Net movement of particles down a concentration gradient. |
| Osmosis (Osmosis) | Net movement of water through a selectively permeable membrane. |
| Active transport (Pengangkutan aktif) | Movement against a concentration gradient using energy. |
| Turgid (Segah) | Firm condition of a plant cell after water enters by osmosis. |
| Plasmolysis (Plasmolisis) | Shrinking of cytoplasm away from the cell wall after water loss. |`),
        section('Mnemonic', `D-O-A: Diffusion is Downhill, Osmosis is water Only, Active transport uses ATP.`),
      ],
      questions: [
        mc('Which process is the movement of water molecules through a selectively permeable membrane from higher water potential to lower water potential?', ['Osmosis', 'Active transport', 'Phagocytosis', 'Protein synthesis'], 0, 'Osmosis specifically describes the movement of water across a selectively permeable membrane.'),
        mc('Which process allows root hair cells to take up mineral ions against a concentration gradient?', ['Simple diffusion', 'Osmosis', 'Active transport', 'Evaporation'], 2, 'Active transport uses energy to move ions against their concentration gradient.'),
        tf('Diffusion requires ATP because particles always move against a concentration gradient.', false, 'Diffusion is passive and occurs down a concentration gradient.'),
        representationMatch('Match each transport term with the correct description.', {
          Diffusion: 'Net movement of particles from higher to lower concentration',
          Osmosis: 'Net movement of water through a selectively permeable membrane',
          'Active transport': 'Movement against a concentration gradient using energy',
          Plasmolysis: 'Cytoplasm pulls away from the cell wall after water leaves',
        }, 'The direction of the gradient and energy requirement distinguish the transport processes.'),
        stepOrder('Arrange the steps for investigating osmosis using potato strips.', ['Prepare potato strips of the same size', 'Measure the initial mass of each strip', 'Immerse strips in different sucrose solutions', 'Blot each strip dry and measure final mass', 'Compare percentage change in mass'], 'A fair osmosis investigation controls size, records mass before and after, and compares percentage change.'),
        errorDiagnosis('A student says saltwater makes plant cells turgid because water enters the cells. What is the error?', 'Saltwater is hypertonic to the cell sap, so water leaves the plant cells by osmosis and the cells become flaccid or plasmolysed.', 'Water moves from higher water potential to lower water potential.'),
      ],
    },
    {
      topic: 'Cell Division',
      subtopic: 'Mitosis - stages & significance',
      title: 'Mitosis - Stages and Significance',
      difficulty: 'medium',
      blocks: [
        section('Concept', `Mitosis is nuclear division that produces two genetically identical diploid daughter cells from one parent cell. It maintains chromosome number and is important for growth, repair, replacement of damaged cells and asexual reproduction. The main stages are prophase, metaphase, anaphase and telophase, followed by cytokinesis. DNA replication occurs before mitosis during interphase.`),
        section('Worked Example', `When skin is cut, cells near the wound divide by mitosis to replace damaged cells. Each new skin cell receives the same chromosome number and the same genetic information as the parent cell. This allows the repaired tissue to function like the original tissue.`),
        section('Misconceptions', `Mitosis does not produce gametes and does not halve the chromosome number. Crossing over is not a feature of mitosis. Interphase is not an inactive stage; DNA replication and cell growth happen before mitosis begins.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Mitosis (Mitosis) | Nuclear division producing two genetically identical cells. |
| Chromosome (Kromosom) | Condensed DNA structure carrying genes. |
| Prophase (Profasa) | Stage when chromosomes condense and become visible. |
| Metaphase (Metafasa) | Stage when chromosomes line up at the equator. |
| Anaphase (Anafasa) | Stage when sister chromatids separate. |
| Telophase (Telofasa) | Stage when new nuclei form around separated chromosomes. |
| Cytokinesis (Sitokinesis) | Division of cytoplasm after nuclear division. |`),
        section('Mnemonic', `PMAT-C: Prophase prepares, Metaphase meets in the middle, Anaphase apart, Telophase two nuclei, Cytokinesis cuts the cytoplasm.`),
      ],
      questions: [
        mc('In which stage of mitosis do chromosomes line up at the equator of the cell?', ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'], 1, 'Metaphase is recognised by chromosomes aligned along the equatorial plane.'),
        mc('Which statement best describes the significance of mitosis in humans?', ['It produces gametes with half the chromosome number', 'It causes genetic variation by crossing over', 'It supports growth and tissue repair with identical cells', 'It converts glucose into ATP'], 2, 'Mitosis produces genetically identical cells for growth and repair.'),
        tf('Mitosis halves the chromosome number to form gametes.', false, 'Meiosis, not mitosis, forms haploid gametes.'),
        representationMatch('Match each mitotic stage with its main event.', {
          Prophase: 'Chromosomes condense and become visible',
          Metaphase: 'Chromosomes align at the equator',
          Anaphase: 'Sister chromatids move to opposite poles',
          Telophase: 'New nuclear membranes form',
        }, 'The stages are identified by chromosome behaviour.'),
        stepOrder('Arrange the stages of mitosis and cell separation in order.', ['Prophase begins and chromosomes condense', 'Metaphase aligns chromosomes at the equator', 'Anaphase separates sister chromatids', 'Telophase forms two nuclei', 'Cytokinesis divides the cytoplasm'], 'Mitosis follows the PMAT sequence before cytokinesis completes cell division.'),
        errorDiagnosis('A student says crossing over occurs in mitosis to make daughter cells different. What is the error?', 'Crossing over occurs in meiosis I, not mitosis; mitosis produces genetically identical daughter cells except when mutation occurs.', 'Mitosis preserves genetic information for growth and repair.'),
      ],
    },
    {
      topic: 'Cell Division',
      subtopic: 'Meiosis - stages & significance',
      title: 'Meiosis - Stages and Significance',
      difficulty: 'medium',
      blocks: [
        section('Concept', `Meiosis is a reduction division that produces four genetically different haploid cells from one diploid parent cell. It occurs in reproductive organs to form gametes. Meiosis has two divisions: meiosis I separates homologous chromosomes, and meiosis II separates sister chromatids. Crossing over and independent assortment produce genetic variation.`),
        section('Worked Example', `A human body cell has 46 chromosomes. During meiosis in the testes or ovaries, the chromosome number is reduced so each sperm or ovum has 23 chromosomes. When fertilisation occurs, the diploid number is restored in the zygote.`),
        section('Misconceptions', `Meiosis is not used for ordinary growth or wound repair. DNA replicates once before meiosis I, not before both divisions. Homologous chromosomes separate in meiosis I, while sister chromatids separate in meiosis II.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Meiosis (Meiosis) | Cell division producing haploid gametes with genetic variation. |
| Homologous chromosome (Kromosom homolog) | Pair of chromosomes carrying the same types of genes. |
| Crossing over (Pindah silang) | Exchange of genetic material between homologous chromosomes. |
| Independent assortment (Pengaturan bebas) | Random arrangement of homologous pairs during meiosis I. |
| Haploid (Haploid) | Cell with one set of chromosomes. |
| Diploid (Diploid) | Cell with two sets of chromosomes. |
| Gamete (Gamet) | Haploid reproductive cell. |`),
        section('Mnemonic', `Meiosis makes Mate cells: it halves chromosome number and mixes genes.`),
      ],
      questions: [
        mc('What is the usual result of meiosis from one diploid parent cell?', ['Two genetically identical diploid cells', 'Four genetically different haploid cells', 'Four genetically identical diploid cells', 'One large diploid cell only'], 1, 'Meiosis produces four haploid cells that are genetically varied.'),
        mc('Which process exchanges genetic material between homologous chromosomes in prophase I?', ['Cytokinesis', 'Crossing over', 'Binary fission', 'Active transport'], 1, 'Crossing over creates new combinations of alleles.'),
        tf('Meiosis produces cells with the same chromosome number as the parent cell.', false, 'Meiosis halves the chromosome number from diploid to haploid.'),
        representationMatch('Match each meiosis feature with its role.', {
          'Meiosis I': 'Separates homologous chromosomes',
          'Meiosis II': 'Separates sister chromatids',
          'Crossing over': 'Exchanges DNA between homologous chromosomes',
          Gamete: 'Haploid cell used in sexual reproduction',
        }, 'Meiosis reduces chromosome number and creates variation through chromosome behaviour.'),
        stepOrder('Arrange the key events of meiosis in order.', ['DNA replicates before meiosis begins', 'Homologous chromosomes pair and crossing over occurs', 'Homologous chromosomes separate in meiosis I', 'Sister chromatids separate in meiosis II', 'Four haploid cells form'], 'DNA replication is followed by two divisions that reduce chromosome number.'),
        errorDiagnosis('A student says meiosis makes two identical diploid body cells. What is the error?', 'Meiosis makes four genetically different haploid gametes; two identical diploid body cells are produced by mitosis.', 'The number and genetic similarity of daughter cells distinguish meiosis from mitosis.'),
      ],
    },
    {
      topic: 'Nutrition',
      subtopic: 'Types of nutrition in living things',
      title: 'Types of Nutrition in Living Things',
      difficulty: 'easy',
      blocks: [
        section('Concept', `Nutrition is the way organisms obtain energy and raw materials for growth, repair and metabolism. Autotrophs make their own organic food from simple inorganic substances, usually by photosynthesis. Heterotrophs obtain organic nutrients from other organisms. Heterotrophic nutrition includes holozoic, saprophytic and parasitic nutrition.`),
        section('Worked Example', `A green plant is a photoautotroph because it uses light energy, carbon dioxide and water to make glucose. A human shows holozoic nutrition because food is ingested, digested, absorbed, assimilated and egested. A mushroom shows saprophytic nutrition because it secretes enzymes onto dead organic matter and absorbs the digested products.`),
        section('Misconceptions', `Not every organism that stays in one place is a plant or an autotroph. Fungi are heterotrophs because they do not contain chlorophyll. Parasites do not always kill the host immediately; they obtain nutrients from the host and may harm it gradually.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Autotroph (Autotrof) | Organism that makes its own organic food. |
| Heterotroph (Heterotrof) | Organism that obtains organic food from other organisms. |
| Photoautotroph (Fotoautotrof) | Autotroph using light energy for photosynthesis. |
| Holozoic nutrition (Nutrisi holozoik) | Nutrition involving ingestion and internal digestion. |
| Saprophytic nutrition (Nutrisi saprofit) | Feeding by external digestion of dead organic matter. |
| Parasitic nutrition (Nutrisi parasit) | Feeding from a living host, usually harming the host. |`),
        section('Mnemonic', `A-H-S-P: Autotrophs make food; Holozoic animals ingest; Saprophytes recycle dead matter; Parasites feed on hosts.`),
      ],
      questions: [
        mc('An organism that makes glucose from carbon dioxide and water using light energy is a', ['photoautotroph', 'saprophyte', 'parasite', 'holozoic feeder'], 0, 'Photoautotrophs use light energy to make organic food.'),
        mc('Which type of nutrition is shown by fungi feeding on dead leaves?', ['Holozoic', 'Saprophytic', 'Parasitic', 'Autotrophic'], 1, 'Saprophytes externally digest dead organic matter and absorb the products.'),
        tf('All heterotrophs digest food inside a stomach.', false, 'Fungi digest externally and many parasites absorb nutrients without a stomach.'),
        representationMatch('Match each nutrition type with the correct example.', {
          Autotrophic: 'Green plant making glucose by photosynthesis',
          Holozoic: 'Human ingesting and digesting food',
          Saprophytic: 'Mushroom feeding on dead wood',
          Parasitic: 'Tapeworm absorbing nutrients from a host intestine',
        }, 'Examples can be classified by how nutrients are obtained.'),
        stepOrder('Arrange the main stages of holozoic nutrition in humans.', ['Ingestion of food', 'Digestion into smaller soluble molecules', 'Absorption into blood or lymph', 'Assimilation into body cells', 'Egestion of undigested material'], 'Holozoic nutrition follows the path from taking in food to removing undigested material.'),
        errorDiagnosis('A pupil labels a mushroom as an autotroph because it grows in soil. What is the error?', 'A mushroom lacks chlorophyll and obtains nutrients saprophytically from dead organic matter; growing in soil does not make it an autotroph.', 'Nutrition type depends on how food is obtained, not where the organism grows.'),
      ],
    },
    {
      topic: 'Nutrition',
      subtopic: 'Human digestive system',
      title: 'Human Digestive System',
      difficulty: 'medium',
      blocks: [
        section('Concept', `The human digestive system breaks large insoluble food molecules into small soluble molecules that can be absorbed. Mechanical digestion physically breaks food into smaller pieces, while chemical digestion uses enzymes. Peristalsis moves food along the alimentary canal. Most digestion and absorption occur in the small intestine, with bile helping fat digestion by emulsifying lipids.`),
        section('Worked Example', `Starch digestion begins in the mouth when salivary amylase breaks starch into maltose. In the stomach, protein digestion begins in acidic conditions with protease. In the small intestine, enzymes from the pancreas and intestinal wall complete digestion, and the soluble products are absorbed through villi.`),
        section('Misconceptions', `Bile is not an enzyme; it emulsifies fats and helps neutralise acidic chyme. The stomach does not absorb most digested nutrients. Peristalsis is not digestion, but muscular movement that pushes food along the gut.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Ingestion (Pengingesan) | Taking food into the mouth. |
| Digestion (Pencernaan) | Breaking large food molecules into smaller soluble molecules. |
| Peristalsis (Peristalsis) | Wave-like muscle contraction moving food along the gut. |
| Enzyme (Enzim) | Biological catalyst that speeds up digestion reactions. |
| Bile (Hempedu) | Fluid that emulsifies fats and helps neutralise acidic chyme. |
| Egestion (Penyahtinjaan) | Removal of undigested material as faeces. |`),
        section('Mnemonic', `I-D-A-A-E: Ingest, Digest, Absorb, Assimilate, Egest.`),
      ],
      questions: [
        mc('Where do most chemical digestion and nutrient absorption occur?', ['Mouth', 'Stomach', 'Small intestine', 'Large intestine'], 2, 'The small intestine completes digestion and has villi for absorption.'),
        mc('What is the main role of bile in digestion?', ['Digest protein directly', 'Emulsify fats into tiny droplets', 'Absorb glucose into blood', 'Produce hydrochloric acid'], 1, 'Bile emulsifies fats, increasing surface area for lipase action.'),
        tf('Bile is an enzyme that digests protein in the stomach.', false, 'Bile is not an enzyme and is involved mainly with fats in the small intestine.'),
        representationMatch('Match each digestive structure with a main function.', {
          Mouth: 'Chews food and begins starch digestion',
          Stomach: 'Churns food and begins protein digestion',
          'Small intestine': 'Completes digestion and absorbs nutrients',
          'Large intestine': 'Absorbs water and forms faeces',
        }, 'Each region of the alimentary canal has specialised functions.'),
        stepOrder('Arrange the path and processing of food through the human digestive system.', ['Ingest food through the mouth', 'Chew food and mix it with saliva', 'Churn food with gastric juice in the stomach', 'Digest food further in the small intestine', 'Absorb soluble products through villi', 'Egest undigested material through the anus'], 'Food moves in one direction through the alimentary canal while digestion and absorption occur.'),
        errorDiagnosis('A student says protein digestion starts in the mouth because amylase is present there. What is the error?', 'Amylase digests starch, not protein; protein digestion begins mainly in the stomach with protease in acidic conditions.', 'Different enzymes act on different food substrates.'),
      ],
    },
    {
      topic: 'Nutrition',
      subtopic: 'Absorption & assimilation',
      title: 'Absorption and Assimilation',
      difficulty: 'hard',
      blocks: [
        section('Concept', `Absorption is the movement of digested soluble molecules through the wall of the small intestine into blood or lymph. The ileum has many villi and microvilli, giving a large surface area and a short diffusion distance. Glucose and amino acids enter blood capillaries and travel to the liver through the hepatic portal vein. Fatty acids and glycerol enter lacteals in the villi before returning to the bloodstream through the lymphatic system. Assimilation is the use of absorbed nutrients by body cells.`),
        section('Worked Example', `After a carbohydrate-rich meal, glucose is absorbed into capillaries in the villi. It is carried to the liver, where some glucose is used in respiration and excess glucose may be converted to glycogen. After a fatty meal, fatty acids and glycerol are absorbed into epithelial cells, reassembled into lipids and carried through lacteals.`),
        section('Misconceptions', `Absorption and assimilation are different processes: absorption moves nutrients into transport systems, while assimilation uses them in cells. Not all absorbed nutrients enter blood capillaries directly; many lipid products enter lacteals first. The villus is efficient because of its large surface area, thin epithelium and rich transport supply.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Villus (Vilus) | Finger-like projection in the ileum that increases surface area. |
| Lacteal (Lakteal) | Lymph vessel in a villus that absorbs lipid products. |
| Assimilation (Asimilasi) | Use of absorbed nutrients by body cells. |
| Hepatic portal vein (Vena portal hepar) | Blood vessel carrying absorbed nutrients from intestine to liver. |
| Amino acid (Asid amino) | Digested product of protein. |
| Glucose (Glukosa) | Simple sugar absorbed from carbohydrate digestion. |`),
        section('Mnemonic', `Absorb means Across the villus; Assimilate means Add to body cells.`),
      ],
      questions: [
        mc('Which feature of villi directly increases the surface area for absorption?', ['Thick muscular wall', 'Many folds with microvilli', 'Cartilage rings', 'Ciliated epithelium'], 1, 'Villi and microvilli greatly increase the surface area of the ileum.'),
        mc('Which digested products mainly enter lacteals in the villi?', ['Glucose and amino acids', 'Fatty acids and glycerol', 'Mineral ions and water', 'Starch and protein'], 1, 'Fat digestion products enter lacteals and travel through lymph.'),
        tf('Assimilation is the movement of digested food molecules from the ileum into blood and lymph.', false, 'That process is absorption; assimilation is the use of absorbed nutrients by body cells.'),
        representationMatch('Match each absorbed nutrient with its usual route or use.', {
          Glucose: 'Absorbed into blood capillaries and carried to the liver',
          'Amino acids': 'Absorbed into blood and used to build proteins',
          'Fatty acids and glycerol': 'Enter lacteals after absorption into epithelial cells',
          'Excess glucose': 'Can be converted to glycogen in the liver',
        }, 'Different nutrient products follow different routes after digestion.'),
        stepOrder('Arrange the handling of glucose after carbohydrate digestion.', ['Complete digestion to glucose in the small intestine', 'Absorb glucose through villus epithelium into blood capillaries', 'Carry glucose to the liver by the hepatic portal vein', 'Use some glucose in respiration by body cells', 'Store excess glucose as glycogen'], 'Absorption is followed by transport to the liver and assimilation by cells.'),
        errorDiagnosis('A student says all digested fats enter the blood capillaries of villi directly. What is the error?', 'Fatty acids and glycerol mainly enter lacteals in the villi as lipid products before returning to the bloodstream through lymph.', 'The villus has both blood capillaries and a lacteal, with different roles.'),
      ],
    },
    {
      topic: 'Respiration',
      subtopic: 'Aerobic vs anaerobic respiration',
      title: 'Aerobic and Anaerobic Respiration',
      difficulty: 'medium',
      blocks: [
        section('Concept', `Cellular respiration releases energy from glucose so cells can make ATP. Aerobic respiration uses oxygen and releases a large amount of energy, producing carbon dioxide and water. Anaerobic respiration occurs without oxygen and releases less energy per glucose molecule. In human muscles it produces lactic acid, while in yeast it produces ethanol and carbon dioxide.`),
        section('Worked Example', `During a sprint, muscle cells may not receive enough oxygen for the rate of energy demand. They respire anaerobically for a short time, producing lactic acid. After exercise, breathing and heart rate remain high to supply oxygen needed to break down lactic acid and restore normal conditions.`),
        section('Misconceptions', `Breathing is not the same as cellular respiration; breathing exchanges gases, while respiration releases energy inside cells. Anaerobic respiration does release energy, but much less than aerobic respiration. Yeast and human muscle cells do not produce the same anaerobic products.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Aerobic respiration (Respirasi aerob) | Respiration using oxygen to release much energy from glucose. |
| Anaerobic respiration (Respirasi anaerob) | Respiration without oxygen that releases less energy. |
| ATP (ATP) | Energy-carrying molecule used by cells. |
| Lactic acid (Asid laktik) | Anaerobic product in human muscle cells. |
| Ethanol (Etanol) | Anaerobic product in yeast fermentation. |
| Carbon dioxide (Karbon dioksida) | Waste gas from aerobic respiration and yeast fermentation. |`),
        section('Mnemonic', `Aerobic adds oxygen and gives ample ATP; Anaerobic avoids oxygen and gives a little ATP.`),
      ],
      questions: [
        mc('What are the final waste products of aerobic respiration in humans?', ['Carbon dioxide and water', 'Ethanol and oxygen', 'Lactic acid and oxygen', 'Glucose and water'], 0, 'Aerobic respiration completely breaks down glucose to carbon dioxide and water.'),
        mc('Which product builds up in human muscle cells during vigorous anaerobic respiration?', ['Ethanol', 'Lactic acid', 'Starch', 'Bile'], 1, 'Human muscle cells produce lactic acid during anaerobic respiration.'),
        tf('Anaerobic respiration releases more ATP per glucose molecule than aerobic respiration.', false, 'Aerobic respiration releases much more usable energy than anaerobic respiration.'),
        representationMatch('Match each respiration pathway with its products.', {
          'Aerobic respiration': 'Carbon dioxide, water and much ATP',
          'Anaerobic respiration in muscles': 'Lactic acid and little ATP',
          'Anaerobic respiration in yeast': 'Ethanol, carbon dioxide and little ATP',
          'Oxygen debt': 'Extra oxygen needed after exercise to remove lactic acid',
        }, 'The products depend on whether oxygen is used and on the organism or cell type.'),
        stepOrder('Arrange the main events in aerobic respiration of glucose.', ['Glucose is transported into the cell', 'Oxygen diffuses into the cell', 'Enzymes break down glucose in stages', 'ATP is released for cell activities', 'Carbon dioxide and water are removed as products'], 'Aerobic respiration requires both glucose and oxygen and releases ATP.'),
        errorDiagnosis('A student writes that yeast anaerobic respiration produces lactic acid. What is the error?', 'Yeast anaerobic respiration produces ethanol and carbon dioxide; lactic acid is produced by anaerobic respiration in human muscle cells.', 'Different cells have different anaerobic pathways.'),
      ],
    },
    {
      topic: 'Respiration',
      subtopic: 'Human respiratory system',
      title: 'Human Respiratory System',
      difficulty: 'easy',
      blocks: [
        section('Concept', `The human respiratory system brings air into the lungs and removes carbon dioxide from the body. Air passes through the nasal cavity, trachea, bronchi and bronchioles before reaching the alveoli. The trachea and bronchi are supported by cartilage rings to keep the airways open. Breathing movements are produced by the diaphragm and intercostal muscles changing the volume and pressure of the thoracic cavity.`),
        section('Worked Example', `During inhalation, the diaphragm contracts and flattens while the external intercostal muscles lift the ribs upwards and outwards. Thoracic volume increases, pressure inside the lungs decreases, and air flows into the lungs. During exhalation at rest, these muscles relax, thoracic volume decreases and air flows out.`),
        section('Misconceptions', `The lungs themselves are not muscles that pull air in. Gas exchange occurs mainly at the alveoli, not in the trachea or bronchi. The trachea is part of the airway, while the oesophagus carries food.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Nasal cavity (Rongga hidung) | Passage that filters, warms and moistens incoming air. |
| Trachea (Trakea) | Windpipe carrying air from larynx to bronchi. |
| Bronchus (Bronkus) | Main branch carrying air into each lung. |
| Bronchiole (Bronkiol) | Smaller airway branches inside the lungs. |
| Alveolus (Alveolus) | Tiny air sac where gas exchange occurs. |
| Diaphragm (Diafragma) | Muscle sheet that changes thoracic volume during breathing. |`),
        section('Mnemonic', `N-T-B-B-A: Nose, Trachea, Bronchi, Bronchioles, Alveoli.`),
      ],
      questions: [
        mc('Where does most gaseous exchange occur in the human respiratory system?', ['Trachea', 'Bronchus', 'Alveolus', 'Nasal cavity'], 2, 'Alveoli have thin moist walls and capillaries for gas exchange.'),
        mc('What happens to the diaphragm during inhalation?', ['It relaxes and curves upward', 'It contracts and flattens', 'It closes the trachea', 'It pumps blood into the lungs'], 1, 'A contracting diaphragm flattens and increases thoracic volume.'),
        tf('The trachea is supported by cartilage rings that help keep the airway open.', true, 'Cartilage rings prevent the trachea from collapsing.'),
        representationMatch('Match each respiratory structure with its function.', {
          'Nasal cavity': 'Filters, warms and moistens air',
          Trachea: 'Carries air to the bronchi',
          Bronchiole: 'Small airway branch leading towards alveoli',
          Alveolus: 'Site of gaseous exchange',
        }, 'Air passes through specialised structures before reaching the gas exchange surface.'),
        stepOrder('Arrange the events of inhalation.', ['External intercostal muscles contract', 'Ribs move upwards and outwards', 'Diaphragm contracts and flattens', 'Thoracic cavity volume increases', 'Air pressure in the lungs decreases', 'Air enters the lungs'], 'Inhalation is caused by an increase in thoracic volume and a decrease in lung pressure.'),
        errorDiagnosis('A student says air is pushed into the lungs because lung muscles contract. What is the error?', 'Lungs do not actively contract; diaphragm and intercostal muscle action lowers pressure in the lungs so air flows in.', 'Breathing depends on pressure differences created by thoracic movements.'),
      ],
    },
    {
      topic: 'Respiration',
      subtopic: 'Gaseous exchange mechanism',
      title: 'Gaseous Exchange Mechanism',
      difficulty: 'medium',
      blocks: [
        section('Concept', `Gaseous exchange occurs by diffusion across the thin walls of alveoli and blood capillaries. Oxygen diffuses from alveolar air into the blood because its partial pressure is higher in the alveolus than in deoxygenated blood. Carbon dioxide diffuses from the blood into the alveolus because its partial pressure is higher in the blood. Moist surfaces, a large surface area, thin walls and continuous ventilation maintain rapid diffusion.`),
        section('Worked Example', `When oxygen enters the blood, it combines with haemoglobin in red blood cells to form oxyhaemoglobin. This lowers the concentration of free oxygen in the plasma and helps maintain a diffusion gradient from the alveolus into the blood. At body tissues, oxyhaemoglobin releases oxygen where oxygen concentration is lower.`),
        section('Misconceptions', `Oxygen does not need active transport to cross the alveolar wall. Haemoglobin is inside red blood cells, not dissolved freely as a large amount in plasma. Carbon dioxide mainly diffuses from blood to alveoli during gas exchange in the lungs.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Partial pressure gradient (Kecerunan tekanan separa) | Difference in gas pressure that drives diffusion. |
| Diffusion (Resapan) | Net movement from higher to lower concentration or pressure. |
| Oxyhaemoglobin (Oksihemoglobin) | Compound formed when oxygen binds to haemoglobin. |
| Ventilation (Pengudaraan) | Movement of air in and out of the lungs. |
| Pulmonary capillary (Kapilari pulmonari) | Tiny blood vessel surrounding alveoli. |
| Moist surface (Permukaan lembap) | Surface condition needed for gases to dissolve before diffusion. |`),
        section('Mnemonic', `For fast gas exchange remember L-T-M-B: Large area, Thin wall, Moist surface, Blood flow.`),
      ],
      questions: [
        mc('Which alveolar feature directly reduces the diffusion distance for gases?', ['Thick cartilage rings', 'One-cell-thick walls', 'Dry inner surface', 'No blood supply'], 1, 'Thin alveolar and capillary walls create a short diffusion pathway.'),
        mc('Why does oxygen diffuse from the alveolus into the blood?', ['Oxygen partial pressure is higher in the alveolus than in deoxygenated blood', 'Oxygen is pumped by cilia into red blood cells', 'Blood pressure is higher than air pressure', 'Carbon dioxide pulls oxygen through the wall'], 0, 'Diffusion follows a partial pressure gradient.'),
        tf('During gas exchange in the lungs, carbon dioxide mainly diffuses from alveolar air into the blood.', false, 'Carbon dioxide mainly diffuses from the blood into the alveoli to be exhaled.'),
        representationMatch('Match each feature with how it helps gas exchange.', {
          'Large alveolar surface area': 'Provides more area for diffusion',
          'Thin alveolar wall': 'Shortens diffusion distance',
          'Moist lining': 'Allows gases to dissolve before diffusing',
          'Dense capillary network': 'Maintains steep concentration gradients',
        }, 'Efficient gas exchange depends on surface area, distance and gradients.'),
        stepOrder('Arrange the movement of oxygen from inhaled air to transport in blood.', ['Ventilation brings oxygen-rich air into alveoli', 'Oxygen dissolves on the moist alveolar surface', 'Oxygen diffuses across alveolar and capillary walls', 'Oxygen enters red blood cells', 'Oxygen combines with haemoglobin to form oxyhaemoglobin'], 'Oxygen moves by diffusion and is then carried by haemoglobin.'),
        errorDiagnosis('A student says diffusion stops once oxygen enters the first capillary because the blood is saturated. What is the error?', 'Continuous blood flow carries oxygenated blood away and brings deoxygenated blood in, maintaining a steep oxygen diffusion gradient.', 'Blood flow is essential for maintaining rapid diffusion at the alveoli.'),
      ],
    },
    {
      topic: 'Dynamic Ecosystem',
      subtopic: 'Population & community',
      title: 'Population and Community',
      difficulty: 'easy',
      blocks: [
        section('Concept', `Ecology studies relationships between organisms and their environment. A species is a group of organisms that can interbreed to produce fertile offspring. A population is all organisms of the same species living in the same habitat at the same time. A community is all populations of different species living and interacting in an area, while an ecosystem includes the community and abiotic factors.`),
        section('Worked Example', `In a pond, all tilapia of the same species form one population. Tilapia, algae, snails, insects and aquatic plants together form a community. When water temperature, light intensity, dissolved oxygen and mineral content are included, the pond is described as an ecosystem.`),
        section('Misconceptions', `A population includes only one species, not every organism in a place. A community includes living organisms, while an ecosystem includes living and non-living components. A habitat is the place an organism lives; a niche is its role and interactions there.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Species (Spesies) | Organisms able to interbreed and produce fertile offspring. |
| Population (Populasi) | Members of one species in the same area at the same time. |
| Community (Komuniti) | Interacting populations of different species in an area. |
| Habitat (Habitat) | Place where an organism lives. |
| Niche (Nis) | Role of an organism in its ecosystem. |
| Ecosystem (Ekosistem) | Community plus abiotic factors interacting together. |`),
        section('Mnemonic', `S-P-C-E: Species form Populations; populations form Communities; communities plus Environment form Ecosystems.`),
      ],
      questions: [
        mc('All frogs of the same species living in one pond at the same time form a', ['community', 'population', 'habitat', 'biome'], 1, 'A population is one species in one area at one time.'),
        mc('Which description best defines a community?', ['All abiotic factors in an area', 'All populations of different species living and interacting in an area', 'One organism and its food', 'The physical place where a species lives'], 1, 'A community consists of living populations of different species.'),
        tf('A habitat describes only the feeding role of an organism, not the place it lives.', false, 'A habitat is the place an organism lives; its role is its niche.'),
        representationMatch('Match each ecological term with the correct meaning.', {
          Species: 'Organisms that can interbreed to produce fertile offspring',
          Population: 'One species in the same area at the same time',
          Community: 'Different populations interacting in an area',
          Ecosystem: 'Community interacting with abiotic factors',
        }, 'Ecological terms describe different levels of organisation.'),
        stepOrder('Arrange ecological levels from one organism to the largest scale listed.', ['Individual organism', 'Population', 'Community', 'Ecosystem', 'Biosphere'], 'Each level includes the level before it and adds more interactions.'),
        errorDiagnosis('A student counts fish, algae and water temperature as a community. What is the error?', 'A community includes living populations only; water temperature is an abiotic factor and is included when describing an ecosystem.', 'The difference between community and ecosystem is the inclusion of abiotic factors.'),
      ],
    },
    {
      topic: 'Dynamic Ecosystem',
      subtopic: 'Food webs & energy flow',
      title: 'Food Webs and Energy Flow',
      difficulty: 'medium',
      blocks: [
        section('Concept', `A food chain shows feeding relationships and energy flow in one pathway, while a food web links many food chains in a community. Producers convert light energy into chemical energy by photosynthesis. Consumers obtain energy by feeding on other organisms, and decomposers break down dead matter and recycle nutrients. Energy is lost as heat and through waste at each trophic level, so less energy is available at higher levels.`),
        section('Worked Example', `In a paddy field, rice plants are producers, grasshoppers are primary consumers, frogs are secondary consumers and snakes may be tertiary consumers. If frog numbers fall, grasshopper numbers may rise and damage rice plants. A food web helps predict these indirect effects better than a single food chain.`),
        section('Misconceptions', `Arrows in food chains point from food to feeder because they show energy transfer. Decomposers are not outside the food web; they act on dead material from all trophic levels. Energy is not recycled in ecosystems, but nutrients can be recycled.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Producer (Pengeluar) | Organism that makes organic food, usually by photosynthesis. |
| Consumer (Pengguna) | Organism that obtains energy by feeding on other organisms. |
| Decomposer (Pengurai) | Organism that breaks down dead matter and wastes. |
| Trophic level (Aras trof) | Feeding position in a food chain or web. |
| Food web (Siratan makanan) | Network of interconnected food chains. |
| Energy flow (Aliran tenaga) | Transfer of energy through feeding relationships. |`),
        section('Mnemonic', `Arrows follow energy: Food first, feeder next.`),
      ],
      questions: [
        mc('In the food chain grass -> grasshopper -> frog -> snake, what is the frog?', ['Producer', 'Primary consumer', 'Secondary consumer', 'Decomposer'], 2, 'The frog eats the primary consumer, so it is a secondary consumer.'),
        mc('Why are food chains usually limited to a few trophic levels?', ['Energy is lost at each transfer', 'Producers cannot photosynthesise', 'Predators always reproduce faster', 'Decomposers remove all oxygen'], 0, 'Only part of the energy in one trophic level becomes biomass for the next level.'),
        tf('In food webs, arrows point from predator to prey.', false, 'Arrows point from the organism being eaten to the organism that receives the energy.'),
        representationMatch('Match each food web term with its example.', {
          Producer: 'Rice plant making glucose by photosynthesis',
          'Primary consumer': 'Grasshopper feeding on rice leaves',
          'Secondary consumer': 'Frog feeding on grasshopper',
          Decomposer: 'Fungus breaking down dead leaves',
        }, 'Trophic roles are determined by how the organism obtains energy.'),
        stepOrder('Arrange the general flow of energy and nutrient recycling in a food web.', ['Sunlight is captured by producers', 'Primary consumers feed on producers', 'Secondary consumers feed on primary consumers', 'Decomposers break down dead matter and wastes', 'Mineral nutrients return to the environment'], 'Energy flows through feeding while decomposers recycle nutrients.'),
        errorDiagnosis('A student draws an arrow from eagle to mouse because the eagle eats the mouse. What is the error?', 'The arrow should point from mouse to eagle because arrows show the direction of energy transfer from food to consumer.', 'Food web arrows follow energy movement, not attack direction.'),
      ],
    },
    {
      topic: 'Dynamic Ecosystem',
      subtopic: 'Carbon & nitrogen cycles',
      title: 'Carbon and Nitrogen Cycles',
      difficulty: 'hard',
      blocks: [
        section('Concept', `Matter is recycled in ecosystems through biogeochemical cycles. In the carbon cycle, photosynthesis removes carbon dioxide from the atmosphere, while respiration, decomposition and combustion release carbon dioxide. In the nitrogen cycle, nitrogen-fixing bacteria convert atmospheric nitrogen into ammonium compounds, nitrifying bacteria form nitrates, plants assimilate nitrates, and denitrifying bacteria return nitrogen gas to the atmosphere. These cycles keep essential elements available for living organisms.`),
        section('Worked Example', `Leguminous plants often have root nodules containing Rhizobium bacteria. These bacteria fix atmospheric nitrogen into compounds the plant can use to make amino acids and proteins. When plants and animals die, decomposers break down organic nitrogen compounds and return ammonium compounds to the soil.`),
        section('Misconceptions', `Most plants cannot use nitrogen gas directly from the air. Denitrification does not increase soil nitrate; it converts nitrates back into nitrogen gas. Carbon dioxide is released not only by combustion, but also by respiration and decomposition.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Photosynthesis (Fotosintesis) | Process that removes carbon dioxide to make glucose. |
| Respiration (Respirasi) | Process that releases carbon dioxide from organic molecules. |
| Decomposition (Pereputan) | Breakdown of dead matter by decomposers. |
| Nitrogen fixation (Pengikatan nitrogen) | Conversion of nitrogen gas into ammonium compounds. |
| Nitrification (Nitrifikasi) | Conversion of ammonium compounds into nitrates by bacteria. |
| Denitrification (Denitrifikasi) | Conversion of nitrates into nitrogen gas by bacteria. |`),
        section('Mnemonic', `Nitrogen cycle core: Fix, Nitrify, Assimilate, Decompose, Denitrify.`),
      ],
      questions: [
        mc('Which process removes carbon dioxide from the atmosphere and fixes carbon into glucose?', ['Respiration', 'Photosynthesis', 'Combustion', 'Denitrification'], 1, 'Photosynthesis uses carbon dioxide to make glucose.'),
        mc('What do nitrogen-fixing bacteria in root nodules do?', ['Convert nitrates into nitrogen gas', 'Convert atmospheric nitrogen into usable nitrogen compounds', 'Release oxygen from water', 'Break glucose into carbon dioxide'], 1, 'Nitrogen fixation converts nitrogen gas into compounds that can enter food chains.'),
        tf('Most plants absorb nitrogen directly as nitrogen gas through their leaves.', false, 'Plants usually absorb nitrogen as nitrate ions or ammonium compounds through roots.'),
        representationMatch('Match each cycle process with its effect.', {
          Photosynthesis: 'Removes carbon dioxide from the atmosphere',
          Respiration: 'Releases carbon dioxide from living cells',
          Nitrification: 'Converts ammonium compounds into nitrates',
          Denitrification: 'Returns nitrogen gas to the atmosphere',
        }, 'Each process moves carbon or nitrogen between stores.'),
        stepOrder('Arrange key steps in the nitrogen cycle.', ['Nitrogen-fixing bacteria convert nitrogen gas to ammonium compounds', 'Nitrifying bacteria convert ammonium compounds to nitrates', 'Plants absorb nitrates through roots', 'Animals obtain nitrogen by feeding on plants or other animals', 'Decomposers return ammonium compounds from wastes and dead matter', 'Denitrifying bacteria convert nitrates to nitrogen gas'], 'The nitrogen cycle depends strongly on bacterial processes.'),
        errorDiagnosis('A student says denitrification increases soil nitrate for plants. What is the error?', 'Denitrification converts nitrates into nitrogen gas, reducing soil nitrate availability rather than increasing it.', 'Nitrification increases nitrate; denitrification removes nitrate.'),
      ],
    },
    {
      topic: 'Endangered Ecosystem',
      subtopic: 'Threats to biodiversity',
      title: 'Threats to Biodiversity',
      difficulty: 'easy',
      blocks: [
        section('Concept', `Biodiversity is the variety of life at genetic, species and ecosystem levels. High biodiversity usually improves ecosystem stability because different species can support overlapping roles. Major threats include habitat destruction, pollution, overexploitation, invasive species and climate change. These threats can reduce population size, cause local extinction and disrupt food webs.`),
        section('Worked Example', `When a forest is cleared for development, many species lose food sources, shelter and breeding sites. Fragmented forest patches may isolate small populations, reducing genetic diversity and making them more vulnerable to disease or environmental change. Predators, pollinators and decomposers can all be affected.`),
        section('Misconceptions', `Biodiversity is not only the number of large animals in a habitat. A species can be threatened even before it disappears completely. Pollution can harm organisms slowly through bioaccumulation, reduced fertility or weakened immunity, not only through immediate death.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Biodiversity (Biodiversiti) | Variety of genes, species and ecosystems. |
| Habitat loss (Kehilangan habitat) | Destruction or reduction of places where organisms live. |
| Poaching (Pemburuan haram) | Illegal hunting or capturing of wildlife. |
| Invasive species (Spesies invasif) | Non-native species that spreads and harms native ecosystems. |
| Pollution (Pencemaran) | Release of harmful substances into the environment. |
| Climate change (Perubahan iklim) | Long-term change in climate patterns affecting ecosystems. |`),
        section('Mnemonic', `HIPPO-C helps recall major threats: Habitat loss, Invasive species, Pollution, Poaching or overuse, and Climate change.`),
      ],
      questions: [
        mc('Which threat is usually the largest direct cause of terrestrial biodiversity loss?', ['Habitat loss and fragmentation', 'Photosynthesis', 'Balanced food webs', 'Seed dispersal'], 0, 'Destroying and fragmenting habitats removes shelter, food sources and breeding sites.'),
        mc('An introduced predator spreads rapidly because it has no natural enemies. What threat is this?', ['Invasive species', 'In situ conservation', 'Succession', 'Nitrogen fixation'], 0, 'An invasive species is a non-native organism that harms native ecosystems.'),
        tf('High biodiversity usually makes ecosystems less stable because there are too many species.', false, 'High biodiversity often improves stability because ecosystem roles are shared across more species.'),
        representationMatch('Match each threat with a likely effect.', {
          'Habitat loss': 'Reduces shelter, food and breeding sites',
          Poaching: 'Removes individuals faster than populations can recover',
          Pollution: 'Can poison organisms and accumulate in food chains',
          'Invasive species': 'Competes with or preys on native species',
        }, 'Different threats reduce biodiversity through different mechanisms.'),
        stepOrder('Arrange a scientific approach to assessing a biodiversity threat.', ['Identify the species and habitat affected', 'Collect evidence of population change', 'Link the change to likely threats', 'Estimate severity and whether damage can be reversed', 'Choose a suitable conservation response'], 'Threat assessment should be evidence-based before conservation action is selected.'),
        errorDiagnosis('A student says pollution is only a threat when animals die immediately. What is the error?', 'Pollution can also cause chronic effects such as reduced fertility, bioaccumulation, weakened immunity and habitat degradation.', 'Many ecological effects appear gradually across individuals and generations.'),
      ],
    },
    {
      topic: 'Endangered Ecosystem',
      subtopic: 'Conservation strategies',
      title: 'Conservation Strategies',
      difficulty: 'medium',
      blocks: [
        section('Concept', `Conservation protects biodiversity and ecosystem function for present and future generations. In situ conservation protects species in their natural habitats, such as national parks, forest reserves and marine parks. Ex situ conservation protects species outside their natural habitats, such as in seed banks, botanical gardens, aquaria and captive breeding centres. Effective conservation also includes law enforcement, habitat restoration, sustainable resource use, education and long-term monitoring.`),
        section('Worked Example', `A turtle conservation plan may protect nesting beaches, reduce egg collection, control artificial lighting, monitor nests and educate nearby communities. Hatcheries can support ex situ protection for eggs, but the beach habitat must still be protected for long-term survival. The best strategy often combines habitat protection with targeted support for vulnerable life stages.`),
        section('Misconceptions', `Zoos and breeding centres alone cannot replace healthy natural habitats. Reforestation is most useful when suitable native species are planted and the causes of forest loss are controlled. Releasing captive-bred animals without disease checks, genetic planning and habitat assessment can harm wild populations.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| In situ conservation (Pemuliharaan in situ) | Protecting species within their natural habitats. |
| Ex situ conservation (Pemuliharaan ex situ) | Protecting species outside their natural habitats. |
| Protected area (Kawasan perlindungan) | Managed area set aside to conserve ecosystems or species. |
| Seed bank (Bank biji benih) | Facility storing seeds to preserve plant genetic diversity. |
| Sustainable use (Penggunaan lestari) | Using resources at a rate that does not deplete them. |
| Reforestation (Penghutanan semula) | Replanting trees to restore forest cover. |`),
        section('Mnemonic', `In situ means "in its site"; ex situ means "external site".`),
      ],
      questions: [
        mc('Protecting orangutans inside a national park is an example of', ['ex situ conservation', 'in situ conservation', 'fermentation', 'denitrification'], 1, 'In situ conservation protects species in their natural habitat.'),
        mc('Which example is ex situ conservation?', ['Marine park protecting coral reefs', 'Forest reserve protecting hornbills', 'Seed bank storing plant seeds', 'Wildlife corridor connecting forests'], 2, 'A seed bank stores genetic material outside the natural habitat.'),
        tf('Ex situ conservation is always better because the species is separated from threats.', false, 'Ex situ methods are useful but cannot replace protection of natural habitats and ecological interactions.'),
        representationMatch('Match each strategy with its conservation category.', {
          'National park': 'In situ protection of natural habitat',
          'Seed bank': 'Ex situ storage of plant genetic material',
          'Captive breeding': 'Ex situ support for small populations',
          'Wildlife corridor': 'In situ connection between habitat fragments',
        }, 'Conservation methods are classified by whether they happen inside or outside the natural habitat.'),
        stepOrder('Arrange the steps of a practical conservation plan.', ['Survey the population and identify threats', 'Protect or restore critical habitat', 'Control hunting, pollution or invasive species', 'Breed or propagate individuals if needed', 'Monitor the population and adjust management'], 'Conservation is an ongoing cycle of evidence, action and monitoring.'),
        errorDiagnosis('A student releases captive-bred animals into any forest without checking conditions. What is the error?', 'Release sites must match the species habitat needs and be checked for disease risk, food supply, genetic suitability and threat control.', 'Poorly planned release can fail or harm existing wild populations.'),
      ],
    },
    {
      topic: 'Coordination & Response',
      subtopic: 'Nervous system',
      title: 'Nervous System',
      difficulty: 'medium',
      blocks: [
        section('Concept', `The nervous system detects stimuli and coordinates rapid responses. The central nervous system consists of the brain and spinal cord, while the peripheral nervous system consists of nerves connecting the body to the CNS. Neurons transmit electrical impulses in one direction. A typical pathway involves receptors, sensory neurons, relay neurons, motor neurons and effectors such as muscles or glands.`),
        section('Worked Example', `When a finger touches a hot surface, pain receptors detect the stimulus. A sensory neuron carries the impulse to the spinal cord, a relay neuron passes it to a motor neuron, and the motor neuron stimulates muscles to contract and pull the finger away. The brain becomes aware of the pain shortly after the reflex response begins.`),
        section('Misconceptions', `A reflex action does not require conscious decision before the first response. Sensory neurons do not carry impulses from the CNS to muscles; motor neurons do that. Synapses are gaps where chemical neurotransmitters pass signals between neurons.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Neuron (Neuron) | Nerve cell specialised to transmit impulses. |
| Dendrite (Dendrit) | Branch that receives impulses towards the cell body. |
| Axon (Akson) | Long fibre carrying impulses away from the cell body. |
| Synapse (Sinaps) | Junction between neurons or between neuron and effector. |
| Reflex arc (Arka refleks) | Pathway for a rapid involuntary response. |
| Central nervous system (Sistem saraf pusat) | Brain and spinal cord. |`),
        section('Mnemonic', `Reflex pathway: Receptor, Sensory, Relay, Motor, Effector - R-S-R-M-E.`),
      ],
      questions: [
        mc('Which neuron carries impulses from a receptor towards the central nervous system?', ['Motor neuron', 'Sensory neuron', 'Effector neuron', 'Endocrine neuron'], 1, 'Sensory neurons carry impulses from receptors to the CNS.'),
        mc('What is the small junction between two neurons called?', ['Synapse', 'Villus', 'Alveolus', 'Lacteal'], 0, 'A synapse is the junction where signals pass between neurons.'),
        tf('A reflex action must be processed consciously by the cerebrum before the body responds.', false, 'Many reflexes are coordinated through the spinal cord before conscious awareness.'),
        representationMatch('Match each nervous system component with its role.', {
          Receptor: 'Detects a stimulus',
          'Sensory neuron': 'Carries impulse to the CNS',
          'Relay neuron': 'Passes impulse within the CNS',
          'Motor neuron': 'Carries impulse from CNS to effector',
          Effector: 'Produces the response',
        }, 'The reflex arc has a fixed direction of impulse flow.'),
        stepOrder('Arrange the events in a withdrawal reflex.', ['Receptor detects a painful stimulus', 'Sensory neuron carries impulse to the spinal cord', 'Relay neuron passes impulse within the CNS', 'Motor neuron carries impulse to the muscle', 'Muscle contracts to withdraw the body part'], 'Reflex responses use a short pathway for fast protection.'),
        errorDiagnosis('A student says a motor neuron carries an impulse from a receptor to the spinal cord. What is the error?', 'A sensory neuron carries impulses from receptors to the CNS; a motor neuron carries impulses from the CNS to effectors.', 'Neuron names describe the direction and role of impulse transmission.'),
      ],
    },
    {
      topic: 'Coordination & Response',
      subtopic: 'Endocrine system',
      title: 'Endocrine System',
      difficulty: 'hard',
      blocks: [
        section('Concept', `The endocrine system coordinates body activities using hormones secreted by ductless glands directly into the bloodstream. Hormones travel in blood but only target cells with specific receptors respond. Endocrine responses are usually slower than nervous responses but often last longer. Negative feedback helps maintain stable internal conditions, such as blood glucose concentration and metabolic rate.`),
        section('Worked Example', `After a meal, blood glucose concentration rises. The pancreas detects the increase and beta cells secrete insulin into the blood. Insulin stimulates liver and muscle cells to take up glucose and convert excess glucose to glycogen, bringing blood glucose back towards normal.`),
        section('Misconceptions', `Hormones do not travel along neurons; they are transported in the blood. Endocrine glands are ductless, unlike exocrine glands that release secretions through ducts. All body cells may be exposed to a hormone, but only target cells with suitable receptors respond strongly.`),
        section('Key Terms', `| Term | Definition |
|---|---|
| Endocrine gland (Kelenjar endokrin) | Ductless gland that secretes hormones into blood. |
| Hormone (Hormon) | Chemical messenger carried in blood to target organs. |
| Target organ (Organ sasaran) | Organ or tissue with receptors for a specific hormone. |
| Insulin (Insulin) | Pancreatic hormone that lowers blood glucose concentration. |
| Thyroxine (Tiroksina) | Thyroid hormone that regulates metabolic rate and development. |
| Adrenaline (Adrenalina) | Adrenal hormone preparing the body for emergency action. |
| Negative feedback (Maklum balas negatif) | Control mechanism that reverses a change from the normal range. |`),
        section('Mnemonic', `Endocrine is blood-borne and slower; nerves are wired and faster.`),
      ],
      questions: [
        mc('Which gland secretes insulin to help regulate blood glucose concentration?', ['Pancreas', 'Thyroid gland', 'Adrenal gland', 'Pituitary gland'], 0, 'Beta cells in the pancreas secrete insulin when blood glucose rises.'),
        mc('Which hormone prepares the body for fight-or-flight responses?', ['Insulin', 'Adrenaline', 'Thyroxine', 'Oestrogen'], 1, 'Adrenaline increases heart rate, breathing rate and glucose availability during emergencies.'),
        tf('Hormones travel along neurons to reach target organs.', false, 'Hormones are chemical messengers transported in the bloodstream.'),
        representationMatch('Match each hormone or control term with its function.', {
          Insulin: 'Lowers blood glucose by promoting glucose uptake and glycogen formation',
          Adrenaline: 'Prepares the body for emergency action',
          Thyroxine: 'Regulates metabolic rate',
          'Negative feedback': 'Reverses changes to maintain a normal range',
        }, 'Hormones coordinate specific target responses.'),
        stepOrder('Arrange the regulation of blood glucose after a carbohydrate-rich meal.', ['Blood glucose concentration rises', 'Pancreas detects the rise', 'Beta cells secrete insulin into the blood', 'Liver and muscle cells take up more glucose', 'Excess glucose is stored as glycogen', 'Blood glucose returns towards normal'], 'Insulin is part of a negative feedback response to high blood glucose.'),
        errorDiagnosis('A student says insulin converts glycogen to glucose when blood sugar is high. What is the error?', 'Insulin promotes glucose uptake and conversion of glucose to glycogen; glucagon promotes glycogen breakdown when blood glucose is low.', 'Insulin and glucagon have opposite roles in blood glucose regulation.'),
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.question,
        question.options,
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm4Chemistry(client) {
  const subject = 'Kimia';
  const formLevel = 4;

  const mc = (questionText, options, optionIndex, explanation, points = 1) => ({
    type: 'multiple_choice',
    questionText,
    options,
    correctAnswer: { optionIndex },
    explanation,
    points,
  });

  const tf = (questionText, correct, explanation, points = 1) => ({
    type: 'true_false',
    questionText,
    options: ['true', 'false'],
    correctAnswer: correct ? 'true' : 'false',
    explanation,
    points,
  });

  const numeric = (questionText, value, tolerance, unit, explanation, points = 2) => ({
    type: 'numeric',
    questionText,
    options: [],
    correctAnswer: { value, tolerance, unit },
    explanation,
    points,
  });

  const representation = (questionText, pairs, explanation, points = 2) => ({
    type: 'representation_match',
    questionText,
    options: pairs.map(([prompt, answer]) => ({ prompt, answer })),
    correctAnswer: Object.fromEntries(pairs),
    explanation,
    points,
  });

  const stepOrder = (questionText, options, correctAnswer, explanation, points = 2) => ({
    type: 'step_order',
    questionText,
    options,
    correctAnswer,
    explanation,
    points,
  });

  const errorDiagnosis = (questionText, correctAnswer, explanation, points = 2) => ({
    type: 'error_diagnosis',
    questionText,
    options: [],
    correctAnswer,
    explanation,
    points,
  });

  const lessons = [
    {
      topic: 'Matter',
      subtopic: 'Particle theory & states of matter',
      title: 'Jirim: Teori Zarah dan Keadaan Jirim',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep',
          'Jirim terdiri daripada zarah halus yang sentiasa bergerak. Dalam pepejal, zarah tersusun rapat dan hanya bergetar pada kedudukan tetap. Dalam cecair, zarah masih rapat tetapi boleh menggelongsor antara satu sama lain, manakala dalam gas zarah berjauhan dan bergerak bebas. Perubahan keadaan berlaku apabila tenaga haba mengubah tenaga kinetik zarah dan mengatasi daya tarikan antara zarah.'
        ),
        section(
          'Contoh Kerja',
          'Apabila ais dipanaskan, suhu meningkat sehingga takat lebur dicapai. Haba yang diserap semasa peleburan digunakan untuk melemahkan daya tarikan antara zarah, bukan untuk menaikkan suhu. Selepas semua ais menjadi air, pemanasan seterusnya menambah tenaga kinetik zarah air sehingga pendidihan berlaku dan wap air terbentuk.'
        ),
        section(
          'Kekeliruan Lazim',
          'Zarah tidak menjadi lebih besar apabila bahan dipanaskan. Zarah juga tidak hilang apabila cecair menyejat; susunan dan jarak antara zarah sahaja berubah. Semasa perubahan keadaan, jenis zarah kekal sama, jadi perubahan itu ialah perubahan fizik dan biasanya boleh diterbalikkan.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Zarah | Unit kecil yang membina jirim. |
| Tenaga kinetik | Tenaga yang dimiliki zarah kerana pergerakan. |
| Takat lebur | Suhu apabila pepejal berubah menjadi cecair. |
| Takat didih | Suhu apabila cecair berubah menjadi gas di seluruh cecair. |`
        ),
        section(
          'Cara Ingat',
          'Ingat susunan "rapat tetap, rapat gelongsor, jauh bebas": pepejal rapat dan tetap, cecair rapat tetapi menggelongsor, gas jauh dan bebas.'
        ),
      ],
      questions: [
        mc(
          'Susunan zarah manakah menerangkan pepejal?',
          [
            'Zarah berjauhan dan bergerak bebas',
            'Zarah tersusun rapat dan bergetar pada kedudukan tetap',
            'Zarah rapat tetapi bergerak rawak memenuhi seluruh bekas',
            'Zarah hilang apabila bahan disejukkan',
          ],
          1,
          'Pepejal mempunyai zarah yang rapat, tersusun dan hanya bergetar pada kedudukan tetap.'
        ),
        mc(
          'Apakah nama perubahan apabila cecair menjadi gas pada permukaan cecair di bawah takat didih?',
          ['Pemejalwapan', 'Pendidihan', 'Penyejatan', 'Pembekuan'],
          2,
          'Penyejatan berlaku pada permukaan cecair dan boleh berlaku di bawah takat didih.'
        ),
        tf(
          'Semasa ais mencair, zarah air menjadi lebih besar.',
          false,
          'Saiz zarah tidak berubah; jarak dan susunan zarah berubah apabila daya tarikan antara zarah dilemahkan.'
        ),
        numeric(
          'Sampel cecair berjisim 48 g mempunyai isipadu 24 cm3. Berapakah ketumpatannya?',
          2,
          0.01,
          'g cm-3',
          'Ketumpatan = jisim / isipadu = 48 g / 24 cm3 = 2 g cm-3.'
        ),
        stepOrder(
          'Susun perubahan apabila ais dipanaskan sehingga menjadi stim.',
          [
            'Air mendidih apabila daya tarikan antara zarah diatasi',
            'Ais menyerap haba dan zarah bergetar lebih kuat',
            'Zarah gas bergerak bebas sebagai stim',
            'Ais melebur menjadi air',
          ],
          [
            'Ais menyerap haba dan zarah bergetar lebih kuat',
            'Ais melebur menjadi air',
            'Air mendidih apabila daya tarikan antara zarah diatasi',
            'Zarah gas bergerak bebas sebagai stim',
          ],
          'Pemanasan menambah tenaga, menyebabkan peleburan dahulu dan kemudian pendidihan.'
        ),
        errorDiagnosis(
          'Seorang murid berkata wap air tidak lagi terdiri daripada zarah air kerana wap itu tidak kelihatan. Apakah ralatnya?',
          'Wap air masih terdiri daripada molekul H2O; zarahnya berjauhan dan tidak mudah dilihat, bukan hilang.',
          'Gas boleh tidak kelihatan walaupun zarah bahan masih wujud.'
        ),
      ],
    },
    {
      topic: 'Matter',
      subtopic: 'Elements, compounds & mixtures',
      title: 'Jirim: Unsur, Sebatian dan Campuran',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep',
          'Unsur ialah bahan yang terdiri daripada satu jenis atom sahaja. Sebatian terbentuk apabila dua atau lebih unsur bergabung secara kimia dalam nisbah tetap. Campuran pula mengandungi dua atau lebih bahan yang bercampur secara fizikal dan boleh dipisahkan dengan kaedah fizik seperti penurasan, penyulingan atau penyejatan.'
        ),
        section(
          'Contoh Kerja',
          'Serbuk besi dan serbuk sulfur membentuk campuran jika hanya digaul bersama, maka besi masih boleh ditarik oleh magnet. Jika campuran itu dipanaskan kuat, besi dan sulfur bertindak balas menghasilkan besi(II) sulfida, FeS. Besi(II) sulfida ialah sebatian kerana sifatnya berbeza daripada besi dan sulfur asal.'
        ),
        section(
          'Kekeliruan Lazim',
          'Campuran tidak mempunyai formula kimia tetap, tetapi sebatian mempunyai formula tetap. Air laut ialah campuran kerana kandungan garamnya boleh berubah, manakala air tulen, H2O, ialah sebatian. Kaedah pemisahan fizik tidak boleh memecahkan sebatian kepada unsur-unsurnya.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Unsur | Bahan yang mengandungi satu jenis atom sahaja. |
| Sebatian | Bahan yang terbentuk melalui gabungan kimia unsur dalam nisbah tetap. |
| Campuran | Gabungan fizikal dua atau lebih bahan. |
| Penurasan | Kaedah memisahkan pepejal tidak larut daripada cecair. |`
        ),
        section(
          'Cara Ingat',
          'Gunakan ayat "Unsur satu, sebatian setia, campuran cerai": unsur satu jenis atom, sebatian setia pada nisbah tetap, campuran boleh dicerai secara fizik.'
        ),
      ],
      questions: [
        mc(
          'Antara bahan berikut, yang manakah sebatian?',
          ['Oksigen, O2', 'Air suling, H2O', 'Udara', 'Serbuk besi'],
          1,
          'Air suling ialah H2O, gabungan kimia hidrogen dan oksigen dalam nisbah tetap.'
        ),
        mc(
          'Kaedah paling sesuai untuk memisahkan campuran garam dan pasir ialah',
          [
            'menambah air, menuras pasir, kemudian menyejat larutan garam',
            'menggunakan magnet untuk menarik garam',
            'memanaskan terus sehingga pasir melebur',
            'menambah asid supaya garam hilang',
          ],
          0,
          'Garam larut dalam air manakala pasir tidak larut, jadi kedua-duanya boleh dipisahkan melalui pelarutan, penurasan dan penyejatan.'
        ),
        tf(
          'Sebatian mempunyai komposisi tetap manakala campuran boleh mempunyai komposisi berubah.',
          true,
          'Formula sebatian tetap, tetapi nisbah komponen campuran boleh berubah.'
        ),
        representation(
          'Padankan perwakilan A, B dan C dengan jenis jirim yang betul.',
          [
            ['A', 'Unsur: satu jenis atom sahaja'],
            ['B', 'Sebatian: atom berlainan terikat secara kimia'],
            ['C', 'Campuran: bahan bercampur secara fizikal'],
          ],
          'Model zarah boleh menunjukkan sama ada bahan ialah unsur, sebatian atau campuran.'
        ),
        stepOrder(
          'Susun langkah memisahkan garam daripada campuran garam dan pasir.',
          [
            'Sejatkan turasan untuk mendapatkan hablur garam',
            'Tambahkan air dan kacau supaya garam larut',
            'Turaskan untuk mengasingkan pasir',
            'Kumpulkan larutan garam sebagai turasan',
          ],
          [
            'Tambahkan air dan kacau supaya garam larut',
            'Turaskan untuk mengasingkan pasir',
            'Kumpulkan larutan garam sebagai turasan',
            'Sejatkan turasan untuk mendapatkan hablur garam',
          ],
          'Gunakan perbezaan keterlarutan: garam larut dalam air, pasir tidak.'
        ),
        errorDiagnosis(
          'Seorang murid berkata air ialah campuran kerana air boleh disejat menjadi wap. Apakah ralatnya?',
          'Air tulen ialah sebatian H2O; penyejatan hanya mengubah keadaan fizik, bukan memisahkan air kepada hidrogen dan oksigen.',
          'Perubahan keadaan tidak menentukan sama ada bahan itu campuran atau sebatian.'
        ),
      ],
    },
    {
      topic: 'Atomic Structure',
      subtopic: 'Proton, neutron, electron',
      title: 'Struktur Atom: Proton, Neutron dan Elektron',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep',
          'Atom mempunyai nukleus kecil yang mengandungi proton dan neutron. Elektron bergerak di luar nukleus dalam petala elektron. Nombor proton menentukan identiti unsur, manakala nombor nukleon ialah jumlah proton dan neutron. Bagi atom neutral, bilangan proton adalah sama dengan bilangan elektron.'
        ),
        section(
          'Contoh Kerja',
          'Klorin-35 mempunyai nombor proton 17 dan nombor nukleon 35. Oleh itu atom neutral klorin mempunyai 17 proton, 17 elektron dan 18 neutron. Bilangan neutron diperoleh daripada nombor nukleon tolak nombor proton, iaitu 35 - 17 = 18.'
        ),
        section(
          'Kekeliruan Lazim',
          'Elektron tidak menyumbang secara signifikan kepada nombor nukleon. Menukar bilangan neutron menghasilkan isotop, bukan unsur baharu. Menukar bilangan elektron menghasilkan ion, tetapi nombor proton unsur itu masih sama.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Proton | Zarah bercas positif dalam nukleus. |
| Neutron | Zarah neutral dalam nukleus. |
| Elektron | Zarah bercas negatif di luar nukleus. |
| Nombor nukleon | Jumlah proton dan neutron dalam atom. |`
        ),
        section(
          'Cara Ingat',
          'Ingat "Proton ialah pasport unsur": nombor proton menentukan unsur. "Nukleon = nukleus" membantu mengingat bahawa nombor nukleon hanya melibatkan proton dan neutron.'
        ),
      ],
      questions: [
        mc(
          'Nombor proton bagi sesuatu atom menunjukkan',
          ['jumlah proton dalam nukleus', 'jumlah proton dan neutron', 'jumlah elektron valens', 'jumlah petala elektron'],
          0,
          'Nombor proton ialah bilangan proton dan menentukan jenis unsur.'
        ),
        mc(
          'Atom neutral natrium mempunyai nombor proton 11. Berapakah bilangan elektronnya?',
          ['10', '11', '12', '23'],
          1,
          'Atom neutral mempunyai bilangan proton yang sama dengan bilangan elektron.'
        ),
        tf(
          'Nombor nukleon ialah jumlah proton dan neutron dalam nukleus.',
          true,
          'Nukleon merujuk kepada zarah dalam nukleus, iaitu proton dan neutron.'
        ),
        numeric(
          'Magnesium-24 mempunyai nombor proton 12. Berapakah bilangan neutronnya?',
          12,
          0,
          'neutron',
          'Bilangan neutron = nombor nukleon - nombor proton = 24 - 12 = 12.'
        ),
        stepOrder(
          'Susun langkah menentukan proton, neutron dan elektron bagi atom neutral X-27 dengan nombor proton 13.',
          [
            'Tentukan elektron sama dengan proton kerana atom neutral',
            'Kenal pasti nombor nukleon 27',
            'Ambil nombor proton sebagai 13',
            'Tolak 13 daripada 27 untuk mendapatkan neutron',
          ],
          [
            'Kenal pasti nombor nukleon 27',
            'Ambil nombor proton sebagai 13',
            'Tolak 13 daripada 27 untuk mendapatkan neutron',
            'Tentukan elektron sama dengan proton kerana atom neutral',
          ],
          'Maklumat nukleon dan proton digunakan dahulu sebelum menentukan neutron dan elektron.'
        ),
        errorDiagnosis(
          'Seorang murid mengira nombor nukleon karbon-12 sebagai 18 kerana menambah 6 proton, 6 neutron dan 6 elektron. Apakah ralatnya?',
          'Nombor nukleon hanya jumlah proton dan neutron; elektron tidak termasuk dalam nombor nukleon.',
          'Karbon-12 mempunyai 6 proton dan 6 neutron, jadi nombor nukleonnya 12.'
        ),
      ],
    },
    {
      topic: 'Atomic Structure',
      subtopic: 'Electron configuration',
      title: 'Struktur Atom: Susunan Elektron',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Susunan elektron menunjukkan pengagihan elektron dalam petala atom. Untuk 20 unsur pertama, petala pertama boleh memuatkan 2 elektron, petala kedua 8 elektron dan petala ketiga biasanya diisi sehingga 8 sebelum petala keempat bermula. Bilangan petala berisi menunjukkan kala, manakala bilangan elektron valens bagi unsur kumpulan utama menunjukkan kumpulan dan sifat kimia.'
        ),
        section(
          'Contoh Kerja',
          'Magnesium mempunyai nombor proton 12, jadi atom neutralnya mempunyai 12 elektron. Susunan elektronnya ialah 2.8.2: dua elektron dalam petala pertama, lapan dalam petala kedua dan dua elektron valens dalam petala ketiga. Oleh itu magnesium berada dalam Kala 3 dan Kumpulan 2.'
        ),
        section(
          'Kekeliruan Lazim',
          'Jangan tulis 2.8.9 untuk kalium. Bagi aras ini, kalium ditulis sebagai 2.8.8.1 kerana petala keempat mula diisi selepas konfigurasi argon. Bilangan petala dan elektron valens perlu dibaca daripada susunan yang betul.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Petala elektron | Aras di luar nukleus yang ditempati elektron. |
| Elektron valens | Elektron pada petala terluar. |
| Kala | Baris mendatar dalam Jadual Berkala. |
| Kumpulan | Lajur menegak dalam Jadual Berkala. |`
        ),
        section(
          'Cara Ingat',
          'Gunakan corak "2, 8, 8, keluar" untuk 20 unsur pertama. Bilang titik dalam susunan: petala berisi memberi kala, elektron paling luar memberi kumpulan utama.'
        ),
      ],
      questions: [
        mc(
          'Berapakah bilangan maksimum elektron dalam petala pertama?',
          ['1', '2', '8', '18'],
          1,
          'Petala pertama hanya boleh memuatkan maksimum 2 elektron.'
        ),
        mc(
          'Unsur yang mempunyai susunan elektron 2.8.7 berada dalam kumpulan utama manakah?',
          ['Kumpulan 1', 'Kumpulan 2', 'Kumpulan 17', 'Kumpulan 18'],
          2,
          'Susunan 2.8.7 mempunyai 7 elektron valens, maka unsur itu berada dalam Kumpulan 17.'
        ),
        tf(
          'Unsur yang mempunyai bilangan elektron valens sama cenderung mempunyai sifat kimia yang serupa.',
          true,
          'Elektron valens menentukan cara atom bertindak balas secara kimia.'
        ),
        representation(
          'Padankan susunan elektron dengan kedudukan Jadual Berkala yang betul.',
          [
            ['A', '2.8.1: Kala 3, Kumpulan 1'],
            ['B', '2.8.7: Kala 3, Kumpulan 17'],
          ],
          'Bilangan petala berisi memberi kala, manakala elektron valens memberi kumpulan utama.'
        ),
        stepOrder(
          'Susun langkah menulis susunan elektron bagi kalsium, nombor proton 20.',
          [
            'Isi petala ketiga dengan 8 elektron',
            'Isi petala pertama dengan 2 elektron',
            'Letakkan baki 2 elektron dalam petala keempat',
            'Tentukan atom neutral kalsium mempunyai 20 elektron',
            'Isi petala kedua dengan 8 elektron',
          ],
          [
            'Tentukan atom neutral kalsium mempunyai 20 elektron',
            'Isi petala pertama dengan 2 elektron',
            'Isi petala kedua dengan 8 elektron',
            'Isi petala ketiga dengan 8 elektron',
            'Letakkan baki 2 elektron dalam petala keempat',
          ],
          'Kalsium ditulis sebagai 2.8.8.2.'
        ),
        errorDiagnosis(
          'Seorang murid menulis susunan elektron kalium sebagai 2.8.9. Apakah ralatnya?',
          'Bagi 20 unsur pertama, kalium perlu ditulis 2.8.8.1; petala keempat mula diisi selepas 2.8.8.',
          'Susunan 2.8.9 memberi bacaan elektron valens dan kala yang salah.'
        ),
      ],
    },
    {
      topic: 'Chemical Formulae & Equations',
      subtopic: 'Writing formulae',
      title: 'Formula Kimia: Menulis Formula Sebatian',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Formula kimia menunjukkan jenis atom dan nisbah atom atau ion dalam sesuatu bahan. Untuk sebatian ionik, jumlah cas positif dan negatif mesti seimbang menjadi sifar. Kaedah silang cas boleh digunakan, kemudian nisbah diringkaskan jika perlu. Ion poliatom seperti nitrat, karbonat dan sulfat perlu dikekalkan sebagai satu kumpulan dan diberi kurungan apabila bilangannya lebih daripada satu.'
        ),
        section(
          'Contoh Kerja',
          'Aluminium membentuk ion Al3+ dan oksida ialah O2-. Untuk menyeimbangkan cas, dua ion Al3+ memberi jumlah cas +6 dan tiga ion O2- memberi jumlah cas -6. Formula yang betul ialah Al2O3. Bagi magnesium nitrat, Mg2+ dan NO3- menghasilkan Mg(NO3)2 kerana dua ion nitrat diperlukan.'
        ),
        section(
          'Kekeliruan Lazim',
          'Jangan tulis cas dalam formula akhir sebatian neutral. Jangan ubah formula ion poliatom seperti SO4 atau NO3. Jika kedua-dua subskrip boleh diringkaskan, gunakan nisbah paling ringkas supaya Mg2O2 ditulis sebagai MgO.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Formula kimia | Lambang yang menunjukkan komposisi bahan. |
| Ion | Zarah bercas akibat kehilangan atau penerimaan elektron. |
| Ion poliatom | Kumpulan atom bercas yang bertindak sebagai satu ion. |
| Jisim formula relatif | Jumlah jisim atom relatif dalam satu formula. |`
        ),
        section(
          'Cara Ingat',
          'Gunakan urutan "cas, silang, ringkas, semak": tulis cas ion, silangkan nombor cas, ringkaskan nisbah, kemudian semak jumlah cas sifar.'
        ),
      ],
      questions: [
        mc(
          'Apakah formula bagi sebatian yang terbentuk daripada Mg2+ dan Cl-?',
          ['MgCl', 'MgCl2', 'Mg2Cl', 'Mg2Cl2'],
          1,
          'Satu Mg2+ memerlukan dua Cl- untuk menyeimbangkan cas, jadi formula ialah MgCl2.'
        ),
        mc(
          'Apakah formula natrium sulfat jika ionnya ialah Na+ dan SO4 2-?',
          ['NaSO4', 'Na2SO4', 'Na(SO4)2', 'Na2S'],
          1,
          'Dua ion Na+ diperlukan untuk menyeimbangkan satu ion SO4 2-.'
        ),
        tf(
          'Formula sebatian ionik yang betul mesti mempunyai jumlah cas keseluruhan sifar.',
          true,
          'Sebatian ionik neutral terbentuk apabila jumlah cas positif dan negatif seimbang.'
        ),
        numeric(
          'Hitung jisim formula relatif CaCO3. Diberi Ar: Ca = 40, C = 12, O = 16.',
          100,
          0,
          'g mol-1',
          'Mr CaCO3 = 40 + 12 + 3(16) = 100.'
        ),
        stepOrder(
          'Susun langkah menulis formula aluminium oksida daripada Al3+ dan O2-.',
          [
            'Semak jumlah cas: +6 dan -6',
            'Tulis formula Al2O3',
            'Silangkan nombor cas 3 dan 2',
            'Tulis ion Al3+ dan O2-',
          ],
          [
            'Tulis ion Al3+ dan O2-',
            'Silangkan nombor cas 3 dan 2',
            'Tulis formula Al2O3',
            'Semak jumlah cas: +6 dan -6',
          ],
          'Formula akhir mesti menunjukkan nisbah ion paling ringkas yang neutral.'
        ),
        errorDiagnosis(
          'Seorang murid menulis formula kalsium klorida sebagai CaCl. Apakah ralatnya?',
          'Kalsium ialah Ca2+ dan klorida ialah Cl-, jadi dua ion Cl- diperlukan; formula betul ialah CaCl2.',
          'CaCl tidak menyeimbangkan cas kerana +2 dan -1 masih meninggalkan cas +1.'
        ),
      ],
    },
    {
      topic: 'Chemical Formulae & Equations',
      subtopic: 'Balancing equations',
      title: 'Persamaan Kimia: Mengimbangkan Persamaan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Persamaan kimia seimbang mematuhi hukum keabadian jisim: bilangan atom setiap unsur adalah sama di sebelah bahan tindak balas dan hasil tindak balas. Pengimbangan dibuat dengan menambah pekali di hadapan formula. Subskrip dalam formula tidak boleh diubah kerana itu akan menukar identiti bahan. Keadaan fizik seperti (s), (l), (g) dan (aq) boleh ditambah selepas persamaan seimbang.'
        ),
        section(
          'Contoh Kerja',
          'Untuk pembakaran propana, mula dengan C3H8 + O2 -> CO2 + H2O. Seimbangkan karbon menjadi 3CO2, hidrogen menjadi 4H2O, kemudian kira oksigen di hasil: 3CO2 mempunyai 6 O dan 4H2O mempunyai 4 O, jumlah 10 O. Oleh itu diperlukan 5O2 dan persamaan seimbang ialah C3H8 + 5O2 -> 3CO2 + 4H2O.'
        ),
        section(
          'Kekeliruan Lazim',
          'Kesilapan paling biasa ialah mengubah H2O menjadi H2O2 atau MgO menjadi MgO2 untuk menyeimbangkan atom. Itu menukar bahan, bukan mengimbangkan persamaan. Gunakan pekali sahaja, dan semak setiap unsur pada akhir.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Pekali | Nombor di hadapan formula dalam persamaan kimia. |
| Subskrip | Nombor kecil dalam formula yang menunjukkan bilangan atom. |
| Bahan tindak balas | Bahan yang digunakan dalam tindak balas. |
| Hasil tindak balas | Bahan yang terbentuk selepas tindak balas. |`
        ),
        section(
          'Cara Ingat',
          'Gunakan "Kira, Letak, Semak": kira atom, letak pekali, semak semula kiri dan kanan. Jangan sentuh subskrip.'
        ),
      ],
      questions: [
        mc(
          'Persamaan manakah seimbang untuk pembakaran magnesium?',
          ['Mg + O2 -> MgO', '2Mg + O2 -> 2MgO', 'Mg2 + O2 -> 2MgO', '2Mg + 2O2 -> 2MgO'],
          1,
          'Kedua-dua belah mempunyai 2 atom Mg dan 2 atom O.'
        ),
        mc(
          'Apakah pekali bagi Fe, Cl2 dan FeCl3 dalam persamaan seimbang Fe + Cl2 -> FeCl3?',
          ['1, 1, 1', '2, 3, 2', '3, 2, 2', '2, 2, 3'],
          1,
          'Persamaan seimbang ialah 2Fe + 3Cl2 -> 2FeCl3.'
        ),
        tf(
          'Subskrip dalam formula boleh diubah untuk mengimbangkan persamaan kimia.',
          false,
          'Subskrip menentukan formula bahan; hanya pekali boleh diubah semasa pengimbangan.'
        ),
        numeric(
          'Bagi persamaan 2H2 + O2 -> 2H2O, jika 3.0 mol O2 bertindak balas dengan H2 berlebihan, berapa mol H2O terbentuk?',
          6,
          0.01,
          'mol',
          'Nisbah O2:H2O ialah 1:2, maka 3.0 mol O2 menghasilkan 6.0 mol H2O.'
        ),
        stepOrder(
          'Susun langkah mengimbangkan Al + O2 -> Al2O3.',
          [
            'Letakkan 4 di hadapan Al untuk seimbangkan aluminium',
            'Semak persamaan akhir 4Al + 3O2 -> 2Al2O3',
            'Letakkan 2 di hadapan Al2O3 supaya oksigen menjadi 6',
            'Letakkan 3 di hadapan O2 supaya oksigen kiri menjadi 6',
          ],
          [
            'Letakkan 2 di hadapan Al2O3 supaya oksigen menjadi 6',
            'Letakkan 3 di hadapan O2 supaya oksigen kiri menjadi 6',
            'Letakkan 4 di hadapan Al untuk seimbangkan aluminium',
            'Semak persamaan akhir 4Al + 3O2 -> 2Al2O3',
          ],
          'Menyamakan oksigen kepada 6 memudahkan pengimbangan, kemudian aluminium disemak.'
        ),
        errorDiagnosis(
          'Seorang murid mengimbangkan H2 + O2 -> H2O dengan menulis H2 + O2 -> H2O2. Apakah ralatnya?',
          'Murid itu mengubah formula air kepada hidrogen peroksida; pengimbangan mesti menggunakan pekali, contohnya 2H2 + O2 -> 2H2O.',
          'Mengubah subskrip menukar identiti bahan dan tidak mematuhi kaedah pengimbangan.'
        ),
      ],
    },
    {
      topic: 'Periodic Table',
      subtopic: 'Periods & groups',
      title: 'Jadual Berkala: Kala dan Kumpulan',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep',
          'Jadual Berkala moden menyusun unsur mengikut tertib menaik nombor proton. Baris mendatar dipanggil kala dan lajur menegak dipanggil kumpulan. Bagi unsur kumpulan utama, nombor kala berkaitan dengan bilangan petala elektron berisi, manakala nombor kumpulan berkaitan dengan bilangan elektron valens. Unsur dalam kumpulan yang sama mempunyai sifat kimia yang serupa.'
        ),
        section(
          'Contoh Kerja',
          'Natrium mempunyai nombor proton 11 dan susunan elektron 2.8.1. Tiga petala berisi menunjukkan natrium berada dalam Kala 3. Satu elektron valens menunjukkan natrium berada dalam Kumpulan 1, iaitu kumpulan logam alkali.'
        ),
        section(
          'Kekeliruan Lazim',
          'Jangan tentukan kumpulan berdasarkan jumlah petala. Jumlah petala menunjukkan kala, bukan kumpulan. Untuk unsur kumpulan utama, elektron valens ialah petunjuk yang lebih tepat untuk menentukan kumpulan.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Nombor proton | Bilangan proton dalam nukleus atom. |
| Kala | Baris mendatar dalam Jadual Berkala. |
| Kumpulan | Lajur menegak dalam Jadual Berkala. |
| Elektron valens | Elektron pada petala paling luar. |`
        ),
        section(
          'Cara Ingat',
          'Bayangkan jadual seperti alamat: kala ialah tingkat bangunan, kumpulan ialah nombor pintu. Susunan elektron memberi kedua-dua bahagian alamat itu.'
        ),
      ],
      questions: [
        mc(
          'Dalam Jadual Berkala, nombor kala bagi unsur kumpulan utama menunjukkan',
          ['bilangan neutron', 'bilangan petala elektron berisi', 'bilangan isotop', 'bilangan ikatan kovalen'],
          1,
          'Nombor kala berkaitan dengan bilangan petala elektron yang ditempati.'
        ),
        mc(
          'Unsur Kumpulan 18 dikenali sebagai',
          ['logam alkali', 'halogen', 'gas nadir', 'logam peralihan'],
          2,
          'Kumpulan 18 terdiri daripada gas nadir seperti helium, neon dan argon.'
        ),
        tf(
          'Dalam satu kala dari kiri ke kanan, nombor proton unsur meningkat.',
          true,
          'Jadual Berkala disusun mengikut nombor proton menaik.'
        ),
        representation(
          'Padankan perwakilan A, B dan C dengan maksudnya dalam Jadual Berkala.',
          [
            ['A', 'Kala: bilangan petala elektron berisi'],
            ['B', 'Kumpulan: bilangan elektron valens bagi unsur kumpulan utama'],
            ['C', 'Nombor proton: tertib asas susunan unsur'],
          ],
          'Perwakilan kedudukan dalam Jadual Berkala boleh dibaca daripada susunan elektron dan nombor proton.'
        ),
        stepOrder(
          'Susun langkah menentukan kedudukan unsur yang mempunyai susunan elektron 2.8.3.',
          [
            'Nyatakan unsur itu berada dalam Kala 3',
            'Kira tiga petala elektron berisi',
            'Nyatakan unsur itu berada dalam Kumpulan 13',
            'Kira tiga elektron valens',
          ],
          [
            'Kira tiga petala elektron berisi',
            'Nyatakan unsur itu berada dalam Kala 3',
            'Kira tiga elektron valens',
            'Nyatakan unsur itu berada dalam Kumpulan 13',
          ],
          'Tiga petala menunjukkan Kala 3, dan tiga elektron valens menunjukkan Kumpulan 13 bagi unsur kumpulan utama.'
        ),
        errorDiagnosis(
          'Seorang murid meletakkan aluminium dalam Kumpulan 3 kerana susunan elektronnya 2.8.3 mempunyai tiga petala. Apakah ralatnya?',
          'Tiga petala menunjukkan Kala 3; kumpulan ditentukan oleh tiga elektron valens, iaitu Kumpulan 13 untuk aluminium.',
          'Murid itu menukar maksud kala dan kumpulan.'
        ),
      ],
    },
    {
      topic: 'Periodic Table',
      subtopic: 'Properties of alkali metals & halogens',
      title: 'Jadual Berkala: Logam Alkali dan Halogen',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Logam alkali ialah unsur Kumpulan 1 seperti litium, natrium dan kalium. Unsur ini lembut, berketumpatan rendah, sangat reaktif, dan membentuk ion +1. Halogen ialah unsur Kumpulan 17 seperti fluorin, klorin, bromin dan iodin. Halogen ialah bukan logam reaktif yang wujud sebagai molekul dwiatom dan cenderung membentuk ion -1.'
        ),
        section(
          'Contoh Kerja',
          'Natrium bertindak balas dengan air menghasilkan natrium hidroksida dan gas hidrogen. Pemerhatian biasa ialah natrium terapung, bergerak di permukaan air dan menghasilkan larutan beralkali. Dalam halogen, klorin boleh menyesarkan bromin daripada larutan bromida kerana klorin lebih reaktif daripada bromin.'
        ),
        section(
          'Kekeliruan Lazim',
          'Trend kereaktifan logam alkali dan halogen adalah berlawanan. Kereaktifan logam alkali meningkat apabila menuruni kumpulan kerana elektron valens semakin mudah hilang. Kereaktifan halogen menurun apabila menuruni kumpulan kerana atom semakin sukar menarik satu elektron tambahan.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Logam alkali | Unsur Kumpulan 1 yang membentuk alkali apabila bertindak balas dengan air. |
| Halogen | Unsur Kumpulan 17 yang membentuk garam dengan logam. |
| Molekul dwiatom | Molekul yang terdiri daripada dua atom unsur yang sama. |
| Penyesaran | Tindak balas apabila unsur lebih reaktif menggantikan unsur kurang reaktif. |`
        ),
        section(
          'Cara Ingat',
          'Ingat "alkali turun makin aktif, halogen turun makin pasif". Ini membantu membezakan dua trend kereaktifan utama.'
        ),
      ],
      questions: [
        mc(
          'Gas yang terhasil apabila natrium bertindak balas dengan air ialah',
          ['oksigen', 'hidrogen', 'klorin', 'nitrogen'],
          1,
          'Logam alkali bertindak balas dengan air menghasilkan hidroksida logam dan gas hidrogen.'
        ),
        mc(
          'Antara halogen berikut, yang manakah biasanya berwarna hijau kekuningan pada suhu bilik?',
          ['Fluorin', 'Klorin', 'Bromin', 'Iodin'],
          1,
          'Klorin ialah gas hijau kekuningan.'
        ),
        tf(
          'Kereaktifan halogen meningkat apabila menuruni Kumpulan 17.',
          false,
          'Kereaktifan halogen menurun apabila menuruni kumpulan.'
        ),
        representation(
          'Padankan kumpulan unsur dengan ciri utamanya.',
          [
            ['A', 'Logam alkali: membentuk ion +1 dan bertindak balas dengan air'],
            ['B', 'Halogen: molekul dwiatom bukan logam dan membentuk ion -1'],
          ],
          'Logam alkali mudah kehilangan satu elektron, manakala halogen cenderung menerima satu elektron.'
        ),
        stepOrder(
          'Susun pemerhatian biasa apabila kepingan kecil natrium dimasukkan ke dalam air.',
          [
            'Larutan menjadi beralkali',
            'Natrium terapung di permukaan air',
            'Gas hidrogen terbebas',
            'Natrium bergerak dan mengecil semasa bertindak balas',
          ],
          [
            'Natrium terapung di permukaan air',
            'Natrium bergerak dan mengecil semasa bertindak balas',
            'Gas hidrogen terbebas',
            'Larutan menjadi beralkali',
          ],
          'Natrium kurang tumpat daripada air dan tindak balasnya menghasilkan hidrogen serta natrium hidroksida.'
        ),
        errorDiagnosis(
          'Seorang murid berkata kalium kurang reaktif daripada litium kerana atom kalium lebih besar. Apakah ralatnya?',
          'Bagi logam alkali, saiz atom lebih besar menyebabkan elektron valens lebih jauh daripada nukleus dan lebih mudah hilang, jadi kalium lebih reaktif daripada litium.',
          'Murid itu menggunakan kesan saiz atom dengan arah trend yang salah.'
        ),
      ],
    },
    {
      topic: 'Chemical Bonds',
      subtopic: 'Ionic bonding',
      title: 'Ikatan Kimia: Ikatan Ion',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Ikatan ion terbentuk melalui pemindahan elektron daripada atom logam kepada atom bukan logam. Atom logam kehilangan elektron dan menjadi kation bercas positif, manakala atom bukan logam menerima elektron dan menjadi anion bercas negatif. Daya tarikan elektrostatik yang kuat antara ion bercas bertentangan membentuk kisi ion gergasi. Sebatian ionik biasanya mempunyai takat lebur tinggi dan mengkonduksi elektrik apabila lebur atau larut dalam air.'
        ),
        section(
          'Contoh Kerja',
          'Dalam pembentukan natrium klorida, atom natrium kehilangan satu elektron untuk membentuk Na+. Atom klorin menerima elektron itu untuk membentuk Cl-. Tarikan antara Na+ dan Cl- membentuk NaCl dalam nisbah 1:1.'
        ),
        section(
          'Kekeliruan Lazim',
          'Ikatan ion bukan perkongsian elektron; itu ialah ikatan kovalen. Pepejal ionik mempunyai ion bercas tetapi ionnya tidak bebas bergerak, jadi pepejal ionik tidak mengkonduksi elektrik. Apabila lebur atau dalam larutan akueus, ion bergerak bebas dan boleh membawa cas.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Kation | Ion bercas positif. |
| Anion | Ion bercas negatif. |
| Ikatan ion | Tarikan elektrostatik kuat antara ion bertentangan cas. |
| Kisi ion | Susunan teratur ion positif dan negatif dalam pepejal ionik. |`
        ),
        section(
          'Cara Ingat',
          'Ingat "logam lepas, bukan logam terima": logam melepaskan elektron menjadi kation, bukan logam menerima elektron menjadi anion.'
        ),
      ],
      questions: [
        mc(
          'Ikatan ion ialah',
          [
            'perkongsian pasangan elektron antara dua bukan logam',
            'tarikan elektrostatik antara ion bercas bertentangan',
            'tarikan antara molekul neutral sahaja',
            'pemecahan nukleus atom',
          ],
          1,
          'Ikatan ion terbentuk daripada tarikan antara kation dan anion.'
        ),
        mc(
          'Antara bahan berikut, yang manakah sebatian ionik?',
          ['CO2', 'CH4', 'MgO', 'Cl2'],
          2,
          'Magnesium oksida terbentuk daripada Mg2+ dan O2-.'
        ),
        tf(
          'Pepejal natrium klorida mengkonduksi elektrik kerana ionnya bercas.',
          false,
          'Dalam pepejal, ion tidak bebas bergerak. NaCl mengkonduksi apabila lebur atau larut dalam air.'
        ),
        numeric(
          'Dalam pembentukan MgO daripada Mg dan O, berapa elektron dipindahkan daripada satu atom Mg kepada satu atom O?',
          2,
          0,
          'electron',
          'Magnesium kehilangan 2 elektron untuk menjadi Mg2+, dan oksigen menerima 2 elektron untuk menjadi O2-.'
        ),
        stepOrder(
          'Susun langkah pembentukan ikatan ion dalam MgO.',
          [
            'Mg2+ dan O2- tertarik secara elektrostatik',
            'Oksigen menerima dua elektron menjadi O2-',
            'Magnesium kehilangan dua elektron menjadi Mg2+',
            'Kisi ion MgO terbentuk',
          ],
          [
            'Magnesium kehilangan dua elektron menjadi Mg2+',
            'Oksigen menerima dua elektron menjadi O2-',
            'Mg2+ dan O2- tertarik secara elektrostatik',
            'Kisi ion MgO terbentuk',
          ],
          'Pemindahan elektron menghasilkan ion dahulu, kemudian tarikan ion membentuk ikatan.'
        ),
        errorDiagnosis(
          'Seorang murid menerangkan NaCl sebagai natrium dan klorin berkongsi satu pasangan elektron. Apakah ralatnya?',
          'NaCl terbentuk melalui pemindahan elektron daripada natrium kepada klorin, bukan perkongsian elektron.',
          'Perkongsian elektron ialah ciri ikatan kovalen.'
        ),
      ],
    },
    {
      topic: 'Chemical Bonds',
      subtopic: 'Covalent bonding',
      title: 'Ikatan Kimia: Ikatan Kovalen',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Ikatan kovalen terbentuk apabila atom bukan logam berkongsi pasangan elektron untuk mencapai susunan elektron yang stabil. Satu pasangan elektron yang dikongsi membentuk ikatan tunggal, dua pasangan membentuk ikatan ganda dua, dan tiga pasangan membentuk ikatan ganda tiga. Banyak sebatian kovalen ringkas wujud sebagai molekul kecil dengan daya antara molekul yang lemah, maka takat lebur dan takat didihnya biasanya rendah.'
        ),
        section(
          'Contoh Kerja',
          'Dalam molekul air, atom oksigen mempunyai enam elektron valens dan memerlukan dua lagi untuk mencapai oktet. Dua atom hidrogen masing-masing berkongsi satu elektron dengan oksigen. Hasilnya ialah dua ikatan kovalen tunggal O-H dalam H2O.'
        ),
        section(
          'Kekeliruan Lazim',
          'Ikatan kovalen tidak menghasilkan ion dalam molekul ringkas seperti CH4 atau CO2. Oleh itu kebanyakan sebatian kovalen ringkas tidak mengkonduksi elektrik kerana tiada ion atau elektron bebas. Namun grafit ialah pengecualian kerana mempunyai elektron ternyahsetempat.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Ikatan kovalen | Ikatan melalui perkongsian pasangan elektron. |
| Molekul | Zarah neutral yang terdiri daripada atom terikat kovalen. |
| Oktet | Susunan lapan elektron valens yang stabil. |
| Ikatan ganda dua | Ikatan yang berkongsi dua pasangan elektron. |`
        ),
        section(
          'Cara Ingat',
          'Ingat "kovalen kongsi": kedua-duanya bermula dengan bunyi yang sama, membantu mengaitkan kovalen dengan perkongsian elektron.'
        ),
      ],
      questions: [
        mc(
          'Ikatan kovalen terbentuk melalui',
          ['pemindahan proton', 'pemindahan neutron', 'perkongsian pasangan elektron', 'tarikan antara ion logam sahaja'],
          2,
          'Ikatan kovalen ialah perkongsian pasangan elektron antara atom bukan logam.'
        ),
        mc(
          'Molekul manakah mempunyai ikatan ganda dua antara karbon dan oksigen?',
          ['CO2', 'CH4', 'NH3', 'HCl'],
          0,
          'CO2 mempunyai struktur O=C=O dengan dua ikatan ganda dua.'
        ),
        tf(
          'Kebanyakan sebatian kovalen ringkas mempunyai takat lebur lebih rendah berbanding sebatian ionik.',
          true,
          'Molekul kovalen ringkas mempunyai daya antara molekul yang lemah.'
        ),
        numeric(
          'Dalam molekul N2, berapa pasangan elektron dikongsi antara dua atom nitrogen?',
          3,
          0,
          'pair',
          'N2 mempunyai ikatan ganda tiga, iaitu tiga pasangan elektron dikongsi.'
        ),
        representation(
          'Padankan jenis ikatan kovalen dengan perwakilan pasangan elektron.',
          [
            ['A', 'Ikatan tunggal: satu pasangan elektron dikongsi'],
            ['B', 'Ikatan ganda dua: dua pasangan elektron dikongsi'],
          ],
          'Bilangan pasangan elektron yang dikongsi menentukan jenis ikatan kovalen.'
        ),
        stepOrder(
          'Susun langkah menerangkan pembentukan ikatan dalam H2O.',
          [
            'Setiap H berkongsi satu elektron dengan O',
            'Oksigen mempunyai enam elektron valens',
            'Terbentuk dua ikatan kovalen tunggal O-H',
            'Oksigen memerlukan dua elektron lagi untuk oktet',
          ],
          [
            'Oksigen mempunyai enam elektron valens',
            'Oksigen memerlukan dua elektron lagi untuk oktet',
            'Setiap H berkongsi satu elektron dengan O',
            'Terbentuk dua ikatan kovalen tunggal O-H',
          ],
          'Kekurangan dua elektron pada oksigen dipenuhi melalui dua perkongsian dengan hidrogen.'
        ),
        errorDiagnosis(
          'Seorang murid melukis CO2 sebagai O-C-O dengan dua ikatan tunggal sahaja. Apakah ralatnya?',
          'Karbon belum mencapai oktet dalam lukisan itu; CO2 perlu dilukis sebagai O=C=O dengan dua ikatan ganda dua.',
          'Dua ikatan ganda dua membolehkan karbon dan oksigen mencapai susunan elektron stabil.'
        ),
      ],
    },
    {
      topic: 'Electrochemistry',
      subtopic: 'Electrolysis concept',
      title: 'Elektrokimia: Konsep Elektrolisis',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Elektrolisis ialah penguraian sebatian ionik dalam keadaan lebur atau larutan akueus menggunakan arus elektrik. Elektrolit mengandungi ion bergerak bebas yang membawa cas. Dalam sel elektrolisis, kation bergerak ke katod dan mengalami penurunan, manakala anion bergerak ke anod dan mengalami pengoksidaan. Katod disambung kepada terminal negatif dan anod kepada terminal positif bagi bekalan kuasa.'
        ),
        section(
          'Contoh Kerja',
          'Apabila plumbum(II) bromida lebur dielektrolisis, ion Pb2+ bergerak ke katod dan menerima elektron untuk membentuk plumbum. Ion Br- bergerak ke anod dan kehilangan elektron untuk membentuk gas bromin, Br2. Pepejal plumbum(II) bromida tidak boleh dielektrolisis kerana ionnya tidak bebas bergerak.'
        ),
        section(
          'Kekeliruan Lazim',
          'Elektrod positif dalam elektrolisis ialah anod, bukan katod. Jangan kelirukan pergerakan ion dengan pergerakan elektron dalam litar luar. Ion bergerak dalam elektrolit, manakala elektron bergerak melalui wayar dan elektrod.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Elektrolisis | Penguraian bahan oleh arus elektrik. |
| Elektrolit | Leburan atau larutan yang mengandungi ion bergerak. |
| Katod | Elektrod negatif tempat kation menerima elektron. |
| Anod | Elektrod positif tempat anion kehilangan elektron. |`
        ),
        section(
          'Cara Ingat',
          'Gunakan "Katod tarik kation" dan "Anod tarik anion". Tambah "Reduksi di katod" untuk mengingat proses elektron.'
        ),
      ],
      questions: [
        mc(
          'Syarat utama elektrolit ialah',
          ['mempunyai molekul neutral sahaja', 'mengandungi ion yang bebas bergerak', 'sentiasa pepejal', 'tidak mengalirkan arus'],
          1,
          'Ion bergerak bebas diperlukan untuk membawa cas dalam elektrolit.'
        ),
        mc(
          'Dalam elektrolisis, katod disambung kepada',
          ['terminal negatif', 'terminal positif', 'kedua-dua terminal', 'tiada terminal'],
          0,
          'Katod ialah elektrod negatif dalam sel elektrolisis.'
        ),
        tf(
          'Kation bergerak ke katod dan mengalami penurunan.',
          true,
          'Kation menerima elektron di katod, maka proses itu ialah penurunan.'
        ),
        numeric(
          'Arus 2.0 A mengalir selama 300 s dalam satu elektrolisis. Berapakah cas elektrik yang mengalir?',
          600,
          0.1,
          'C',
          'Cas Q = It = 2.0 A x 300 s = 600 C.'
        ),
        stepOrder(
          'Susun proses elektrolisis plumbum(II) bromida lebur.',
          [
            'Br- kehilangan elektron di anod membentuk Br2',
            'Pb2+ menerima elektron di katod membentuk Pb',
            'Leburkan PbBr2 supaya ion bebas bergerak',
            'Pb2+ bergerak ke katod dan Br- bergerak ke anod',
          ],
          [
            'Leburkan PbBr2 supaya ion bebas bergerak',
            'Pb2+ bergerak ke katod dan Br- bergerak ke anod',
            'Pb2+ menerima elektron di katod membentuk Pb',
            'Br- kehilangan elektron di anod membentuk Br2',
          ],
          'Ion mesti bebas bergerak dahulu sebelum dinyahcas pada elektrod.'
        ),
        errorDiagnosis(
          'Seorang murid cuba mengelektrolisis pepejal natrium klorida dan menjangka mentol menyala. Apakah ralatnya?',
          'Pepejal NaCl mempunyai ion yang terkunci dalam kisi dan tidak bebas bergerak; NaCl mesti dileburkan atau dilarutkan untuk menjadi elektrolit.',
          'Kekonduksian elektrolit memerlukan ion bergerak bebas.'
        ),
      ],
    },
    {
      topic: 'Electrochemistry',
      subtopic: 'Electrolysis of solutions',
      title: 'Elektrokimia: Elektrolisis Larutan Akueus',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Dalam larutan akueus, air turut membekalkan ion H+ dan OH- selain ion daripada zat terlarut. Hasil di katod bergantung pada kedudukan ion positif dalam siri elektrokimia: ion logam yang kurang elektropositif daripada hidrogen lebih mudah dinyahcas, manakala H+ dinyahcas jika ion logam terlalu elektropositif. Di anod, ion halida pekat seperti Cl-, Br- dan I- boleh dinyahcas; jika tidak, OH- biasanya membentuk oksigen. Jenis elektrod juga boleh mempengaruhi hasil jika elektrod aktif digunakan.'
        ),
        section(
          'Contoh Kerja',
          'Dalam larutan kuprum(II) sulfat dengan elektrod karbon, Cu2+ lebih mudah dinyahcas daripada H+ di katod, lalu mendap sebagai kuprum perang kemerahan. Di anod, ion OH- lebih mudah membentuk oksigen jika tiada ion halida pekat. Larutan biru menjadi semakin pudar kerana ion Cu2+ berkurang.'
        ),
        section(
          'Kekeliruan Lazim',
          'Jangan anggap semua kation logam akan menjadi logam di katod dalam larutan akueus. Kalium, natrium dan kalsium terlalu elektropositif, jadi H+ biasanya dinyahcas menjadi hidrogen. Kepekatan halida juga penting di anod; larutan klorida pekat menghasilkan klorin, manakala larutan sangat cair lebih cenderung menghasilkan oksigen.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Larutan akueus | Larutan yang menggunakan air sebagai pelarut. |
| Dinyahcas | Ion menerima atau kehilangan elektron di elektrod. |
| Siri elektrokimia | Susunan kecenderungan unsur membentuk ion. |
| Elektrod lengai | Elektrod yang tidak mengambil bahagian dalam tindak balas. |`
        ),
        section(
          'Cara Ingat',
          'Untuk larutan akueus, tanya tiga soalan: ion apa hadir, ion mana lebih mudah dinyahcas, dan adakah larutan halida pekat atau elektrod aktif digunakan?'
        ),
      ],
      questions: [
        mc(
          'Dalam elektrolisis larutan kuprum(II) sulfat menggunakan elektrod karbon, hasil di katod ialah',
          ['gas hidrogen', 'gas oksigen', 'kuprum', 'sulfur'],
          2,
          'Cu2+ lebih mudah dinyahcas daripada H+ lalu membentuk kuprum di katod.'
        ),
        mc(
          'Dalam elektrolisis larutan natrium klorida pekat, hasil utama di anod ialah',
          ['hidrogen', 'oksigen', 'klorin', 'natrium'],
          2,
          'Ion klorida pekat dinyahcas di anod menghasilkan gas klorin.'
        ),
        tf(
          'Dalam larutan natrium klorida sangat cair, oksigen lebih mudah terbentuk di anod berbanding klorin.',
          true,
          'Apabila klorida tidak pekat, OH- lebih cenderung dinyahcas di anod menghasilkan oksigen.'
        ),
        numeric(
          'Dalam elektrolisis air berasid, nisbah isipadu H2:O2 ialah 2:1. Jika 12 cm3 oksigen terbentuk, berapakah isipadu hidrogen?',
          24,
          0.1,
          'cm3',
          'Hidrogen terbentuk dua kali isipadu oksigen, maka 2 x 12 cm3 = 24 cm3.'
        ),
        stepOrder(
          'Susun langkah meramal hasil elektrolisis larutan kuprum(II) klorida pekat dengan elektrod karbon.',
          [
            'Bandingkan Cu2+ dengan H+ di katod',
            'Kenal pasti ion Cu2+, Cl-, H+ dan OH- hadir',
            'Nyatakan Cu terbentuk di katod dan Cl2 di anod',
            'Pertimbangkan Cl- pekat berbanding OH- di anod',
          ],
          [
            'Kenal pasti ion Cu2+, Cl-, H+ dan OH- hadir',
            'Bandingkan Cu2+ dengan H+ di katod',
            'Pertimbangkan Cl- pekat berbanding OH- di anod',
            'Nyatakan Cu terbentuk di katod dan Cl2 di anod',
          ],
          'Ramalan hasil dibuat dengan mengenal pasti ion hadir dan memilih ion yang lebih mudah dinyahcas.'
        ),
        errorDiagnosis(
          'Seorang murid meramal kalium terbentuk di katod semasa elektrolisis larutan KCl. Apakah ralatnya?',
          'Dalam larutan akueus, K+ terlalu elektropositif untuk dinyahcas; H+ daripada air lebih mudah menerima elektron dan membentuk gas hidrogen.',
          'Peraturan leburan tidak boleh digunakan terus kepada larutan akueus.'
        ),
      ],
    },
    {
      topic: 'Acids, Bases & Salts',
      subtopic: 'Properties & pH',
      title: 'Asid, Bes dan Garam: Sifat dan pH',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep',
          'Asid menghasilkan ion hidrogen, H+, apabila larut dalam air. Alkali ialah bes yang larut dalam air dan menghasilkan ion hidroksida, OH-. Skala pH menunjukkan keasidan atau kealkalian larutan: pH kurang daripada 7 ialah asid, pH 7 neutral, dan pH lebih daripada 7 ialah alkali. Peneutralan antara asid dan alkali menghasilkan garam dan air.'
        ),
        section(
          'Contoh Kerja',
          'Asid hidroklorik bertindak balas dengan natrium hidroksida menghasilkan natrium klorida dan air: HCl + NaOH -> NaCl + H2O. Jika penunjuk universal menunjukkan pH 2, larutan itu berasid kuat dari segi pH. Jika pH 13, larutan itu sangat beralkali.'
        ),
        section(
          'Kekeliruan Lazim',
          'Asid kuat tidak semestinya sama dengan asid pekat. Kekuatan asid merujuk kepada darjah pengionan dalam air, manakala kepekatan merujuk kepada jumlah zat terlarut per isipadu larutan. Semua alkali ialah bes, tetapi tidak semua bes ialah alkali kerana ada bes yang tidak larut dalam air.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Asid | Bahan yang menghasilkan H+ dalam air. |
| Alkali | Bes larut air yang menghasilkan OH-. |
| pH | Ukuran keasidan atau kealkalian larutan. |
| Peneutralan | Tindak balas asid dengan bes menghasilkan garam dan air. |`
        ),
        section(
          'Cara Ingat',
          'Ingat "asid bawah 7, alkali atas 7". Untuk litmus: asid memerahkan biru, alkali membirukan merah.'
        ),
      ],
      questions: [
        mc(
          'Asid menghasilkan ion manakah apabila larut dalam air?',
          ['H+', 'OH-', 'Na+', 'Cl-'],
          0,
          'Asid membebaskan ion hidrogen, H+, dalam larutan akueus.'
        ),
        mc(
          'Larutan yang mempunyai pH 12 ialah',
          ['sangat berasid', 'neutral', 'beralkali', 'tidak mengandungi ion'],
          2,
          'pH lebih daripada 7 menunjukkan larutan beralkali.'
        ),
        tf(
          'Semua alkali ialah bes, tetapi tidak semua bes ialah alkali.',
          true,
          'Alkali ialah bes yang larut dalam air; sesetengah bes tidak larut.'
        ),
        representation(
          'Padankan larutan dengan perubahan kertas litmus.',
          [
            ['A', 'Asid: menukarkan litmus biru kepada merah'],
            ['B', 'Alkali: menukarkan litmus merah kepada biru'],
          ],
          'Litmus ialah penunjuk mudah untuk membezakan asid dan alkali.'
        ),
        stepOrder(
          'Susun langkah menguji pH larutan tidak diketahui dengan penunjuk universal.',
          [
            'Bandingkan warna dengan carta pH',
            'Titis penunjuk universal ke dalam sampel kecil',
            'Rekod nilai pH dan sifat asid, neutral atau alkali',
            'Letakkan sedikit larutan dalam tabung uji bersih',
          ],
          [
            'Letakkan sedikit larutan dalam tabung uji bersih',
            'Titis penunjuk universal ke dalam sampel kecil',
            'Bandingkan warna dengan carta pH',
            'Rekod nilai pH dan sifat asid, neutral atau alkali',
          ],
          'Sampel kecil dan carta warna digunakan untuk menganggar pH dengan selamat.'
        ),
        errorDiagnosis(
          'Seorang murid berkata asid kuat bermaksud asid itu semestinya sangat pekat. Apakah ralatnya?',
          'Kekuatan asid merujuk kepada darjah pengionan, manakala kepekatan merujuk kepada jumlah mol asid per isipadu larutan.',
          'Asid kuat boleh dicairkan, dan asid lemah boleh disediakan dalam larutan yang pekat.'
        ),
      ],
    },
    {
      topic: 'Acids, Bases & Salts',
      subtopic: 'Salt preparation methods',
      title: 'Asid, Bes dan Garam: Kaedah Penyediaan Garam',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Kaedah penyediaan garam bergantung pada keterlarutan garam dan reaktan yang digunakan. Garam larut boleh disediakan dengan tindak balas asid dengan logam, karbonat atau bes tidak larut yang berlebihan, kemudian dituras dan dihablurkan. Jika kedua-dua reaktan larut seperti asid dan alkali, pentitratan digunakan untuk mendapatkan nisbah tepat. Garam tidak larut pula biasanya disediakan melalui pemendakan dengan mencampurkan dua larutan garam yang sesuai.'
        ),
        section(
          'Contoh Kerja',
          'Untuk menyediakan kuprum(II) sulfat, panaskan asid sulfurik cair dengan lembut dan tambahkan kuprum(II) oksida berlebihan sehingga tiada lagi pepejal bertindak balas. Turaskan lebihan kuprum(II) oksida, kemudian panaskan turasan sehingga hampir tepu. Biarkan larutan menyejuk supaya hablur kuprum(II) sulfat terbentuk, kemudian keringkan hablur dengan kertas turas.'
        ),
        section(
          'Kekeliruan Lazim',
          'Jangan menyejat larutan garam hingga kering jika mahu hablur yang baik; pemanasan berlebihan boleh menyebabkan percikan, penguraian atau hablur tidak tulen. Untuk garam natrium, kalium dan ammonium daripada asid dan alkali, reaktan berlebihan tidak sesuai kerana kedua-duanya larut. Gunakan pentitratan untuk menentukan isipadu tepat.'
        ),
        section(
          'Istilah Penting',
          `| Istilah | Maksud |
|---|---|
| Garam | Sebatian ionik yang terbentuk apabila ion H+ asid diganti oleh ion logam atau ammonium. |
| Penghabluran | Proses mendapatkan hablur daripada larutan tepu panas. |
| Pemendakan | Pembentukan pepejal tidak larut apabila dua larutan bercampur. |
| Pentitratan | Kaedah menentukan isipadu tepat asid dan alkali untuk peneutralan. |`
        ),
        section(
          'Cara Ingat',
          'Pilih kaedah dengan soalan "larut atau tidak?" Jika garam tidak larut, gunakan pemendakan. Jika garam larut dan satu reaktan tidak larut, gunakan reaktan berlebihan. Jika semua reaktan larut, gunakan pentitratan.'
        ),
      ],
      questions: [
        mc(
          'Kaedah paling sesuai untuk menyediakan garam tidak larut seperti barium sulfat ialah',
          ['penghabluran terus air suling', 'pemendakan', 'penyulingan pecahan', 'pembakaran logam'],
          1,
          'Garam tidak larut disediakan dengan mencampurkan dua larutan yang menghasilkan mendakan garam tersebut.'
        ),
        mc(
          'Reaktan sesuai untuk menyediakan kuprum(II) sulfat larut ialah',
          ['asid sulfurik cair dan kuprum(II) oksida berlebihan', 'asid hidroklorik dan natrium hidroksida berlebihan tanpa titratan', 'air dan pasir', 'natrium klorida dan gula'],
          0,
          'Kuprum(II) oksida tidak larut boleh ditambah berlebihan kepada asid sulfurik, kemudian lebihan dituras.'
        ),
        tf(
          'Natrium klorida daripada asid hidroklorik dan natrium hidroksida biasanya disediakan melalui pentitratan.',
          true,
          'Kedua-dua reaktan larut, maka pentitratan diperlukan untuk mendapatkan isipadu tepat tanpa lebihan reaktan.'
        ),
        numeric(
          'Hitung mol NaOH dalam 25.0 cm3 larutan 0.100 mol dm-3 NaOH.',
          0.0025,
          0.00001,
          'mol',
          '25.0 cm3 = 0.0250 dm3. Mol = kepekatan x isipadu = 0.100 x 0.0250 = 0.00250 mol.'
        ),
        stepOrder(
          'Susun langkah menyediakan hablur kuprum(II) sulfat daripada kuprum(II) oksida dan asid sulfurik.',
          [
            'Sejukkan larutan tepu panas untuk membentuk hablur',
            'Tambahkan kuprum(II) oksida berlebihan ke dalam asid sulfurik suam',
            'Turaskan lebihan kuprum(II) oksida',
            'Keringkan hablur dengan kertas turas',
            'Panaskan turasan sehingga hampir tepu',
          ],
          [
            'Tambahkan kuprum(II) oksida berlebihan ke dalam asid sulfurik suam',
            'Turaskan lebihan kuprum(II) oksida',
            'Panaskan turasan sehingga hampir tepu',
            'Sejukkan larutan tepu panas untuk membentuk hablur',
            'Keringkan hablur dengan kertas turas',
          ],
          'Garam larut diperoleh melalui tindak balas, penurasan, pemekatan, penghabluran dan pengeringan.'
        ),
        errorDiagnosis(
          'Seorang murid menyejat larutan kuprum(II) sulfat hingga kering untuk mendapatkan garam dengan cepat. Apakah ralatnya?',
          'Larutan sepatutnya dipanaskan hingga hampir tepu dan disejukkan untuk penghabluran; menyejat hingga kering boleh menghasilkan pepejal tidak tulen atau terurai.',
          'Penghabluran terkawal menghasilkan hablur yang lebih tulen.'
        ),
      ],
    },
  ];

  for (const [lessonIndex, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      lessonIndex + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.questionText,
        question.options,
        question.correctAnswer,
        question.explanation,
        question.points,
        questionIndex + 1
      );
    }
  }
}

async function seedForm4Physics(client) {
  const subject = 'Physics';
  const formLevel = 4;
  const blocks = (concept, workedExample, misconceptions, keyTerms, memoryAid) => [
    section('Concept', concept),
    section('Worked example', workedExample),
    section('Common misconceptions', misconceptions),
    section('Key terms', keyTerms),
    section('Memory aid', memoryAid),
  ];

  const lessons = [
    {
      topic: 'Measurement',
      subtopic: 'SI units & scientific notation',
      difficulty: 'easy',
      blocks: blocks(
        'Physics begins by measuring physical quantities with agreed units. The International System of Units, or SI, gives standard base units such as metre for length, kilogram for mass, second for time and ampere for electric current. Derived quantities, such as speed and force, are built from base units. Scientific notation writes very large or very small numbers as a value from 1 to less than 10 multiplied by a power of ten. Converting to SI units before using a formula prevents unit errors.',
        'A length of 0.0032 m can be written as 3.2 x 10^-3 m, while a force of 1500 N can be written as 1.5 x 10^3 N. If a car moves 120 m in 8 s, its speed is 120 / 8 = 15 m/s. The metre and second are already SI units, so the answer is directly in m/s. If the distance were given as 120 cm, it must first be converted to 1.20 m.',
        'Mass and weight are often mixed up: mass is measured in kg, while weight is a force measured in N. Unit symbols are not plural, so 5 kg is correct, not 5 kgs. A common calculation error is substituting centimetres, grams or minutes into a formula that expects metres, kilograms or seconds. Scientific notation does not change the value; it only changes the way the value is written.',
        '| Term | Meaning |\n|---|---|\n| Physical quantity (Kuantiti fizik) | A measurable property such as length, time, mass or current. |\n| SI unit (Unit SI) | An internationally agreed standard unit used for measurement. |\n| Base quantity (Kuantiti asas) | A quantity not derived from other quantities, such as length or time. |\n| Derived quantity (Kuantiti terbitan) | A quantity formed from base quantities, such as speed or force. |\n| Scientific notation (Notasi piawai) | Writing a number as A x 10^n where 1 <= A < 10. |',
        'Use "Same International units first": identify the quantity, convert to SI, then substitute into the formula. For powers of ten, positive powers make numbers larger and negative powers make numbers smaller.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which pair correctly matches a physical quantity with its SI unit?',
          options: ['Force - newton', 'Mass - newton', 'Time - metre', 'Current - volt'],
          correct: { optionIndex: 0 },
          explanation: 'Force is measured in newtons, while mass is measured in kilograms, time in seconds and current in amperes.',
        },
        {
          type: 'multiple_choice',
          question: 'Which value is equal to 4.7 x 10^-3 m?',
          options: ['4700 m', '0.47 m', '0.047 m', '0.0047 m'],
          correct: { optionIndex: 3 },
          explanation: '10^-3 means divide by 1000, so 4.7 x 10^-3 = 0.0047.',
        },
        {
          type: 'true_false',
          question: 'The kilogram is the SI unit for weight.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Kilogram is the SI unit for mass. Weight is a force and is measured in newtons.',
        },
        {
          type: 'numeric',
          question: 'Convert 2.5 km to metres.',
          options: [],
          correct: { value: 2500, tolerance: 0, unit: 'm' },
          explanation: '1 km = 1000 m, so 2.5 km = 2.5 x 1000 = 2500 m.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for solving a measurement calculation correctly.',
          options: ['Substitute values and calculate', 'Identify the formula and required quantity', 'Write the answer with unit', 'Convert all measurements to SI units'],
          correct: ['Identify the formula and required quantity', 'Convert all measurements to SI units', 'Substitute values and calculate', 'Write the answer with unit'],
          explanation: 'Choosing the formula and converting units must happen before substitution.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student calculates speed using 20 cm in 4 s and writes 20 / 4 = 5 m/s. Identify the error.',
          options: [],
          correct: 'The distance was not converted from centimetres to metres before calculating the SI speed.',
          explanation: '20 cm is 0.20 m, so the speed is 0.20 / 4 = 0.05 m/s.',
        },
      ],
    },
    {
      topic: 'Measurement',
      subtopic: 'Vernier caliper & micrometer',
      difficulty: 'medium',
      blocks: blocks(
        'A vernier caliper measures internal diameter, external diameter and depth more precisely than a metre rule. A micrometer screw gauge measures small thicknesses or diameters with even finer precision. Both instruments combine a main scale reading with a smaller scale reading. The actual reading must include any zero error correction. Good measurement also requires the eye to be perpendicular to the scale to avoid parallax error.',
        'Suppose a vernier caliper has a main scale reading of 2.30 cm and the 6th vernier division lines up. If the least count is 0.01 cm, the vernier reading is 6 x 0.01 = 0.06 cm. The observed reading is 2.30 + 0.06 = 2.36 cm. If there is a positive zero error of 0.02 cm, the corrected reading is 2.36 - 0.02 = 2.34 cm.',
        'Students sometimes read the main scale after the vernier zero instead of before it. Another common mistake is adding a positive zero error when it should be subtracted. The micrometer thimble reading must be multiplied by the least count, usually 0.01 mm, before it is added to the sleeve scale. Repeating readings and taking an average reduces random error, but it does not remove a zero error unless the correction is applied.',
        '| Term | Meaning |\n|---|---|\n| Vernier caliper (Angkup vernier) | Instrument for measuring external diameter, internal diameter and depth. |\n| Micrometer screw gauge (Tolok skru mikrometer) | Instrument for measuring very small diameters or thicknesses. |\n| Least count (Bacaan terkecil) | The smallest scale division that an instrument can measure. |\n| Zero error (Ralat sifar) | Error when the instrument does not read zero while fully closed. |\n| Parallax error (Ralat paralaks) | Error caused by viewing the scale from an angle. |',
        'Remember "Main plus small, then zero correct": main scale + vernier or thimble scale gives the observed reading, and the zero correction gives the final reading.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which measurement is best suited to a micrometer screw gauge?',
          options: ['The thickness of a thin wire', 'The length of a classroom', 'The mass of a book', 'The time for a runner to finish 100 m'],
          correct: { optionIndex: 0 },
          explanation: 'A micrometer is used for very small diameters and thicknesses.',
        },
        {
          type: 'multiple_choice',
          question: 'What is the usual least count of a school micrometer screw gauge?',
          options: ['1 mm', '0.1 mm', '0.01 mm', '1 cm'],
          correct: { optionIndex: 2 },
          explanation: 'A typical micrometer screw gauge reads to 0.01 mm.',
        },
        {
          type: 'true_false',
          question: 'A positive zero error is subtracted from the observed reading to obtain the corrected reading.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Corrected reading = observed reading - zero error. For a positive zero error, this means subtracting it.',
        },
        {
          type: 'numeric',
          question: 'A vernier caliper reads 2.30 cm on the main scale. The 6th vernier division coincides and the least count is 0.01 cm. What is the observed reading?',
          options: [],
          correct: { value: 2.36, tolerance: 0.001, unit: 'cm' },
          explanation: 'Observed reading = 2.30 + (6 x 0.01) = 2.36 cm.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for reading a vernier caliper.',
          options: ['Apply zero error correction', 'Read the main scale just before the vernier zero', 'Find the coinciding vernier division', 'Add main scale and vernier scale readings'],
          correct: ['Read the main scale just before the vernier zero', 'Find the coinciding vernier division', 'Add main scale and vernier scale readings', 'Apply zero error correction'],
          explanation: 'The observed reading is obtained before the zero error correction is applied.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student reads a vernier caliper from above and records 3.42 cm without checking zero error. Identify the measurement issue.',
          options: [],
          correct: 'The reading may contain parallax error and zero error because the eye was not perpendicular to the scale and zero error was not checked.',
          explanation: 'Accurate measurement requires correct eye position and zero correction.',
        },
      ],
    },
    {
      topic: 'Forces & Motion',
      subtopic: 'Distance, displacement, speed, velocity',
      difficulty: 'easy',
      blocks: blocks(
        'Distance is the total length of the path travelled, while displacement is the shortest straight-line change in position from start to finish. Distance is a scalar quantity because it has magnitude only. Displacement is a vector quantity because it has magnitude and direction. Speed is the rate of change of distance, whereas velocity is the rate of change of displacement. Direction matters whenever velocity or displacement is used.',
        'If a student walks 3 m east and then 4 m west, the distance travelled is 7 m. The displacement is 1 m west because the final position is 1 m west of the starting point. If the whole walk takes 7 s, the average speed is 7 / 7 = 1 m/s. The average velocity is 1 m west / 7 s = 0.14 m/s west.',
        'A very common mistake is treating distance and displacement as the same quantity. Another is writing velocity without direction. Average speed cannot be found using displacement unless the path is a straight line with no change of direction. A negative velocity normally shows direction relative to the chosen positive direction; it does not mean the object is moving slowly.',
        '| Term | Meaning |\n|---|---|\n| Distance (Jarak) | Total path length travelled by an object. |\n| Displacement (Sesaran) | Straight-line change in position with direction. |\n| Speed (Laju) | Rate of change of distance. |\n| Velocity (Halaju) | Rate of change of displacement with direction. |\n| Scalar and vector (Skalar dan vektor) | Scalar has magnitude only; vector has magnitude and direction. |',
        'Use "D path, S arrow": distance follows the path, displacement is the arrow from start to finish. Speed belongs with distance, and velocity belongs with displacement.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which quantity is a vector?',
          options: ['Distance', 'Speed', 'Displacement', 'Time'],
          correct: { optionIndex: 2 },
          explanation: 'Displacement has both magnitude and direction, so it is a vector.',
        },
        {
          type: 'multiple_choice',
          question: 'Which statement correctly describes velocity?',
          options: ['Distance travelled per unit time', 'Displacement per unit time', 'Mass per unit volume', 'Force per unit area'],
          correct: { optionIndex: 1 },
          explanation: 'Velocity is the rate of change of displacement.',
        },
        {
          type: 'true_false',
          question: 'Average speed is always calculated using displacement divided by time.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Average speed uses total distance divided by time.',
        },
        {
          type: 'numeric',
          question: 'A cyclist travels 120 m in 8 s. What is the average speed?',
          options: [],
          correct: { value: 15, tolerance: 0, unit: 'm/s' },
          explanation: 'Average speed = distance / time = 120 / 8 = 15 m/s.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for finding average velocity from a described journey.',
          options: ['Divide displacement by total time', 'Choose a positive direction', 'Find final position relative to start', 'Write direction with the answer'],
          correct: ['Choose a positive direction', 'Find final position relative to start', 'Divide displacement by total time', 'Write direction with the answer'],
          explanation: 'Velocity requires displacement and direction, so the direction convention must be chosen first.',
        },
        {
          type: 'error_diagnosis',
          question: 'A runner completes one full 400 m lap in 80 s. A student says the average velocity is 5 m/s because 400 / 80 = 5. Identify the error.',
          options: [],
          correct: 'The student used distance instead of displacement; after one full lap the displacement is zero, so average velocity is zero.',
          explanation: 'A complete lap ends at the starting point, giving zero displacement.',
        },
      ],
    },
    {
      topic: 'Forces & Motion',
      subtopic: 'Acceleration & equations of motion',
      difficulty: 'medium',
      blocks: blocks(
        'Acceleration is the rate of change of velocity. For motion in a straight line with constant acceleration, four equations are commonly used: v = u + at, s = ut + 1/2 at^2, v^2 = u^2 + 2as, and s = (u + v)t/2. In these equations, u is initial velocity, v is final velocity, a is acceleration, s is displacement and t is time. These equations are valid only when acceleration is constant. The sign of each value must follow the chosen direction.',
        'A trolley starts from rest and accelerates at 2.0 m/s^2 for 5.0 s. Its final velocity is v = u + at = 0 + 2.0(5.0) = 10 m/s. Its displacement is s = ut + 1/2 at^2 = 0 + 1/2(2.0)(5.0)^2 = 25 m. Both results describe the same interval of motion.',
        'Students often choose an equation that does not contain the required unknown or includes an unavailable value. Another error is forgetting that "from rest" means u = 0. Deceleration is acceleration opposite to the direction of motion, so it should usually be entered with a negative sign. The equations of motion do not apply directly to motion with changing acceleration.',
        '| Term | Meaning |\n|---|---|\n| Acceleration (Pecutan) | Rate of change of velocity. |\n| Initial velocity (Halaju awal) | Velocity at the start of the time interval. |\n| Final velocity (Halaju akhir) | Velocity at the end of the time interval. |\n| Displacement (Sesaran) | Change in position in a specified direction. |\n| Uniform acceleration (Pecutan seragam) | Constant acceleration during the motion. |',
        'Use "SUVAT": list s, u, v, a and t first. Pick the equation that contains the unknown and avoids the missing value.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which equation is most direct for finding final velocity when initial velocity, acceleration and time are known?',
          options: ['v = u + at', 's = ut + 1/2 at^2', 'v^2 = u^2 + 2as', 'P = F/A'],
          correct: { optionIndex: 0 },
          explanation: 'v = u + at contains final velocity, initial velocity, acceleration and time.',
        },
        {
          type: 'true_false',
          question: 'The standard equations of motion are used only when acceleration is constant.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'The SUVAT equations assume uniform acceleration.',
        },
        {
          type: 'numeric',
          question: 'A trolley starts from rest and accelerates at 2.0 m/s^2 for 5.0 s. What is its displacement?',
          options: [],
          correct: { value: 25, tolerance: 0.1, unit: 'm' },
          explanation: 's = ut + 1/2 at^2 = 0 + 1/2(2.0)(5.0)^2 = 25 m.',
        },
        {
          type: 'numeric',
          question: 'A car slows from 20 m/s to 8 m/s in 6 s. Taking the original direction as positive, what is the acceleration?',
          options: [],
          correct: { value: -2, tolerance: 0.01, unit: 'm/s^2' },
          explanation: 'a = (v - u) / t = (8 - 20) / 6 = -2 m/s^2.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for solving a constant-acceleration problem.',
          options: ['Select an equation containing the unknown', 'List the known s, u, v, a and t values', 'Substitute values with signs', 'Calculate and include the unit'],
          correct: ['List the known s, u, v, a and t values', 'Select an equation containing the unknown', 'Substitute values with signs', 'Calculate and include the unit'],
          explanation: 'Listing variables first helps identify the correct equation.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student uses v = u + at to find displacement even though s is required. Identify the error.',
          options: [],
          correct: 'The chosen equation does not contain displacement, so it cannot directly solve for s.',
          explanation: 'For displacement with u, a and t known, s = ut + 1/2 at^2 is appropriate.',
        },
      ],
    },
    {
      topic: 'Forces & Motion',
      subtopic: "Newton's Laws",
      difficulty: 'medium',
      blocks: blocks(
        "Newton's First Law states that an object remains at rest or moves with constant velocity unless acted on by a resultant force. Newton's Second Law links resultant force, mass and acceleration through F = ma. Newton's Third Law states that when object A exerts a force on object B, object B exerts an equal and opposite force on object A. These action-reaction forces act on different objects. The laws explain everyday motion such as seat belts, pushing carts and rocket propulsion.",
        'If a 3 kg trolley experiences a resultant force of 12 N, its acceleration is a = F / m = 12 / 3 = 4 m/s^2. If the resultant force is zero, the trolley either remains at rest or continues moving at constant velocity. In a rocket launch, exhaust gases are pushed downward and the gases push the rocket upward with an equal and opposite force.',
        'Balanced forces do not mean no forces are acting; they mean the resultant force is zero. Action and reaction forces do not cancel each other because they act on different bodies. The force in F = ma must be the resultant force, not just one force selected from a diagram. A heavier object needs a larger resultant force to produce the same acceleration.',
        '| Term | Meaning |\n|---|---|\n| Inertia (Inersia) | Tendency of an object to resist changes in motion. |\n| Resultant force (Daya paduan) | Single force that represents the combined effect of all forces. |\n| Acceleration (Pecutan) | Change in velocity per unit time. |\n| Action-reaction pair (Pasangan tindakan-balasan) | Equal and opposite forces acting on two different objects. |\n| Mass (Jisim) | Measure of the amount of matter and inertia of an object. |',
        'Think "First: keep, Second: calculate, Third: pair." Objects keep their motion, resultant force calculates acceleration, and forces come in pairs on different objects.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which law explains inertia?',
          options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", "Hooke's Law"],
          correct: { optionIndex: 0 },
          explanation: "Newton's First Law describes the tendency to remain at rest or in uniform motion.",
        },
        {
          type: 'multiple_choice',
          question: 'Which equation represents Newton\'s Second Law for constant mass?',
          options: ['F = ma', 'P = F/A', 'V = IR', 'p = mv^2'],
          correct: { optionIndex: 0 },
          explanation: 'For constant mass, resultant force equals mass times acceleration.',
        },
        {
          type: 'true_false',
          question: 'Action and reaction forces cancel each other because they act on the same object.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'They act on different objects, so they do not cancel each other on one object.',
        },
        {
          type: 'numeric',
          question: 'A 3 kg trolley accelerates at 4 m/s^2. What resultant force acts on it?',
          options: [],
          correct: { value: 12, tolerance: 0, unit: 'N' },
          explanation: 'F = ma = 3 x 4 = 12 N.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for applying Newton\'s Second Law.',
          options: ['Calculate F = ma or a = F/m', 'Find the resultant force direction', 'Draw or inspect all forces on the object', 'State the acceleration direction'],
          correct: ['Draw or inspect all forces on the object', 'Find the resultant force direction', 'Calculate F = ma or a = F/m', 'State the acceleration direction'],
          explanation: 'The resultant force must be known before Newton\'s Second Law is applied.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says a moving bus with balanced forces must slow down because no forward resultant force acts. Identify the error.',
          options: [],
          correct: 'With zero resultant force, the bus continues at constant velocity; it does not slow unless a backward resultant force acts.',
          explanation: "Newton's First Law says uniform motion continues when resultant force is zero.",
        },
      ],
    },
    {
      topic: 'Forces & Motion',
      subtopic: 'Momentum & impulse',
      difficulty: 'hard',
      blocks: blocks(
        'Momentum is the product of mass and velocity, p = mv. Because velocity is a vector, momentum also has direction. Impulse is the product of force and time, and it is equal to the change in momentum. In a collision or explosion with no external resultant force, total momentum is conserved. Increasing the time of impact reduces the average force for the same change in momentum.',
        'A 0.15 kg ball moving at 20 m/s has momentum p = mv = 0.15 x 20 = 3.0 kg m/s. If it is brought to rest, its change in momentum has magnitude 3.0 kg m/s. If the stopping time is 0.50 s, the average force magnitude is F = impulse / time = 3.0 / 0.50 = 6.0 N. A longer stopping time would produce a smaller average force.',
        'Momentum is not the same as force; an object can have momentum without a force currently acting on it. Conservation of momentum applies to a system only when external forces are negligible. Direction signs are important, especially in head-on collisions. A soft landing surface reduces force by increasing impact time, not by removing the change in momentum.',
        '| Term | Meaning |\n|---|---|\n| Momentum (Momentum) | Product of mass and velocity, p = mv. |\n| Impulse (Impuls) | Product of force and time, equal to change in momentum. |\n| Conservation of momentum (Keabadian momentum) | Total momentum remains constant when no external resultant force acts. |\n| Collision (Perlanggaran) | Interaction where objects exert forces on each other for a short time. |\n| Impact time (Masa hentaman) | Duration over which a collision force acts. |',
        'Remember "Momentum moves, impulse changes": momentum tells how much motion an object carries, while impulse tells how much that momentum changes.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which expression gives momentum?',
          options: ['p = mv', 'p = F/A', 'p = W/t', 'p = V/I'],
          correct: { optionIndex: 0 },
          explanation: 'Momentum equals mass multiplied by velocity.',
        },
        {
          type: 'multiple_choice',
          question: 'Why do airbags reduce injury in a collision?',
          options: ['They increase stopping time and reduce average force', 'They reduce the mass of the passenger', 'They make momentum disappear', 'They make the car move faster'],
          correct: { optionIndex: 0 },
          explanation: 'For the same momentum change, increasing time reduces average force.',
        },
        {
          type: 'true_false',
          question: 'Total momentum is conserved in a system when the external resultant force is zero.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'This is the condition for conservation of momentum.',
        },
        {
          type: 'numeric',
          question: 'A 0.15 kg ball moves at 20 m/s. What is its momentum?',
          options: [],
          correct: { value: 3, tolerance: 0.01, unit: 'kg m/s' },
          explanation: 'p = mv = 0.15 x 20 = 3 kg m/s.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for solving a one-dimensional conservation of momentum problem.',
          options: ['Equate total momentum before and after', 'Choose a positive direction', 'Assign signs to velocities', 'Solve for the unknown velocity'],
          correct: ['Choose a positive direction', 'Assign signs to velocities', 'Equate total momentum before and after', 'Solve for the unknown velocity'],
          explanation: 'Direction signs must be set before momenta are added.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student adds two opposite momenta as 4 + 3 = 7 kg m/s even though one object moves left and the other moves right. Identify the error.',
          options: [],
          correct: 'Momentum is a vector, so opposite directions must be represented with opposite signs before adding.',
          explanation: 'Ignoring direction gives the wrong total momentum.',
        },
      ],
    },
    {
      topic: 'Pressure',
      subtopic: 'Pressure in solids & fluids',
      difficulty: 'medium',
      blocks: blocks(
        'Pressure is force acting normally per unit area, P = F/A. In solids, the same force produces higher pressure when the contact area is smaller. In liquids, pressure increases with depth because the liquid above has weight. Liquid pressure can be calculated using P = rho gh, where rho is density, g is gravitational field strength and h is depth. Pressure in a fluid acts in all directions at a point.',
        'A person exerts a force of 500 N on the floor through an area of 0.25 m^2. The pressure is P = F/A = 500 / 0.25 = 2000 Pa. If the contact area is reduced to 0.05 m^2, the pressure becomes 10000 Pa. This explains why sharp nails or blades work with smaller contact areas.',
        'Students often forget that area must be in m^2 when pressure is required in pascals. Pressure is not the same as force; a small force can produce high pressure if the area is tiny. In liquids, pressure depends on depth, density and gravitational field strength, not on the shape of the container. At the same depth in the same liquid, pressure is the same.',
        '| Term | Meaning |\n|---|---|\n| Pressure (Tekanan) | Normal force per unit area. |\n| Pascal (Pascal) | SI unit of pressure, equal to N/m^2. |\n| Density (Ketumpatan) | Mass per unit volume of a substance. |\n| Depth (Kedalaman) | Vertical distance below the liquid surface. |\n| Fluid pressure (Tekanan bendalir) | Pressure exerted by liquids or gases. |',
        'Use "Force over area, fluids go deeper": P = F/A for contact pressure, and liquid pressure grows as depth increases.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which change increases the pressure exerted by a solid object on a surface?',
          options: ['Increasing contact area only', 'Decreasing contact area for the same force', 'Decreasing force for the same area', 'Using a wider base'],
          correct: { optionIndex: 1 },
          explanation: 'Pressure increases when the same force acts over a smaller area.',
        },
        {
          type: 'multiple_choice',
          question: 'Which formula gives liquid pressure at depth h?',
          options: ['P = rho gh', 'P = mv', 'P = IV', 'P = W/t'],
          correct: { optionIndex: 0 },
          explanation: 'Liquid pressure depends on density, gravitational field strength and depth.',
        },
        {
          type: 'true_false',
          question: 'At the same depth in the same liquid, pressure is the same even if the container shapes are different.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Liquid pressure at a point depends on rho, g and h, not container shape.',
        },
        {
          type: 'numeric',
          question: 'A 500 N force acts on an area of 0.25 m^2. What pressure is produced?',
          options: [],
          correct: { value: 2000, tolerance: 1, unit: 'Pa' },
          explanation: 'P = F/A = 500 / 0.25 = 2000 Pa.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for calculating pressure in a liquid.',
          options: ['Substitute into P = rho gh', 'Identify density, g and depth', 'Convert depth to metres', 'State pressure in pascals'],
          correct: ['Identify density, g and depth', 'Convert depth to metres', 'Substitute into P = rho gh', 'State pressure in pascals'],
          explanation: 'The depth must be in metres before substitution.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says water pressure at 2 m depth is greater in a wide tank than in a narrow tube because the tank contains more water. Identify the error.',
          options: [],
          correct: 'At the same depth in the same liquid, pressure does not depend on the total amount of water or container width.',
          explanation: 'Only density, gravitational field strength and depth determine liquid pressure.',
        },
      ],
    },
    {
      topic: 'Pressure',
      subtopic: 'Atmospheric pressure & applications',
      difficulty: 'medium',
      blocks: blocks(
        'Atmospheric pressure is the pressure exerted by the weight of air above the Earth. It acts in all directions and decreases with altitude because there is less air above. Many devices work because of pressure differences, including syringes, drinking straws, suction cups and siphons. A barometer measures atmospheric pressure. When air is removed from a space, the lower pressure inside allows higher outside atmospheric pressure to push objects inward.',
        'When a drinking straw is used, the pressure inside the straw is reduced. Atmospheric pressure acting on the drink surface pushes the liquid up the straw. If atmospheric pressure is about 100000 Pa and it acts on an area of 0.020 m^2, the force is F = PA = 100000 x 0.020 = 2000 N. This shows how large pressure forces can be when the area is significant.',
        'A straw does not pull liquid upward by itself; the pressure difference allows atmospheric pressure to push the liquid. Suction cups stick only when air pressure inside is lower than outside. Atmospheric pressure is not zero simply because air is invisible. At high altitude, boiling point decreases because the atmospheric pressure is lower.',
        '| Term | Meaning |\n|---|---|\n| Atmospheric pressure (Tekanan atmosfera) | Pressure caused by the weight of air in the atmosphere. |\n| Barometer (Barometer) | Instrument used to measure atmospheric pressure. |\n| Vacuum (Vakum) | Region with very low pressure because most air is removed. |\n| Pressure difference (Perbezaan tekanan) | Unequal pressures that can cause fluid movement. |\n| Siphon (Sifon) | Tube arrangement that transfers liquid using pressure difference and gravity. |',
        'Remember "Air pushes from high to low": air pressure effects occur because fluids move or are pushed from higher pressure regions to lower pressure regions.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Why does atmospheric pressure decrease at higher altitude?',
          options: ['There is less air above the location', 'Gravity becomes zero', 'Air becomes a liquid', 'The Sun stops heating the air'],
          correct: { optionIndex: 0 },
          explanation: 'At higher altitude, the column of air above is smaller, so pressure decreases.',
        },
        {
          type: 'multiple_choice',
          question: 'Which instrument measures atmospheric pressure?',
          options: ['Barometer', 'Ammeter', 'Voltmeter', 'Micrometer'],
          correct: { optionIndex: 0 },
          explanation: 'A barometer is used to measure atmospheric pressure.',
        },
        {
          type: 'true_false',
          question: 'A suction cup works because the pressure inside it is lower than the atmospheric pressure outside.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'The higher outside atmospheric pressure presses the cup against the surface.',
        },
        {
          type: 'numeric',
          question: 'Atmospheric pressure is 100000 Pa on an area of 0.020 m^2. What force does it exert?',
          options: [],
          correct: { value: 2000, tolerance: 1, unit: 'N' },
          explanation: 'F = PA = 100000 x 0.020 = 2000 N.',
        },
        {
          type: 'step_order',
          question: 'Arrange the events when liquid rises in a drinking straw.',
          options: ['Atmospheric pressure pushes on the drink surface', 'Pressure in the straw is reduced', 'Liquid moves up toward the lower-pressure region', 'The drink reaches the mouth'],
          correct: ['Pressure in the straw is reduced', 'Atmospheric pressure pushes on the drink surface', 'Liquid moves up toward the lower-pressure region', 'The drink reaches the mouth'],
          explanation: 'Reducing pressure in the straw creates the pressure difference that moves the liquid.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says a syringe draws liquid because the plunger pulls liquid molecules directly upward. Identify the error.',
          options: [],
          correct: 'Pulling the plunger lowers pressure inside the syringe; atmospheric pressure on the liquid surface pushes the liquid in.',
          explanation: 'The key mechanism is pressure difference, not direct pulling of all liquid molecules.',
        },
      ],
    },
    {
      topic: 'Energy',
      subtopic: 'Forms & conservation of energy',
      difficulty: 'easy',
      blocks: blocks(
        'Energy is the ability to do work. It exists in many forms such as kinetic energy, gravitational potential energy, elastic potential energy, chemical energy, thermal energy, light energy and electrical energy. The principle of conservation of energy states that energy cannot be created or destroyed. Energy can only be transferred from one object to another or transformed from one form to another. In real systems, some energy is often dissipated as thermal energy or sound.',
        'A book of mass 2 kg lifted by 3 m gains gravitational potential energy, E = mgh = 2 x 10 x 3 = 60 J if g is taken as 10 N/kg. When it falls, this stored energy is transformed mainly into kinetic energy. As it hits the floor, energy is transferred to sound, thermal energy and deformation. The total energy remains conserved, even though useful energy may decrease.',
        'Conservation of energy does not mean useful energy is always conserved. Energy dissipated to the surroundings is still energy, but it may be harder to use. A moving object has kinetic energy, not gravitational potential energy unless its height matters. Energy and power are different: energy is measured in joules, while power is energy transferred per unit time.',
        '| Term | Meaning |\n|---|---|\n| Energy (Tenaga) | Ability to do work. |\n| Kinetic energy (Tenaga kinetik) | Energy of a moving object. |\n| Gravitational potential energy (Tenaga keupayaan graviti) | Energy due to position in a gravitational field. |\n| Conservation of energy (Keabadian tenaga) | Energy cannot be created or destroyed. |\n| Dissipation (Pelesapan) | Spreading of energy to less useful forms such as thermal energy. |',
        'Use "Energy changes clothes, not amount": energy may change form or location, but the total amount in a closed system stays the same.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which energy store increases when an object is lifted higher?',
          options: ['Gravitational potential energy', 'Chemical energy', 'Sound energy', 'Electrical energy'],
          correct: { optionIndex: 0 },
          explanation: 'Lifting an object increases its gravitational potential energy.',
        },
        {
          type: 'multiple_choice',
          question: 'What does the principle of conservation of energy state?',
          options: ['Energy can be created when needed', 'Energy cannot be created or destroyed', 'Useful energy is always 100 percent', 'Energy is the same as power'],
          correct: { optionIndex: 1 },
          explanation: 'Energy can be transformed or transferred, but not created or destroyed.',
        },
        {
          type: 'true_false',
          question: 'In real machines, some energy is often dissipated as thermal energy or sound.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Friction and other effects commonly dissipate energy to the surroundings.',
        },
        {
          type: 'numeric',
          question: 'A 2 kg book is lifted 3 m. Using g = 10 N/kg, what gravitational potential energy does it gain?',
          options: [],
          correct: { value: 60, tolerance: 0.1, unit: 'J' },
          explanation: 'E = mgh = 2 x 10 x 3 = 60 J.',
        },
        {
          type: 'step_order',
          question: 'Arrange the energy changes for a dropped ball.',
          options: ['Energy dissipates as sound and thermal energy on impact', 'Gravitational potential energy decreases', 'Kinetic energy increases', 'Ball starts from a raised position'],
          correct: ['Ball starts from a raised position', 'Gravitational potential energy decreases', 'Kinetic energy increases', 'Energy dissipates as sound and thermal energy on impact'],
          explanation: 'The ball starts with gravitational potential energy, which becomes kinetic energy before impact.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says energy is lost when a pendulum slows down. Identify the better physics explanation.',
          options: [],
          correct: 'The mechanical energy is transferred to the surroundings, mainly as thermal energy and sound; total energy is conserved.',
          explanation: 'Energy is dissipated, not destroyed.',
        },
      ],
    },
    {
      topic: 'Energy',
      subtopic: 'Work, power & efficiency',
      difficulty: 'medium',
      blocks: blocks(
        'Work is done when a force causes displacement in the direction of the force. The equation for work is W = Fs when force and displacement are in the same direction. Power is the rate of doing work or transferring energy, P = W/t. Efficiency compares useful energy or power output with total energy or power input. Efficiency is usually expressed as a percentage and is always less than 100 percent for real machines.',
        'A worker pushes a box with a force of 120 N through a distance of 5 m. The work done is W = Fs = 120 x 5 = 600 J. If this takes 10 s, the power is P = W/t = 600 / 10 = 60 W. If a motor receives 1000 J of electrical energy and produces 700 J of useful mechanical energy, its efficiency is 700 / 1000 x 100 percent = 70 percent.',
        'A force does no work on an object if there is no displacement in the direction of that force. Carrying a bag horizontally at constant height involves little work against gravity because the upward force and horizontal displacement are perpendicular. Power is not the same as force; it measures how quickly energy is transferred. Efficiency must compare useful output with total input, not the other way around.',
        '| Term | Meaning |\n|---|---|\n| Work (Kerja) | Energy transferred when force moves an object through a displacement. |\n| Power (Kuasa) | Rate of work done or energy transferred. |\n| Efficiency (Kecekapan) | Useful output energy or power divided by input energy or power. |\n| Joule (Joule) | SI unit of work and energy. |\n| Watt (Watt) | SI unit of power, equal to J/s. |',
        'Remember "Work is force through distance; power is work per time; efficiency is useful over input." The order of the fraction matters for efficiency.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which equation gives work done when force and displacement are in the same direction?',
          options: ['W = Fs', 'W = F/A', 'W = V/I', 'W = mv'],
          correct: { optionIndex: 0 },
          explanation: 'Work done equals force multiplied by displacement in the direction of the force.',
        },
        {
          type: 'multiple_choice',
          question: 'Which unit is equivalent to one watt?',
          options: ['J/s', 'N/m^2', 'kg m/s', 'A s'],
          correct: { optionIndex: 0 },
          explanation: 'Power is energy transferred per second, so watt = joule per second.',
        },
        {
          type: 'true_false',
          question: 'Efficiency is calculated as useful output divided by total input, then multiplied by 100 percent.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'This is the standard efficiency formula.',
        },
        {
          type: 'numeric',
          question: 'A 120 N force moves a box 5 m in the direction of the force. What work is done?',
          options: [],
          correct: { value: 600, tolerance: 0.1, unit: 'J' },
          explanation: 'W = Fs = 120 x 5 = 600 J.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps to calculate efficiency from energy values.',
          options: ['Multiply by 100 percent', 'Identify useful output energy', 'Divide useful output by total input', 'Identify total input energy'],
          correct: ['Identify useful output energy', 'Identify total input energy', 'Divide useful output by total input', 'Multiply by 100 percent'],
          explanation: 'Efficiency compares useful output with total input.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student calculates efficiency as input energy divided by useful output energy. Identify the error.',
          options: [],
          correct: 'The ratio is inverted; efficiency should be useful output divided by total input.',
          explanation: 'Using input divided by output can produce impossible efficiencies above 100 percent.',
        },
      ],
    },
    {
      topic: 'Waves',
      subtopic: 'Properties of waves',
      difficulty: 'easy',
      blocks: blocks(
        'A wave transfers energy from one place to another without transferring matter as a whole. Transverse waves vibrate perpendicular to the direction of propagation, while longitudinal waves vibrate parallel to the direction of propagation. Important wave quantities include amplitude, wavelength, frequency, period and wave speed. The relationship v = f lambda links wave speed, frequency and wavelength. Waves can be reflected, refracted, diffracted and superposed.',
        'If a water wave has frequency 5 Hz and wavelength 2 m, its speed is v = f lambda = 5 x 2 = 10 m/s. A larger amplitude means the wave carries more energy, but it does not by itself mean the wave travels faster. For a fixed wave speed, increasing frequency decreases wavelength. This inverse relationship is seen in many wave situations.',
        'Wave particles do not travel with the wave over long distances; they oscillate about fixed positions. Frequency is not the same as speed: frequency counts oscillations per second, while speed is distance travelled per second. Amplitude is measured from the rest position to a crest, not from crest to trough. The period is the time for one complete oscillation, so T = 1/f.',
        '| Term | Meaning |\n|---|---|\n| Wave (Gelombang) | Disturbance that transfers energy. |\n| Amplitude (Amplitud) | Maximum displacement from the equilibrium position. |\n| Wavelength (Panjang gelombang) | Distance between two consecutive points in phase. |\n| Frequency (Frekuensi) | Number of complete oscillations per second. |\n| Period (Tempoh) | Time taken for one complete oscillation. |',
        'Use "v f lambda": wave speed equals frequency times wavelength. Amplitude is height, wavelength is spacing, frequency is count per second.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What does a wave transfer from one place to another?',
          options: ['Energy', 'Matter as a whole', 'Mass only', 'Density only'],
          correct: { optionIndex: 0 },
          explanation: 'A wave transfers energy without transporting matter as a whole.',
        },
        {
          type: 'multiple_choice',
          question: 'In a transverse wave, particle vibration is',
          options: ['parallel to the direction of wave travel', 'perpendicular to the direction of wave travel', 'always circular', 'absent'],
          correct: { optionIndex: 1 },
          explanation: 'Transverse waves vibrate perpendicular to their direction of propagation.',
        },
        {
          type: 'true_false',
          question: 'Amplitude is measured from the equilibrium position to a crest.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Crest-to-trough distance is twice the amplitude.',
        },
        {
          type: 'numeric',
          question: 'A wave has frequency 5 Hz and wavelength 2 m. What is its speed?',
          options: [],
          correct: { value: 10, tolerance: 0, unit: 'm/s' },
          explanation: 'v = f lambda = 5 x 2 = 10 m/s.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for finding wave speed from frequency and wavelength.',
          options: ['State the unit m/s', 'Identify frequency and wavelength', 'Use v = f lambda', 'Multiply the two values'],
          correct: ['Identify frequency and wavelength', 'Use v = f lambda', 'Multiply the two values', 'State the unit m/s'],
          explanation: 'Frequency and wavelength are substituted into v = f lambda.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says a wave with twice the amplitude must travel twice as fast. Identify the error.',
          options: [],
          correct: 'Amplitude relates to energy carried by the wave, not directly to wave speed.',
          explanation: 'Wave speed depends on the medium and wave relationship, not simply amplitude.',
        },
      ],
    },
    {
      topic: 'Waves',
      subtopic: 'Light reflection & refraction',
      difficulty: 'medium',
      blocks: blocks(
        'Reflection occurs when light bounces off a surface. The law of reflection states that the angle of incidence equals the angle of reflection, with both angles measured from the normal. Refraction occurs when light changes speed as it passes from one medium to another, causing a change in direction unless it enters along the normal. Light bends towards the normal when it slows down in an optically denser medium. Refractive index compares the speed of light in vacuum with its speed in a medium.',
        'If a light ray hits a plane mirror at an angle of incidence of 35 degrees, the angle of reflection is also 35 degrees. If light travels from air into glass, it slows down and bends towards the normal. For glass where the speed of light is 2.0 x 10^8 m/s, the refractive index is n = c/v = 3.0 x 10^8 / 2.0 x 10^8 = 1.5. A higher refractive index means light travels more slowly in that medium.',
        'Angles in reflection and refraction are measured from the normal, not from the surface. Refraction is caused by a change in speed, not by the light "choosing" a new path. A ray entering along the normal changes speed but does not bend. Critical angle and total internal reflection occur only when light travels from a denser medium to a less dense medium.',
        '| Term | Meaning |\n|---|---|\n| Reflection (Pantulan) | Bouncing of light from a surface. |\n| Refraction (Pembiasan) | Bending of light due to a change in speed between media. |\n| Normal (Normal) | Line drawn perpendicular to the surface at the point of incidence. |\n| Refractive index (Indeks biasan) | Ratio of light speed in vacuum to light speed in a medium. |\n| Critical angle (Sudut genting) | Incidence angle in a denser medium that gives refraction at 90 degrees. |',
        'Remember "mirror equal, medium bends": reflection keeps equal angles, refraction bends when speed changes between media.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'For reflection from a plane mirror, which statement is correct?',
          options: ['Angle of incidence equals angle of reflection', 'Angle of incidence is always 90 degrees', 'The ray always bends towards the normal', 'The reflected ray disappears'],
          correct: { optionIndex: 0 },
          explanation: 'The law of reflection states that the two angles are equal.',
        },
        {
          type: 'multiple_choice',
          question: 'When light enters glass from air at an angle and slows down, it usually bends',
          options: ['towards the normal', 'away from the normal', 'parallel to the surface', 'back along the same path only'],
          correct: { optionIndex: 0 },
          explanation: 'Light bends towards the normal when it enters an optically denser medium and slows down.',
        },
        {
          type: 'true_false',
          question: 'Angles of incidence and refraction are measured from the normal.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Using the surface instead of the normal gives incorrect angles.',
        },
        {
          type: 'numeric',
          question: 'Light travels in glass at 2.0 x 10^8 m/s. Using c = 3.0 x 10^8 m/s, what is the refractive index?',
          options: [],
          correct: { value: 1.5, tolerance: 0.01, unit: '' },
          explanation: 'n = c/v = 3.0 x 10^8 / 2.0 x 10^8 = 1.5.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for drawing a reflected ray from a plane mirror.',
          options: ['Measure the angle of incidence from the normal', 'Draw the reflected ray with the same angle', 'Draw the normal at the point of incidence', 'Mark the incident ray'],
          correct: ['Mark the incident ray', 'Draw the normal at the point of incidence', 'Measure the angle of incidence from the normal', 'Draw the reflected ray with the same angle'],
          explanation: 'The normal provides the reference line for both angles.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student measures the angle of incidence from the mirror surface instead of the normal. Identify the error.',
          options: [],
          correct: 'Angles of incidence and reflection must be measured from the normal, not from the surface.',
          explanation: 'The normal is perpendicular to the surface and is the required reference line.',
        },
      ],
    },
    {
      topic: 'Electricity',
      subtopic: 'Current, voltage & resistance',
      difficulty: 'medium',
      blocks: blocks(
        'Electric current is the rate of flow of electric charge, I = Q/t. Potential difference, or voltage, is the energy transferred per unit charge between two points. Resistance is the opposition to current flow. Ohm\'s Law states that V = IR for an ohmic conductor at constant temperature. Ammeters are connected in series to measure current, while voltmeters are connected in parallel to measure potential difference.',
        'If a resistor of 6 ohm carries a current of 0.5 A, the potential difference across it is V = IR = 0.5 x 6 = 3 V. If 12 V is applied across a 4 ohm resistor, the current is I = V/R = 12 / 4 = 3 A. In a simple circuit, increasing resistance while keeping voltage constant reduces current. This relationship is central to circuit calculations.',
        'Current is not "used up" as it passes through a component; energy is transferred, but charge continues around the circuit. A voltmeter must not be connected in series for normal measurement because it has very high resistance. An ammeter must not be connected in parallel across a component because it has very low resistance and may cause a large current. Ohm\'s Law applies only when temperature and physical conditions remain constant.',
        '| Term | Meaning |\n|---|---|\n| Current (Arus) | Rate of flow of electric charge. |\n| Potential difference (Beza keupayaan) | Energy transferred per unit charge. |\n| Resistance (Rintangan) | Opposition to current flow. |\n| Ohm\'s Law (Hukum Ohm) | Relationship V = IR for an ohmic conductor at constant temperature. |\n| Ammeter and voltmeter (Ammeter dan voltmeter) | Instruments for measuring current and voltage. |',
        'Use "A series, V parallel": ammeter in series, voltmeter in parallel. For calculations, cover the unknown in V = IR.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Electric current is defined as',
          options: ['charge flow per unit time', 'energy per unit mass', 'force per unit area', 'distance per unit time'],
          correct: { optionIndex: 0 },
          explanation: 'Current is I = Q/t.',
        },
        {
          type: 'multiple_choice',
          question: 'How should a voltmeter be connected to measure the potential difference across a resistor?',
          options: ['In parallel with the resistor', 'In series with the resistor', 'In place of the cell', 'Only outside the circuit'],
          correct: { optionIndex: 0 },
          explanation: 'A voltmeter measures potential difference between two points, so it is connected in parallel.',
        },
        {
          type: 'true_false',
          question: 'Conventional current flows from the positive terminal to the negative terminal in the external circuit.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Conventional current direction is from positive to negative, opposite to electron flow.',
        },
        {
          type: 'numeric',
          question: 'A 6 ohm resistor carries a current of 0.5 A. What is the potential difference across it?',
          options: [],
          correct: { value: 3, tolerance: 0.01, unit: 'V' },
          explanation: 'V = IR = 0.5 x 6 = 3 V.',
        },
        {
          type: 'numeric',
          question: 'A 12 V supply is connected across a 4 ohm resistor. What current flows?',
          options: [],
          correct: { value: 3, tolerance: 0.01, unit: 'A' },
          explanation: 'I = V/R = 12 / 4 = 3 A.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student connects an ammeter directly across a cell to measure current. Identify the error.',
          options: [],
          correct: 'An ammeter has very low resistance and must be connected in series; connecting it across a cell can cause a large current.',
          explanation: 'Ammeters are series instruments, not parallel instruments.',
        },
      ],
    },
    {
      topic: 'Electricity',
      subtopic: 'Series & parallel circuits',
      difficulty: 'hard',
      blocks: blocks(
        'In a series circuit, components are connected one after another in a single path. The current is the same through each component, while the supply voltage is shared across the components. The total resistance in series is the sum of the individual resistances. In a parallel circuit, components are connected across the same two points, so each branch has the same potential difference. Adding parallel branches decreases total resistance because more paths are available for current.',
        'For resistors of 2 ohm, 3 ohm and 5 ohm in series, the total resistance is R = 2 + 3 + 5 = 10 ohm. For 6 ohm and 3 ohm resistors in parallel, 1/R = 1/6 + 1/3 = 1/6 + 2/6 = 3/6, so R = 2 ohm. If a 12 V supply is connected to that 2 ohm parallel combination, the total current is I = V/R = 12 / 2 = 6 A. Different rules are needed for series and parallel parts.',
        'A common error is adding parallel resistances as if they were in series. In a series circuit, current is not divided between components because there is only one path. In a parallel circuit, voltage is not divided between branches; each branch has the supply voltage if connected directly across it. The equivalent resistance of parallel resistors is always less than the smallest branch resistance.',
        '| Term | Meaning |\n|---|---|\n| Series circuit (Litar bersiri) | Circuit with one path for current. |\n| Parallel circuit (Litar selari) | Circuit with more than one branch for current. |\n| Equivalent resistance (Rintangan setara) | Single resistance with the same effect as a group of resistors. |\n| Branch current (Arus cabang) | Current flowing in one parallel path. |\n| Potential divider (Pembahagi keupayaan) | Series arrangement where supply voltage is shared between components. |',
        'Use "Series same current, parallel same voltage." Add resistances in series; add reciprocals for resistances in parallel.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which quantity is the same through all components in a series circuit?',
          options: ['Current', 'Voltage across each component', 'Resistance of each component', 'Power in each component'],
          correct: { optionIndex: 0 },
          explanation: 'There is only one path in a series circuit, so current is the same through each component.',
        },
        {
          type: 'multiple_choice',
          question: 'Which quantity is the same across branches connected in parallel to the same supply?',
          options: ['Potential difference', 'Branch current', 'Resistance', 'Length of wire'],
          correct: { optionIndex: 0 },
          explanation: 'Parallel branches share the same two connection points, so they have the same potential difference.',
        },
        {
          type: 'true_false',
          question: 'Adding another resistor branch in parallel increases the total resistance of the circuit.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Adding a parallel branch gives current another path, so total resistance decreases.',
        },
        {
          type: 'numeric',
          question: 'Three resistors of 2 ohm, 3 ohm and 5 ohm are connected in series. What is the total resistance?',
          options: [],
          correct: { value: 10, tolerance: 0.01, unit: 'ohm' },
          explanation: 'Series resistance is the sum: 2 + 3 + 5 = 10 ohm.',
        },
        {
          type: 'numeric',
          question: 'A 6 ohm resistor and a 3 ohm resistor are connected in parallel. What is the equivalent resistance?',
          options: [],
          correct: { value: 2, tolerance: 0.01, unit: 'ohm' },
          explanation: '1/R = 1/6 + 1/3 = 3/6, so R = 2 ohm.',
        },
        {
          type: 'step_order',
          question: 'Arrange the steps to find total current for a parallel circuit supplied by a known voltage.',
          options: ['Use I = V/R_total', 'Find the reciprocal sum for the parallel resistors', 'Calculate equivalent resistance', 'Identify the supply voltage'],
          correct: ['Find the reciprocal sum for the parallel resistors', 'Calculate equivalent resistance', 'Identify the supply voltage', 'Use I = V/R_total'],
          explanation: 'The total equivalent resistance is needed before total current can be calculated.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student calculates 6 ohm and 3 ohm in parallel as 6 + 3 = 9 ohm. Identify the error.',
          options: [],
          correct: 'The student used the series rule; parallel resistors require adding reciprocals, giving 2 ohm.',
          explanation: 'Parallel equivalent resistance is less than the smallest branch resistance.',
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      `${lesson.topic}: ${lesson.subtopic}`,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.question,
        question.options,
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm4Maths(client) {
  const subject = 'Matematik';
  const formLevel = 4;
  const lessons = [
    {
      topic: 'Functions',
      subtopic: 'Function notation & types',
      difficulty: 'easy',
      title: 'Fungsi: Tatatanda Fungsi dan Jenis Fungsi',
      blocks: [
        section(
          'Konsep',
          'Fungsi ialah hubungan yang memetakan setiap input kepada tepat satu output. Tatatanda f(x) dibaca sebagai "f bagi x" dan bermaksud nilai fungsi f apabila inputnya ialah x. Domain ialah set input yang dibenarkan, manakala julat ialah set output yang terhasil. Sesuatu hubungan bukan fungsi jika satu input yang sama mempunyai dua output yang berbeza.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi f(x) = 2x - 3.
Cari f(5):
f(5) = 2(5) - 3
f(5) = 10 - 3
f(5) = 7

Cari nilai x apabila f(x) = 9:
2x - 3 = 9
2x = 9 + 3
2x = 12
x = 12 / 2
x = 6`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan anggap f(x) bermaksud f didarab dengan x; f(x) ialah nama nilai fungsi. Semak input berulang dalam pasangan tertib: jika input sama menghasilkan output berbeza, hubungan itu bukan fungsi. Apabila menggantikan nilai negatif, gunakan kurungan supaya kuasa dan tanda negatif tidak tersalah kira.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Fungsi | Hubungan dengan setiap input mempunyai tepat satu output |\n| Domain | Set nilai input yang dibenarkan |\n| Julat | Set nilai output yang terhasil |\n| Tatatanda fungsi | Cara menulis nilai fungsi seperti f(x) |\n| Imej | Output bagi sesuatu input di bawah fungsi |'
        ),
        section(
          'Petua Ingatan',
          'Ingat "satu input, satu output" sebagai ujian utama fungsi. Untuk f(a), salin rumus fungsi dahulu, kemudian gantikan semua x dengan a secara berkurung.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Diberi f(x) = 3x + 2. Cari f(4).',
          correct: { value: 14, tolerance: 0, unit: '' },
          explanation: 'f(4) = 3(4) + 2 = 12 + 2 = 14.',
        },
        {
          type: 'numeric',
          text: 'Diberi g(x) = x^2 - 5. Cari g(-3).',
          correct: { value: 4, tolerance: 0, unit: '' },
          explanation: 'g(-3) = (-3)^2 - 5 = 9 - 5 = 4.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyelesaikan f(x) = 15 bagi f(x) = 2x + 1.',
          options: [
            'Tulis persamaan 2x + 1 = 15',
            'Tolak 1 pada kedua-dua belah: 2x = 14',
            'Bahagi kedua-dua belah dengan 2: x = 7',
            'Nyatakan nilai input ialah 7',
          ],
          correct: [
            'Tulis persamaan 2x + 1 = 15',
            'Tolak 1 pada kedua-dua belah: 2x = 14',
            'Bahagi kedua-dua belah dengan 2: x = 7',
            'Nyatakan nilai input ialah 7',
          ],
          explanation: 'Operasi songsang dibuat selepas nilai fungsi disamakan dengan 15.',
        },
        {
          type: 'numeric',
          text: 'Untuk h(x) = 4x - 1 dengan domain {1, 2, 3}, cari jumlah semua imej h(1) + h(2) + h(3).',
          correct: { value: 21, tolerance: 0, unit: '' },
          explanation: 'h(1)=3, h(2)=7, h(3)=11, maka jumlah imej ialah 3 + 7 + 11 = 21.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyemak sama ada pasangan (1, 4), (2, 5), (1, 6) mewakili fungsi.',
          options: [
            'Senaraikan semua input: 1, 2, 1',
            'Kenal pasti input yang berulang, iaitu 1',
            'Bandingkan output bagi input 1: 4 dan 6',
            'Simpulkan hubungan itu bukan fungsi kerana satu input mempunyai dua output',
          ],
          correct: [
            'Senaraikan semua input: 1, 2, 1',
            'Kenal pasti input yang berulang, iaitu 1',
            'Bandingkan output bagi input 1: 4 dan 6',
            'Simpulkan hubungan itu bukan fungsi kerana satu input mempunyai dua output',
          ],
          explanation: 'Ujian fungsi tertumpu pada input yang sama, bukan pada output yang sama.',
        },
        {
          type: 'numeric',
          text: 'Diberi p(x) = 12 / (x - 1). Apakah nilai x yang tidak dibenarkan dalam domain?',
          correct: { value: 1, tolerance: 0, unit: '' },
          explanation: 'Penyebut tidak boleh menjadi sifar. x - 1 = 0, maka x = 1 tidak dibenarkan.',
        },
      ],
    },
    {
      topic: 'Functions',
      subtopic: 'Composite & inverse functions',
      difficulty: 'medium',
      title: 'Fungsi Gubahan dan Fungsi Songsang',
      blocks: [
        section(
          'Konsep',
          'Fungsi gubahan menggabungkan dua fungsi mengikut urutan tertentu. (f o g)(x) bermaksud g digunakan dahulu, kemudian hasilnya dimasukkan ke dalam f. Fungsi songsang membalikkan pemetaan fungsi asal, jadi jika f(a) = b maka f^-1(b) = a. Fungsi songsang wujud sebagai fungsi apabila fungsi asal satu dengan satu pada domain yang dipilih.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi f(x) = 2x + 1 dan g(x) = x - 3.
Cari (f o g)(x):
(f o g)(x) = f(g(x))
(f o g)(x) = f(x - 3)
(f o g)(x) = 2(x - 3) + 1
(f o g)(x) = 2x - 6 + 1
(f o g)(x) = 2x - 5

Cari f^-1(x):
Letakkan y = 2x + 1
y - 1 = 2x
x = (y - 1) / 2
Tukar y kepada x: f^-1(x) = (x - 1) / 2`
        ),
        section(
          'Kesilapan Lazim',
          'Urutan fungsi gubahan tidak boleh ditukar sesuka hati; secara umum (f o g)(x) tidak sama dengan (g o f)(x). Untuk fungsi songsang, jangan hanya menukar tanda operasi tanpa menyelesaikan semula persamaan. Sentiasa semak songsang dengan menggubah f(f^-1(x)) atau f^-1(f(x)) untuk mendapat x.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Fungsi gubahan | Fungsi yang terbentuk apabila output satu fungsi menjadi input fungsi lain |\n| (f o g)(x) | g(x) dikira dahulu, kemudian f digunakan pada hasil itu |\n| Fungsi songsang | Fungsi yang membalikkan input dan output fungsi asal |\n| Satu dengan satu | Setiap output datang daripada satu input sahaja |\n| Semakan songsang | Gubahan fungsi dengan songsangnya menghasilkan x |'
        ),
        section(
          'Petua Ingatan',
          'Baca (f o g)(x) dari kanan ke kiri: buat g dahulu, kemudian f. Untuk songsang, gunakan tiga langkah ringkas: tulis y, jadikan x sebagai perkara rumus, kemudian tukar y kepada x.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Diberi f(x) = 3x - 2 dan g(x) = x + 5. Cari (f o g)(4).',
          correct: { value: 25, tolerance: 0, unit: '' },
          explanation: 'g(4) = 9, kemudian f(9) = 3(9) - 2 = 25.',
        },
        {
          type: 'numeric',
          text: 'Diberi f(x) = 2x + 7. Cari f^-1(15).',
          correct: { value: 4, tolerance: 0, unit: '' },
          explanation: '2x + 7 = 15, maka 2x = 8 dan x = 4.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari songsang bagi f(x) = 5x - 10.',
          options: [
            'Tulis y = 5x - 10',
            'Tambah 10 pada kedua-dua belah: y + 10 = 5x',
            'Bahagi dengan 5: x = (y + 10) / 5',
            'Tukar y kepada x: f^-1(x) = (x + 10) / 5',
          ],
          correct: [
            'Tulis y = 5x - 10',
            'Tambah 10 pada kedua-dua belah: y + 10 = 5x',
            'Bahagi dengan 5: x = (y + 10) / 5',
            'Tukar y kepada x: f^-1(x) = (x + 10) / 5',
          ],
          explanation: 'Fungsi songsang diperoleh dengan menjadikan x sebagai perkara rumus dahulu.',
        },
        {
          type: 'numeric',
          text: 'Diberi f(x) = x^2 dan g(x) = x - 1. Cari (g o f)(3).',
          correct: { value: 8, tolerance: 0, unit: '' },
          explanation: 'f(3) = 9, kemudian g(9) = 9 - 1 = 8.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah memudahkan (f o g)(x) bagi f(x) = x + 4 dan g(x) = 2x.',
          options: [
            'Tulis (f o g)(x) = f(g(x))',
            'Gantikan g(x) dengan 2x: f(2x)',
            'Masukkan 2x ke dalam f: 2x + 4',
            'Nyatakan (f o g)(x) = 2x + 4',
          ],
          correct: [
            'Tulis (f o g)(x) = f(g(x))',
            'Gantikan g(x) dengan 2x: f(2x)',
            'Masukkan 2x ke dalam f: 2x + 4',
            'Nyatakan (f o g)(x) = 2x + 4',
          ],
          explanation: 'Gubahan dibuat dengan menggantikan keseluruhan g(x) ke tempat x dalam fungsi f.',
        },
        {
          type: 'numeric',
          text: 'Diberi h(x) = 4x - 1. Cari h^-1(11).',
          correct: { value: 3, tolerance: 0, unit: '' },
          explanation: '4x - 1 = 11, maka 4x = 12 dan x = 3.',
        },
      ],
    },
    {
      topic: 'Quadratic Functions',
      subtopic: 'Vertex form & graph',
      difficulty: 'medium',
      title: 'Fungsi Kuadratik: Bentuk Puncak dan Graf',
      blocks: [
        section(
          'Konsep',
          'Fungsi kuadratik boleh ditulis sebagai y = a(x - h)^2 + k, dengan puncak graf pada (h, k). Paksi simetri ialah garis x = h. Jika a positif, parabola membuka ke atas dan puncak memberi nilai minimum; jika a negatif, parabola membuka ke bawah dan puncak memberi nilai maksimum. Pintasan-y diperoleh dengan menggantikan x = 0.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi y = (x - 2)^2 - 3.
Puncak:
y = a(x - h)^2 + k
h = 2 dan k = -3
Puncak = (2, -3)

Paksi simetri:
x = h
x = 2

Pintasan-y:
Gantikan x = 0
y = (0 - 2)^2 - 3
y = (-2)^2 - 3
y = 4 - 3
y = 1`
        ),
        section(
          'Kesilapan Lazim',
          'Dalam bentuk y = a(x - h)^2 + k, tanda h dibaca berlawanan dengan tanda dalam kurungan. Contohnya (x + 3)^2 bermaksud h = -3, bukan 3. Jangan lupa bahawa nilai a menentukan arah bukaan parabola dan mempengaruhi kelebaran graf.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Parabola | Bentuk graf fungsi kuadratik |\n| Puncak | Titik minimum atau maksimum pada parabola |\n| Paksi simetri | Garis menegak yang membahagi parabola kepada dua bahagian sepadan |\n| Pintasan-y | Titik graf memotong paksi-y |\n| Bentuk puncak | Bentuk y = a(x - h)^2 + k |'
        ),
        section(
          'Petua Ingatan',
          'Untuk bentuk puncak, lihat nombor di luar kuasa dua sebagai k, dan nombor dalam kurungan sebagai h dengan tanda berlawanan.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Bagi y = (x + 3)^2 + 5, apakah koordinat-x puncak?',
          correct: { value: -3, tolerance: 0, unit: '' },
          explanation: '(x + 3)^2 = (x - (-3))^2, maka h = -3.',
        },
        {
          type: 'numeric',
          text: 'Bagi y = 2(x - 4)^2 - 7, apakah nilai minimum y?',
          correct: { value: -7, tolerance: 0, unit: '' },
          explanation: 'Oleh sebab a = 2 positif, puncak memberi nilai minimum, iaitu k = -7.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menulis y = x^2 - 6x + 5 dalam bentuk puncak.',
          options: [
            'Kumpulkan sebutan x: y = (x^2 - 6x) + 5',
            'Ambil separuh daripada -6, iaitu -3, dan kuasakan dua menjadi 9',
            'Tambah dan tolak 9: y = (x^2 - 6x + 9) - 9 + 5',
            'Tulis kuasa dua sempurna: y = (x - 3)^2 - 4',
          ],
          correct: [
            'Kumpulkan sebutan x: y = (x^2 - 6x) + 5',
            'Ambil separuh daripada -6, iaitu -3, dan kuasakan dua menjadi 9',
            'Tambah dan tolak 9: y = (x^2 - 6x + 9) - 9 + 5',
            'Tulis kuasa dua sempurna: y = (x - 3)^2 - 4',
          ],
          explanation: 'Melengkapkan kuasa dua menukar bentuk am kepada bentuk puncak.',
        },
        {
          type: 'numeric',
          text: 'Cari pintasan-y bagi y = (x - 1)^2 - 4.',
          correct: { value: -3, tolerance: 0, unit: '' },
          explanation: 'Gantikan x = 0: y = (0 - 1)^2 - 4 = 1 - 4 = -3.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah melakar y = -(x + 2)^2 + 1.',
          options: [
            'Kenal pasti puncak sebagai (-2, 1)',
            'Tentukan paksi simetri x = -2',
            'Perhatikan a = -1, jadi parabola membuka ke bawah',
            'Plot puncak dan titik sepadan di kiri serta kanan paksi simetri',
          ],
          correct: [
            'Kenal pasti puncak sebagai (-2, 1)',
            'Tentukan paksi simetri x = -2',
            'Perhatikan a = -1, jadi parabola membuka ke bawah',
            'Plot puncak dan titik sepadan di kiri serta kanan paksi simetri',
          ],
          explanation: 'Ciri puncak, paksi simetri, dan arah bukaan cukup untuk lakaran asas parabola.',
        },
        {
          type: 'numeric',
          text: 'Bagi y = 3(x - 5)^2 + 2, apakah nilai x bagi paksi simetri?',
          correct: { value: 5, tolerance: 0, unit: '' },
          explanation: 'Paksi simetri bagi y = a(x - h)^2 + k ialah x = h, jadi x = 5.',
        },
      ],
    },
    {
      topic: 'Quadratic Functions',
      subtopic: 'Solving quadratic equations',
      difficulty: 'medium',
      title: 'Menyelesaikan Persamaan Kuadratik',
      blocks: [
        section(
          'Konsep',
          'Persamaan kuadratik mempunyai bentuk ax^2 + bx + c = 0 dengan a bukan sifar. Penyelesaian atau punca ialah nilai x yang menjadikan persamaan benar. Kaedah biasa termasuk pemfaktoran, melengkapkan kuasa dua, dan rumus kuadratik. Diskriminan b^2 - 4ac membantu menentukan bilangan dan jenis punca.'
        ),
        section(
          'Contoh Penyelesaian',
          `Selesaikan x^2 - 5x + 6 = 0.
Cari dua nombor yang hasil darabnya 6 dan jumlahnya -5: -2 dan -3
x^2 - 5x + 6 = 0
(x - 2)(x - 3) = 0
x - 2 = 0 atau x - 3 = 0
x = 2 atau x = 3

Semakan:
Untuk x = 2, 2^2 - 5(2) + 6 = 4 - 10 + 6 = 0
Untuk x = 3, 3^2 - 5(3) + 6 = 9 - 15 + 6 = 0`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan faktorkan tanpa memastikan persamaan sama dengan sifar. Jika menggunakan rumus kuadratik, masukkan tanda b dengan betul, terutama apabila b negatif. Selepas mendapat faktor, gunakan prinsip hasil darab sifar: setiap faktor disamakan dengan sifar secara berasingan.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Persamaan kuadratik | Persamaan berbentuk ax^2 + bx + c = 0 |\n| Punca | Nilai x yang memenuhi persamaan |\n| Pemfaktoran | Menulis ungkapan sebagai hasil darab faktor |\n| Diskriminan | Nilai b^2 - 4ac dalam rumus kuadratik |\n| Prinsip hasil darab sifar | Jika AB = 0, maka A = 0 atau B = 0 |'
        ),
        section(
          'Petua Ingatan',
          'Untuk x^2 + bx + c, cari dua nombor yang jumlahnya b dan hasil darabnya c. Jika pekali x^2 bukan 1, semak faktor dengan mengembangkan semula.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Apakah punca yang lebih besar bagi x^2 - 7x + 12 = 0?',
          correct: { value: 4, tolerance: 0, unit: '' },
          explanation: 'x^2 - 7x + 12 = (x - 3)(x - 4), maka punca ialah 3 dan 4.',
        },
        {
          type: 'numeric',
          text: 'Apakah punca yang lebih kecil bagi x^2 + 2x - 8 = 0?',
          correct: { value: -4, tolerance: 0, unit: '' },
          explanation: 'x^2 + 2x - 8 = (x + 4)(x - 2), maka punca ialah -4 dan 2.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyelesaikan x^2 - 4x - 12 = 0 melalui pemfaktoran.',
          options: [
            'Faktorkan persamaan: (x - 6)(x + 2) = 0',
            'Samakan faktor pertama dengan sifar: x - 6 = 0',
            'Samakan faktor kedua dengan sifar: x + 2 = 0',
            'Nyatakan punca: x = 6 atau x = -2',
          ],
          correct: [
            'Faktorkan persamaan: (x - 6)(x + 2) = 0',
            'Samakan faktor pertama dengan sifar: x - 6 = 0',
            'Samakan faktor kedua dengan sifar: x + 2 = 0',
            'Nyatakan punca: x = 6 atau x = -2',
          ],
          explanation: 'Selepas pemfaktoran, setiap faktor linear boleh menghasilkan satu punca.',
        },
        {
          type: 'numeric',
          text: 'Cari jumlah punca bagi 2x^2 - 5x + 2 = 0.',
          correct: { value: 2.5, tolerance: 0, unit: '' },
          explanation: 'Jumlah punca persamaan ax^2 + bx + c = 0 ialah -b/a = -(-5)/2 = 2.5.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menggunakan rumus kuadratik bagi x^2 + 4x + 1 = 0.',
          options: [
            'Kenal pasti a = 1, b = 4, c = 1',
            'Tulis x = (-b +- sqrt(b^2 - 4ac)) / (2a)',
            'Gantikan nilai: x = (-4 +- sqrt(16 - 4)) / 2',
            'Ringkaskan: x = (-4 +- sqrt(12)) / 2',
          ],
          correct: [
            'Kenal pasti a = 1, b = 4, c = 1',
            'Tulis x = (-b +- sqrt(b^2 - 4ac)) / (2a)',
            'Gantikan nilai: x = (-4 +- sqrt(16 - 4)) / 2',
            'Ringkaskan: x = (-4 +- sqrt(12)) / 2',
          ],
          explanation: 'Rumus kuadratik memerlukan nilai a, b, dan c dimasukkan dengan tanda yang betul.',
        },
        {
          type: 'numeric',
          text: 'Cari diskriminan bagi 3x^2 - 2x + 5 = 0.',
          correct: { value: -56, tolerance: 0, unit: '' },
          explanation: 'b^2 - 4ac = (-2)^2 - 4(3)(5) = 4 - 60 = -56.',
        },
      ],
    },
    {
      topic: 'Systems of Equations',
      subtopic: 'Simultaneous linear equations',
      difficulty: 'medium',
      title: 'Persamaan Linear Serentak',
      blocks: [
        section(
          'Konsep',
          'Persamaan linear serentak melibatkan dua atau lebih persamaan yang perlu dipenuhi pada masa yang sama. Untuk dua pemboleh ubah, penyelesaian ialah pasangan (x, y) yang benar bagi kedua-dua persamaan. Kaedah lazim ialah penggantian dan penghapusan. Pilih kaedah yang menjadikan pengiraan paling ringkas berdasarkan pekali yang ada.'
        ),
        section(
          'Contoh Penyelesaian',
          `Selesaikan 2x + y = 11 dan x - y = 1.
Daripada x - y = 1:
y = x - 1

Gantikan y = x - 1 ke dalam 2x + y = 11:
2x + (x - 1) = 11
3x - 1 = 11
3x = 12
x = 4

Cari y:
y = x - 1
y = 4 - 1
y = 3

Penyelesaian ialah x = 4, y = 3.`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan selesaikan satu persamaan sahaja dan terus menganggap jawapan lengkap. Dalam kaedah penghapusan, tanda operasi mesti digunakan pada semua sebutan. Selepas mendapat satu pemboleh ubah, gantikan semula ke dalam salah satu persamaan asal untuk mencari pemboleh ubah yang satu lagi.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Persamaan serentak | Persamaan yang diselesaikan bersama-sama |\n| Penggantian | Menggantikan satu pemboleh ubah dengan ungkapan setara |\n| Penghapusan | Menambah atau menolak persamaan untuk menghapuskan pemboleh ubah |\n| Penyelesaian | Nilai pemboleh ubah yang memenuhi semua persamaan |\n| Pekali | Nombor yang mendarab pemboleh ubah |'
        ),
        section(
          'Petua Ingatan',
          'Jika pekali satu pemboleh ubah sudah sama, guna penghapusan. Jika satu persamaan mudah dijadikan x = ... atau y = ..., guna penggantian.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Selesaikan x + y = 9 dan x - y = 3. Apakah nilai x?',
          correct: { value: 6, tolerance: 0, unit: '' },
          explanation: 'Tambah kedua-dua persamaan: 2x = 12, maka x = 6.',
        },
        {
          type: 'numeric',
          text: 'Selesaikan 2x + y = 13 dan x + y = 8. Apakah nilai y?',
          correct: { value: 3, tolerance: 0, unit: '' },
          explanation: 'Tolak persamaan kedua daripada pertama: x = 5. Gantikan dalam x + y = 8, jadi y = 3.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyelesaikan 3x + 2y = 16 dan x + 2y = 8 dengan penghapusan.',
          options: [
            'Tolak persamaan kedua daripada persamaan pertama',
            'Dapatkan 2x = 8',
            'Bahagi dengan 2 untuk mendapat x = 4',
            'Gantikan x = 4 ke dalam x + 2y = 8 untuk mendapat y = 2',
          ],
          correct: [
            'Tolak persamaan kedua daripada persamaan pertama',
            'Dapatkan 2x = 8',
            'Bahagi dengan 2 untuk mendapat x = 4',
            'Gantikan x = 4 ke dalam x + 2y = 8 untuk mendapat y = 2',
          ],
          explanation: 'Sebutan 2y sama dalam kedua-dua persamaan, jadi penghapusan terus menghapuskan y.',
        },
        {
          type: 'numeric',
          text: 'Selesaikan 4x - y = 7 dan x + y = 8. Cari nilai x + y.',
          correct: { value: 8, tolerance: 0, unit: '' },
          explanation: 'Persamaan kedua sudah menyatakan x + y = 8, dan penyelesaian serentak juga memenuhi nilai itu.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyelesaikan y = 2x + 1 dan x + y = 10 melalui penggantian.',
          options: [
            'Gantikan y = 2x + 1 ke dalam x + y = 10',
            'Tulis x + (2x + 1) = 10',
            'Ringkaskan kepada 3x + 1 = 10',
            'Selesaikan 3x = 9, maka x = 3 dan y = 7',
          ],
          correct: [
            'Gantikan y = 2x + 1 ke dalam x + y = 10',
            'Tulis x + (2x + 1) = 10',
            'Ringkaskan kepada 3x + 1 = 10',
            'Selesaikan 3x = 9, maka x = 3 dan y = 7',
          ],
          explanation: 'Kaedah penggantian sesuai kerana y sudah dinyatakan dalam sebutan x.',
        },
        {
          type: 'numeric',
          text: 'Selesaikan 3x + 2y = 19 dan x - y = 3. Apakah nilai y?',
          correct: { value: 2, tolerance: 0, unit: '' },
          explanation: 'Daripada x - y = 3, x = y + 3. Gantikan: 3(y + 3) + 2y = 19, jadi 5y + 9 = 19 dan y = 2.',
        },
      ],
    },
    {
      topic: 'Indices & Logarithms',
      subtopic: 'Laws of indices',
      difficulty: 'easy',
      title: 'Hukum Indeks',
      blocks: [
        section(
          'Konsep',
          'Indeks menunjukkan berapa kali sesuatu asas didarab dengan dirinya sendiri. Bagi asas yang sama, pendaraban menambah indeks dan pembahagian menolak indeks. Kuasa kepada kuasa mendarabkan indeks. Indeks sifar menghasilkan 1 bagi asas bukan sifar, manakala indeks negatif mewakili songsangan.'
        ),
        section(
          'Contoh Penyelesaian',
          `Permudahkan 2^3 x 2^4:
2^3 x 2^4 = 2^(3 + 4)
= 2^7
= 128

Permudahkan x^5 / x^2:
x^5 / x^2 = x^(5 - 2)
= x^3

Permudahkan (a^2)^3:
(a^2)^3 = a^(2 x 3)
= a^6`
        ),
        section(
          'Kesilapan Lazim',
          'Hukum indeks hanya boleh digunakan terus apabila asas adalah sama. Jangan tambah indeks apabila menambah nombor, contohnya 2^3 + 2^4 bukan 2^7. Untuk indeks negatif, tukar kepada pecahan sebelum menilai jika perlu.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Asas | Nombor atau pemboleh ubah yang dikuasakan |\n| Indeks | Kuasa yang menunjukkan pengulangan darab |\n| Indeks sifar | a^0 = 1 untuk a bukan sifar |\n| Indeks negatif | a^-n = 1 / a^n |\n| Indeks pecahan | Menunjukkan punca, contohnya a^(1/2) = sqrt(a) |'
        ),
        section(
          'Petua Ingatan',
          'Darab asas sama: tambah kuasa. Bahagi asas sama: tolak kuasa. Kuasa kepada kuasa: darab kuasa.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Nilai 3^2 x 3^3 ialah berapa?',
          correct: { value: 243, tolerance: 0, unit: '' },
          explanation: '3^2 x 3^3 = 3^5 = 243.',
        },
        {
          type: 'numeric',
          text: 'Nilai 5^0 + 2^3 ialah berapa?',
          correct: { value: 9, tolerance: 0, unit: '' },
          explanation: '5^0 = 1 dan 2^3 = 8, maka jumlahnya 9.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menilai (2^4 x 2^3) / 2^2.',
          options: [
            'Tambah indeks di pengangka: 2^4 x 2^3 = 2^7',
            'Tolak indeks penyebut: 2^7 / 2^2 = 2^5',
            'Nilai 2^5',
            'Jawapan ialah 32',
          ],
          correct: [
            'Tambah indeks di pengangka: 2^4 x 2^3 = 2^7',
            'Tolak indeks penyebut: 2^7 / 2^2 = 2^5',
            'Nilai 2^5',
            'Jawapan ialah 32',
          ],
          explanation: 'Asas yang sama membolehkan indeks ditambah dan ditolak.',
        },
        {
          type: 'numeric',
          text: 'Nilai 8^(2/3) ialah berapa?',
          correct: { value: 4, tolerance: 0, unit: '' },
          explanation: '8^(2/3) = (punca kuasa tiga bagi 8)^2 = 2^2 = 4.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyelesaikan 2^(x + 1) = 16.',
          options: [
            'Tulis 16 sebagai 2^4',
            'Bandingkan indeks: x + 1 = 4',
            'Tolak 1 pada kedua-dua belah',
            'Dapatkan x = 3',
          ],
          correct: [
            'Tulis 16 sebagai 2^4',
            'Bandingkan indeks: x + 1 = 4',
            'Tolak 1 pada kedua-dua belah',
            'Dapatkan x = 3',
          ],
          explanation: 'Jika asas sama dan nilainya sama, indeksnya juga sama.',
        },
        {
          type: 'numeric',
          text: 'Tulis 10^-2 sebagai perpuluhan.',
          correct: { value: 0.01, tolerance: 0, unit: '' },
          explanation: '10^-2 = 1 / 10^2 = 1 / 100 = 0.01.',
        },
      ],
    },
    {
      topic: 'Indices & Logarithms',
      subtopic: 'Laws of logarithms',
      difficulty: 'medium',
      title: 'Hukum Logaritma',
      blocks: [
        section(
          'Konsep',
          'Logaritma ialah cara menulis hubungan indeks secara songsang. Jika a^y = x, maka log_a x = y, dengan a positif dan a tidak sama dengan 1. Hukum logaritma membolehkan hasil darab ditukar kepada tambah, hasil bahagi ditukar kepada tolak, dan kuasa dibawa ke hadapan sebagai pekali. Hukum ini sah apabila asas logaritma adalah sama.'
        ),
        section(
          'Contoh Penyelesaian',
          `Selesaikan log_2 x + log_2 4 = 5.
Gunakan hukum hasil darab:
log_2 x + log_2 4 = log_2(4x)

Maka:
log_2(4x) = 5
Tukar kepada bentuk indeks:
4x = 2^5
4x = 32
x = 32 / 4
x = 8`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan gabungkan logaritma yang berlainan asas tanpa menukar asas dahulu. log_a M + log_a N menjadi log_a(MN), bukan log_a(M + N). Pastikan nombor di dalam logaritma adalah positif kerana logaritma nombor sifar atau negatif tidak ditakrif dalam nombor nyata.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Logaritma | Indeks yang diperlukan untuk menghasilkan sesuatu nombor daripada asas tertentu |\n| Asas logaritma | Nombor a dalam log_a x |\n| Hukum hasil darab | log_a MN = log_a M + log_a N |\n| Hukum hasil bahagi | log_a(M/N) = log_a M - log_a N |\n| Hukum kuasa | log_a(M^n) = n log_a M |'
        ),
        section(
          'Petua Ingatan',
          'Log menjawab soalan "asas ini perlu dikuasakan kepada berapa?" Tukar antara log_a x = y dan a^y = x untuk menyelesaikan nilai.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Nilai log_2 32 ialah berapa?',
          correct: { value: 5, tolerance: 0, unit: '' },
          explanation: '2^5 = 32, maka log_2 32 = 5.',
        },
        {
          type: 'numeric',
          text: 'Nilai log_10 0.01 ialah berapa?',
          correct: { value: -2, tolerance: 0, unit: '' },
          explanation: '10^-2 = 0.01, maka log_10 0.01 = -2.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyelesaikan log_3 x + log_3 9 = 4.',
          options: [
            'Gabungkan logaritma: log_3(9x) = 4',
            'Tukar kepada bentuk indeks: 9x = 3^4',
            'Nilai 3^4 = 81',
            'Bahagi dengan 9 untuk mendapat x = 9',
          ],
          correct: [
            'Gabungkan logaritma: log_3(9x) = 4',
            'Tukar kepada bentuk indeks: 9x = 3^4',
            'Nilai 3^4 = 81',
            'Bahagi dengan 9 untuk mendapat x = 9',
          ],
          explanation: 'Hukum hasil darab membenarkan dua logaritma berasas sama digabungkan.',
        },
        {
          type: 'numeric',
          text: 'Nilai log_5 125 - log_5 5 ialah berapa?',
          correct: { value: 2, tolerance: 0, unit: '' },
          explanation: 'log_5 125 = 3 dan log_5 5 = 1, maka bezanya 2.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mengembangkan log_2(8x^2).',
          options: [
            'Pisahkan hasil darab: log_2 8 + log_2 x^2',
            'Nilai log_2 8 = 3',
            'Gunakan hukum kuasa: log_2 x^2 = 2 log_2 x',
            'Tulis jawapan: 3 + 2 log_2 x',
          ],
          correct: [
            'Pisahkan hasil darab: log_2 8 + log_2 x^2',
            'Nilai log_2 8 = 3',
            'Gunakan hukum kuasa: log_2 x^2 = 2 log_2 x',
            'Tulis jawapan: 3 + 2 log_2 x',
          ],
          explanation: 'Hukum hasil darab digunakan sebelum hukum kuasa.',
        },
        {
          type: 'numeric',
          text: 'Nilai log_2(1/8) ialah berapa?',
          correct: { value: -3, tolerance: 0, unit: '' },
          explanation: '2^-3 = 1/8, maka log_2(1/8) = -3.',
        },
      ],
    },
    {
      topic: 'Coordinate Geometry',
      subtopic: 'Distance, midpoint, gradient',
      difficulty: 'easy',
      title: 'Geometri Koordinat: Jarak, Titik Tengah dan Kecerunan',
      blocks: [
        section(
          'Konsep',
          'Dalam satah Cartes, kedudukan titik ditulis sebagai (x, y). Jarak antara dua titik menggunakan Teorem Pythagoras pada perubahan x dan perubahan y. Titik tengah ialah purata koordinat x dan purata koordinat y. Kecerunan mengukur kecondongan garis, iaitu perubahan y dibahagi perubahan x.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi A(2, 3) dan B(8, 11).
Jarak AB:
AB = sqrt((8 - 2)^2 + (11 - 3)^2)
AB = sqrt(6^2 + 8^2)
AB = sqrt(36 + 64)
AB = sqrt(100)
AB = 10

Titik tengah:
M = ((2 + 8) / 2, (3 + 11) / 2)
M = (10 / 2, 14 / 2)
M = (5, 7)

Kecerunan:
m = (11 - 3) / (8 - 2)
m = 8 / 6
m = 4 / 3`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan tertukar susunan x dan y dalam formula. Untuk jarak, beza koordinat dikuasakan dua, jadi jarak tidak negatif. Untuk kecerunan, gunakan susunan titik yang sama di pengangka dan penyebut, contohnya (y2 - y1)/(x2 - x1).'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Koordinat | Pasangan nombor (x, y) yang menunjukkan kedudukan titik |\n| Jarak | Panjang antara dua titik |\n| Titik tengah | Titik tepat di tengah-tengah dua titik |\n| Kecerunan | Nisbah perubahan y kepada perubahan x |\n| Satah Cartes | Satah dengan paksi-x dan paksi-y |'
        ),
        section(
          'Petua Ingatan',
          'Jarak: beza, kuasa dua, tambah, punca kuasa dua. Titik tengah: puratakan x dan puratakan y. Kecerunan: naik bahagi jalan.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Cari jarak antara (1, 2) dan (4, 6).',
          correct: { value: 5, tolerance: 0, unit: '' },
          explanation: 'Jarak = sqrt((4 - 1)^2 + (6 - 2)^2) = sqrt(9 + 16) = 5.',
        },
        {
          type: 'numeric',
          text: 'Cari kecerunan garis melalui (2, 5) dan (6, 13).',
          correct: { value: 2, tolerance: 0, unit: '' },
          explanation: 'm = (13 - 5)/(6 - 2) = 8/4 = 2.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari titik tengah bagi (-2, 4) dan (8, 10).',
          options: [
            'Tambah koordinat-x: -2 + 8 = 6',
            'Bahagi jumlah x dengan 2: 6 / 2 = 3',
            'Tambah koordinat-y: 4 + 10 = 14',
            'Bahagi jumlah y dengan 2 dan tulis titik tengah (3, 7)',
          ],
          correct: [
            'Tambah koordinat-x: -2 + 8 = 6',
            'Bahagi jumlah x dengan 2: 6 / 2 = 3',
            'Tambah koordinat-y: 4 + 10 = 14',
            'Bahagi jumlah y dengan 2 dan tulis titik tengah (3, 7)',
          ],
          explanation: 'Titik tengah ialah purata bagi koordinat x dan purata bagi koordinat y.',
        },
        {
          type: 'numeric',
          text: 'Cari koordinat-x titik tengah bagi (4, -1) dan (10, 5).',
          correct: { value: 7, tolerance: 0, unit: '' },
          explanation: 'Koordinat-x titik tengah = (4 + 10) / 2 = 7.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari kecerunan bagi (1, 7) dan (5, -1).',
          options: [
            'Kira perubahan y: -1 - 7 = -8',
            'Kira perubahan x: 5 - 1 = 4',
            'Bahagikan perubahan y dengan perubahan x: -8 / 4',
            'Dapatkan kecerunan m = -2',
          ],
          correct: [
            'Kira perubahan y: -1 - 7 = -8',
            'Kira perubahan x: 5 - 1 = 4',
            'Bahagikan perubahan y dengan perubahan x: -8 / 4',
            'Dapatkan kecerunan m = -2',
          ],
          explanation: 'Kecerunan ialah perubahan menegak dibahagi perubahan mengufuk.',
        },
        {
          type: 'numeric',
          text: 'Titik tengah bagi A(2, 5) dan B(8, y) ialah (5, 9). Cari y.',
          correct: { value: 13, tolerance: 0, unit: '' },
          explanation: '(5 + y) / 2 = 9, maka 5 + y = 18 dan y = 13.',
        },
      ],
    },
    {
      topic: 'Coordinate Geometry',
      subtopic: 'Equation of straight line',
      difficulty: 'medium',
      title: 'Persamaan Garis Lurus',
      blocks: [
        section(
          'Konsep',
          'Persamaan garis lurus lazimnya ditulis sebagai y = mx + c, dengan m ialah kecerunan dan c ialah pintasan-y. Jika diberi satu titik dan kecerunan, persamaan boleh dibina menggunakan y - y1 = m(x - x1). Jika diberi dua titik, cari kecerunan dahulu sebelum mencari c. Bentuk am seperti ax + by = c juga boleh disusun semula kepada y = mx + c.'
        ),
        section(
          'Contoh Penyelesaian',
          `Cari persamaan garis dengan kecerunan 2 yang melalui titik (3, 5).
Gunakan y - y1 = m(x - x1):
y - 5 = 2(x - 3)
y - 5 = 2x - 6
y = 2x - 6 + 5
y = 2x - 1

Semakan titik:
Apabila x = 3, y = 2(3) - 1
y = 6 - 1
y = 5`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan ambil c sebagai koordinat-y bagi mana-mana titik kecuali titik itu berada pada paksi-y. Apabila menyusun bentuk am, pastikan tanda berubah dengan betul semasa memindahkan sebutan. Jika dua titik diberi, cari kecerunan menggunakan kedua-duanya sebelum mencari pintasan-y.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Garis lurus | Graf bagi persamaan linear dua pemboleh ubah |\n| Kecerunan | Nilai m dalam y = mx + c |\n| Pintasan-y | Nilai c, tempat garis memotong paksi-y |\n| Pintasan-x | Nilai x apabila y = 0 |\n| Bentuk kecerunan-pintasan | Persamaan y = mx + c |'
        ),
        section(
          'Petua Ingatan',
          'Untuk y = mx + c, m ialah nombor di depan x dan c ialah nombor tetap. Jika c belum diketahui, gantikan satu titik ke dalam persamaan untuk mencarinya.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Garis berkecerunan 3 melalui titik (2, 7). Cari pintasan-y, c.',
          correct: { value: 1, tolerance: 0, unit: '' },
          explanation: 'Gunakan y = mx + c: 7 = 3(2) + c, jadi c = 1.',
        },
        {
          type: 'numeric',
          text: 'Cari kecerunan bagi garis 4x + 2y = 10.',
          correct: { value: -2, tolerance: 0, unit: '' },
          explanation: '2y = -4x + 10, maka y = -2x + 5 dan kecerunan ialah -2.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari persamaan garis melalui (1, 4) dan (3, 10).',
          options: [
            'Cari kecerunan: m = (10 - 4) / (3 - 1) = 3',
            'Gantikan m = 3 ke dalam y = mx + c',
            'Guna titik (1, 4): 4 = 3(1) + c',
            'Dapatkan c = 1 dan persamaan y = 3x + 1',
          ],
          correct: [
            'Cari kecerunan: m = (10 - 4) / (3 - 1) = 3',
            'Gantikan m = 3 ke dalam y = mx + c',
            'Guna titik (1, 4): 4 = 3(1) + c',
            'Dapatkan c = 1 dan persamaan y = 3x + 1',
          ],
          explanation: 'Dua titik menentukan kecerunan, kemudian satu titik digunakan untuk mencari c.',
        },
        {
          type: 'numeric',
          text: 'Cari pintasan-x bagi y = 2x - 8.',
          correct: { value: 4, tolerance: 0, unit: '' },
          explanation: 'Pada pintasan-x, y = 0. Maka 0 = 2x - 8, 2x = 8 dan x = 4.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyusun 3x - y = 5 kepada bentuk y = mx + c.',
          options: [
            'Mulakan dengan 3x - y = 5',
            'Tolak 3x pada kedua-dua belah: -y = 5 - 3x',
            'Darab semua sebutan dengan -1: y = -5 + 3x',
            'Tulis semula sebagai y = 3x - 5',
          ],
          correct: [
            'Mulakan dengan 3x - y = 5',
            'Tolak 3x pada kedua-dua belah: -y = 5 - 3x',
            'Darab semua sebutan dengan -1: y = -5 + 3x',
            'Tulis semula sebagai y = 3x - 5',
          ],
          explanation: 'Matlamatnya ialah menjadikan y sebagai perkara rumus dengan pekali positif 1.',
        },
        {
          type: 'numeric',
          text: 'Bagi garis y = -x + 6, cari nilai y apabila x = -2.',
          correct: { value: 8, tolerance: 0, unit: '' },
          explanation: 'y = -(-2) + 6 = 2 + 6 = 8.',
        },
      ],
    },
    {
      topic: 'Statistics',
      subtopic: 'Measures of central tendency & dispersion',
      difficulty: 'hard',
      title: 'Statistik: Sukatan Kecenderungan Memusat dan Serakan',
      blocks: [
        section(
          'Konsep',
          'Sukatan kecenderungan memusat menerangkan pusat data, seperti min, median, dan mod. Sukatan serakan menerangkan sejauh mana data tersebar, seperti julat, julat antara kuartil, varians, dan sisihan piawai. Min sesuai untuk data tanpa nilai ekstrem yang kuat, manakala median lebih stabil apabila ada nilai terpencil. Serakan yang lebih besar menunjukkan data lebih berubah-ubah.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi data 2, 4, 4, 6, 9.
Min:
Jumlah = 2 + 4 + 4 + 6 + 9 = 25
Bilangan data = 5
Min = 25 / 5 = 5

Median:
Data sudah tersusun: 2, 4, 4, 6, 9
Nilai tengah ialah data ke-3
Median = 4

Mod:
4 muncul dua kali, paling kerap
Mod = 4

Varians populasi:
Sisihan daripada min: -3, -1, -1, 1, 4
Kuasa dua sisihan: 9, 1, 1, 1, 16
Jumlah kuasa dua sisihan = 28
Varians = 28 / 5 = 5.6
Sisihan piawai = sqrt(5.6) = 2.37`
        ),
        section(
          'Kesilapan Lazim',
          'Median memerlukan data disusun dahulu. Julat hanya menggunakan nilai maksimum dan minimum, jadi ia sangat dipengaruhi nilai ekstrem. Untuk varians populasi, bahagi jumlah kuasa dua sisihan dengan bilangan data; jangan campurkan dengan formula sampel jika soalan tidak memintanya.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Min | Jumlah data dibahagi bilangan data |\n| Median | Nilai tengah selepas data disusun |\n| Mod | Nilai yang paling kerap berlaku |\n| Julat | Nilai maksimum tolak nilai minimum |\n| Sisihan piawai | Akar kuasa dua varians yang mengukur serakan data |'
        ),
        section(
          'Petua Ingatan',
          'Pusat data: min, median, mod. Serakan data: julat, varians, sisihan piawai. Untuk sisihan piawai, ikut urutan min, sisihan, kuasa dua, purata, punca.'
        ),
      ],
      questions: [
        {
          type: 'numeric',
          text: 'Cari min bagi data 6, 8, 10, 12.',
          correct: { value: 9, tolerance: 0, unit: '' },
          explanation: 'Min = (6 + 8 + 10 + 12) / 4 = 36 / 4 = 9.',
        },
        {
          type: 'numeric',
          text: 'Cari julat bagi data 3, 7, 7, 14, 20.',
          correct: { value: 17, tolerance: 0, unit: '' },
          explanation: 'Julat = nilai maksimum - nilai minimum = 20 - 3 = 17.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari julat antara kuartil bagi data 2, 5, 7, 9, 10, 12, 15.',
          options: [
            'Pastikan data tersusun menaik',
            'Kenal pasti median keseluruhan, iaitu 9',
            'Cari Q1 daripada separuh bawah 2, 5, 7, iaitu 5',
            'Cari Q3 daripada separuh atas 10, 12, 15, iaitu 12, lalu IQR = 12 - 5 = 7',
          ],
          correct: [
            'Pastikan data tersusun menaik',
            'Kenal pasti median keseluruhan, iaitu 9',
            'Cari Q1 daripada separuh bawah 2, 5, 7, iaitu 5',
            'Cari Q3 daripada separuh atas 10, 12, 15, iaitu 12, lalu IQR = 12 - 5 = 7',
          ],
          explanation: 'Julat antara kuartil ialah Q3 - Q1 selepas data dibahagi kepada separuh bawah dan separuh atas.',
        },
        {
          type: 'numeric',
          text: 'Cari varians populasi bagi data 2, 4, 6.',
          correct: { value: 2.6667, tolerance: 0.01, unit: '' },
          explanation: 'Min = 4. Kuasa dua sisihan ialah 4, 0, 4. Varians = (4 + 0 + 4) / 3 = 2.6667.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari min daripada jadual nilai 1, 2, 3 dengan frekuensi 2, 3, 1.',
          options: [
            'Darab nilai dengan frekuensi: 1(2), 2(3), 3(1)',
            'Jumlahkan hasil darab: 2 + 6 + 3 = 11',
            'Jumlahkan frekuensi: 2 + 3 + 1 = 6',
            'Bahagi jumlah hasil darab dengan jumlah frekuensi: min = 11 / 6',
          ],
          correct: [
            'Darab nilai dengan frekuensi: 1(2), 2(3), 3(1)',
            'Jumlahkan hasil darab: 2 + 6 + 3 = 11',
            'Jumlahkan frekuensi: 2 + 3 + 1 = 6',
            'Bahagi jumlah hasil darab dengan jumlah frekuensi: min = 11 / 6',
          ],
          explanation: 'Bagi data berfrekuensi, min ialah jumlah fx dibahagi jumlah f.',
        },
        {
          type: 'numeric',
          text: 'Cari sisihan piawai populasi bagi data 1, 1, 5, 5.',
          correct: { value: 2, tolerance: 0, unit: '' },
          explanation: 'Min = 3. Kuasa dua sisihan ialah 4, 4, 4, 4. Varians = 16 / 4 = 4 dan sisihan piawai = sqrt(4) = 2.',
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.text,
        question.options || [],
        question.correct,
        question.explanation,
        question.points || 2,
        questionIndex + 1
      );
    }
  }
}

async function seedForm4AddMaths(client) {
  const subject = 'Matematik Tambahan';
  const formLevel = 4;
  const lessons = [
    {
      topic: 'Functions',
      subtopic: 'Relations & functions',
      title: 'Hubungan dan Fungsi',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Hubungan ialah padanan antara unsur dalam domain dengan unsur dalam kodomain. Fungsi ialah hubungan khas apabila setiap input dalam domain mempunyai tepat satu output. Beberapa input boleh berkongsi output yang sama, tetapi satu input tidak boleh mempunyai dua output berbeza. Julat ialah set output sebenar yang terhasil daripada fungsi.'
        ),
        section(
          'Contoh kerja',
          'Bagi A = {(1, 2), (2, 4), (3, 4)}, setiap input 1, 2 dan 3 muncul sekali sahaja, maka A ialah fungsi. Julatnya ialah {2, 4} kerana 4 berulang tetapi dikira sekali. Bagi B = {(1, 2), (1, 3), (2, 4)}, input 1 mempunyai dua output, maka B bukan fungsi.'
        ),
        section(
          'Salah faham biasa',
          'Output yang berulang tidak membatalkan fungsi; yang penting ialah setiap input tidak bercabang kepada dua output. Kodomain tidak semestinya sama dengan julat kerana ada unsur kodomain yang mungkin tidak digunakan. Notasi f(x) merujuk nilai output apabila input ialah x, bukan hasil darab f dengan x.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Domain | Set semua input yang dibenarkan. |\n| Kodomain | Set sasaran output yang mungkin. |\n| Julat | Set output sebenar yang terhasil. |\n| Fungsi | Hubungan dengan tepat satu output bagi setiap input. |'
        ),
        section(
          'Petua ingatan',
          'Ingat "satu input, satu output". Jika satu nilai x menghala kepada dua nilai y, hubungan itu gagal sebagai fungsi. Jika dua nilai x menghala kepada y yang sama, hubungan itu masih boleh menjadi fungsi.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Antara hubungan berikut, yang manakah ialah fungsi?',
          options: ['{(1, 2), (2, 2), (3, 5)}', '{(1, 2), (1, 3), (2, 4)}', '{(2, 1), (2, 5), (3, 5)}', '{(4, 0), (4, 1), (4, 2)}'],
          correct: { optionIndex: 0 },
          explanation: 'Setiap input 1, 2 dan 3 mempunyai tepat satu output.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika f(x) = 3x - 2, apakah nilai f(4)?',
          options: ['10', '12', '14', '-10'],
          correct: { optionIndex: 0 },
          explanation: 'f(4) = 3(4) - 2 = 10.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Jika dua input berkongsi output yang sama, hubungan itu bukan fungsi.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Dua input boleh berkongsi output yang sama; yang tidak dibenarkan ialah satu input mempunyai dua output.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Jika f(x) = 2x^2 - 3, hitung f(-2).',
          options: [],
          correct: { value: 5, tolerance: 0, unit: '' },
          explanation: 'f(-2) = 2(4) - 3 = 5.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menentukan sama ada {(1, 3), (2, 5), (2, 6)} ialah fungsi.',
          options: ['Senaraikan input yang terlibat.', 'Periksa sama ada ada input yang berulang.', 'Bandingkan output bagi input yang berulang.', 'Simpulkan bahawa hubungan itu bukan fungsi.'],
          correct: ['Senaraikan input yang terlibat.', 'Periksa sama ada ada input yang berulang.', 'Bandingkan output bagi input yang berulang.', 'Simpulkan bahawa hubungan itu bukan fungsi.'],
          explanation: 'Input 2 berulang dengan dua output berbeza, iaitu 5 dan 6.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata {(1, 4), (2, 4), (3, 4)} bukan fungsi kerana output 4 berulang. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menganggap output berulang membatalkan fungsi; fungsi hanya melarang satu input mempunyai lebih daripada satu output.',
          explanation: 'Hubungan itu ialah fungsi kerana setiap input mempunyai tepat satu output.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Sebuah mesin tiket memberikan satu harga bagi setiap jenis tiket: kanak-kanak, dewasa dan warga emas. Tafsirkan hubungan jenis tiket kepada harga dari segi fungsi.',
          options: [],
          correct: 'Hubungan jenis tiket kepada harga ialah fungsi jika setiap jenis tiket mempunyai tepat satu harga.',
          explanation: 'Setiap jenis tiket bertindak sebagai input dan harga ialah output tunggalnya.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Quadratic Equations',
      subtopic: 'Discriminant & nature of roots',
      title: 'Diskriminan dan Sifat Punca',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Bagi persamaan kuadratik ax^2 + bx + c = 0, diskriminan ialah D = b^2 - 4ac. Nilai D menentukan sifat punca tanpa perlu menyelesaikan persamaan sepenuhnya. Jika D > 0, terdapat dua punca nyata yang berbeza. Jika D = 0, terdapat dua punca nyata yang sama, dan jika D < 0, tiada punca nyata.'
        ),
        section(
          'Contoh kerja',
          'Untuk x^2 - 5x + 6 = 0, a = 1, b = -5 dan c = 6. Maka D = (-5)^2 - 4(1)(6) = 25 - 24 = 1. Oleh sebab D > 0, persamaan ini mempunyai dua punca nyata yang berbeza.'
        ),
        section(
          'Salah faham biasa',
          'Tanda negatif pada pekali b mesti diambil kira apabila mengira b^2. Diskriminan bukan punca persamaan, tetapi penentu sifat punca. Nilai D = 0 tidak bermaksud tiada punca; ia bermaksud punca berulang.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Diskriminan | Nilai b^2 - 4ac bagi persamaan kuadratik. |\n| Punca nyata | Nilai x yang boleh diplot pada garis nombor nyata. |\n| Punca sama | Dua punca yang mempunyai nilai yang sama. |\n| Punca berbeza | Dua punca yang mempunyai nilai berlainan. |'
        ),
        section(
          'Petua ingatan',
          'D positif bermaksud graf memotong paksi-x dua kali. D sifar bermaksud graf menyentuh paksi-x sekali. D negatif bermaksud graf tidak memotong paksi-x.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah diskriminan bagi 2x^2 - 3x + 5 = 0?',
          options: ['-31', '31', '49', '-49'],
          correct: { optionIndex: 0 },
          explanation: 'D = (-3)^2 - 4(2)(5) = 9 - 40 = -31.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika diskriminan suatu persamaan kuadratik ialah 0, apakah sifat puncanya?',
          options: ['Dua punca nyata yang sama', 'Dua punca nyata yang berbeza', 'Tiada punca nyata', 'Satu punca negatif sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'D = 0 menunjukkan graf menyentuh paksi-x, jadi puncanya nyata dan sama.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Jika D < 0, persamaan kuadratik mempunyai dua punca nyata.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'D < 0 bermaksud tiada punca nyata.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari nilai k supaya x^2 - 6x + k = 0 mempunyai punca nyata yang sama.',
          options: [],
          correct: { value: 9, tolerance: 0, unit: '' },
          explanation: 'Untuk punca sama, D = 0. Maka 36 - 4k = 0, jadi k = 9.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menentukan sifat punca bagi 3x^2 + 2x - 1 = 0.',
          options: ['Kenal pasti a = 3, b = 2 dan c = -1.', 'Gunakan D = b^2 - 4ac.', 'Kira D = 2^2 - 4(3)(-1).', 'Bandingkan tanda D dengan 0.', 'Nyatakan bahawa punca nyata dan berbeza.'],
          correct: ['Kenal pasti a = 3, b = 2 dan c = -1.', 'Gunakan D = b^2 - 4ac.', 'Kira D = 2^2 - 4(3)(-1).', 'Bandingkan tanda D dengan 0.', 'Nyatakan bahawa punca nyata dan berbeza.'],
          explanation: 'D = 16, maka D > 0 dan terdapat dua punca nyata berbeza.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Untuk 2x^2 - 3x + 5 = 0, seorang murid menggunakan b = 3 semasa mengira diskriminan. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah mengabaikan tanda negatif pada b; nilai b yang betul ialah -3.',
          explanation: 'Pekali b diambil bersama tandanya daripada bentuk ax^2 + bx + c.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Model ketinggian bola ialah h(t) = -t^2 + 4t - 4. Gunakan diskriminan untuk mentafsir bilangan masa bola berada di tanah.',
          options: [],
          correct: 'Diskriminan ialah 0, maka bola menyentuh tanah sekali pada satu masa sahaja.',
          explanation: 'Bagi -t^2 + 4t - 4 = 0, D = 16 - 16 = 0.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Quadratic Inequalities',
      subtopic: 'Solving & number line',
      title: 'Ketaksamaan Kuadratik dan Garis Nombor',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Ketaksamaan kuadratik melibatkan ungkapan kuadratik seperti ax^2 + bx + c > 0 atau ax^2 + bx + c <= 0. Langkah utama ialah mencari punca sempadan dengan menyamakan ungkapan kepada sifar. Punca membahagikan garis nombor kepada beberapa selang. Tanda ungkapan pada setiap selang menentukan jawapan ketaksamaan.'
        ),
        section(
          'Contoh kerja',
          'Selesaikan x^2 - 5x + 6 > 0. Faktorkan kepada (x - 2)(x - 3) > 0, jadi punca sempadan ialah 2 dan 3. Oleh sebab pekali x^2 positif, ungkapan bernilai positif di luar punca. Maka penyelesaian ialah x < 2 atau x > 3.'
        ),
        section(
          'Salah faham biasa',
          'Tanda > atau < tidak memasukkan punca, manakala >= atau <= memasukkan punca. Penyelesaian ketaksamaan kuadratik biasanya berbentuk selang, bukan hanya dua nombor. Jangan terus menukar arah ketaksamaan kecuali apabila mendarab atau membahagi dengan nombor negatif dalam operasi algebra tertentu.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Punca sempadan | Nilai x apabila ungkapan kuadratik sama dengan 0. |\n| Selang | Bahagian garis nombor antara punca sempadan. |\n| Titik tertutup | Punca dimasukkan dalam jawapan. |\n| Titik terbuka | Punca tidak dimasukkan dalam jawapan. |'
        ),
        section(
          'Petua ingatan',
          'Untuk kuadratik berbentuk senyum, tanda positif berada di luar punca dan tanda negatif berada di antara punca. Untuk kuadratik berbentuk sedih, coraknya terbalik.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah penyelesaian bagi x^2 - 4 < 0?',
          options: ['-2 < x < 2', 'x < -2 atau x > 2', 'x <= -2 atau x >= 2', 'x = -2 atau x = 2'],
          correct: { optionIndex: 0 },
          explanation: 'x^2 - 4 = (x - 2)(x + 2). Ungkapan negatif di antara -2 dan 2.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Apakah penyelesaian bagi (x - 1)(x + 3) >= 0?',
          options: ['x <= -3 atau x >= 1', '-3 <= x <= 1', 'x < -3 atau x > 1', '-1 <= x <= 3'],
          correct: { optionIndex: 0 },
          explanation: 'Pekali x^2 positif, maka ungkapan tidak negatif di luar punca dan punca dimasukkan.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Penyelesaian bagi x^2 - 9 > 0 ialah -3 < x < 3.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'x^2 - 9 > 0 benar di luar punca, iaitu x < -3 atau x > 3.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari integer terkecil yang memenuhi x^2 - 5x + 4 < 0.',
          options: [],
          correct: { value: 2, tolerance: 0, unit: '' },
          explanation: 'x^2 - 5x + 4 = (x - 1)(x - 4), jadi 1 < x < 4. Integer terkecil ialah 2.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menyelesaikan x^2 + x - 6 <= 0.',
          options: ['Faktorkan kepada (x + 3)(x - 2) <= 0.', 'Tentukan punca sempadan -3 dan 2.', 'Bahagikan garis nombor kepada selang.', 'Pilih selang yang memberikan nilai tidak positif.', 'Tulis jawapan -3 <= x <= 2.'],
          correct: ['Faktorkan kepada (x + 3)(x - 2) <= 0.', 'Tentukan punca sempadan -3 dan 2.', 'Bahagikan garis nombor kepada selang.', 'Pilih selang yang memberikan nilai tidak positif.', 'Tulis jawapan -3 <= x <= 2.'],
          explanation: 'Ungkapan bernilai negatif antara punca dan sifar pada punca.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid menyelesaikan x^2 - 5x + 6 > 0 dan menjawab 2 < x < 3. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah memilih selang antara punca; untuk > 0 dengan pekali x^2 positif, jawapannya ialah di luar punca.',
          explanation: 'Antara 2 dan 3, nilai (x - 2)(x - 3) adalah negatif.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Luas segi empat tepat diberi oleh x(10 - x). Cari julat x jika luasnya sekurang-kurangnya 21 unit persegi.',
          options: [],
          correct: 'Julatnya ialah 3 <= x <= 7.',
          explanation: 'x(10 - x) >= 21 memberi x^2 - 10x + 21 <= 0, iaitu (x - 3)(x - 7) <= 0.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Simultaneous Equations',
      subtopic: 'Linear-nonlinear systems',
      title: 'Persamaan Serentak Linear dan Tak Linear',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Sistem linear-tak linear menggabungkan satu persamaan garis lurus dengan satu persamaan bukan linear seperti kuadratik atau bulatan. Penyelesaian sistem ialah titik persilangan yang memenuhi kedua-dua persamaan serentak. Kaedah lazim ialah penggantian, iaitu menggantikan ungkapan daripada persamaan linear ke dalam persamaan tak linear. Hasilnya biasanya persamaan kuadratik yang boleh mempunyai dua, satu atau tiada penyelesaian nyata.'
        ),
        section(
          'Contoh kerja',
          'Selesaikan y = x + 2 dan y = x^2. Gantikan y = x + 2 ke dalam y = x^2 untuk mendapat x^2 = x + 2. Maka x^2 - x - 2 = 0, iaitu (x - 2)(x + 1) = 0. Nilai x ialah 2 atau -1, lalu titik penyelesaian ialah (2, 4) dan (-1, 1).'
        ),
        section(
          'Salah faham biasa',
          'Satu sistem tidak semestinya mempunyai dua titik persilangan; garis boleh menyentuh lengkung sekali atau tidak memotongnya langsung. Selepas mendapat nilai x, setiap nilai mesti digantikan semula untuk mencari nilai y yang sepadan. Jangan campur nilai x daripada satu penyelesaian dengan nilai y daripada penyelesaian lain.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Penggantian | Menggantikan satu pemboleh ubah dengan ungkapan setara. |\n| Titik persilangan | Pasangan tertib yang memenuhi kedua-dua persamaan. |\n| Sistem linear-tak linear | Sistem yang mengandungi garis dan lengkung. |\n| Penyelesaian serentak | Nilai yang benar untuk semua persamaan dalam sistem. |'
        ),
        section(
          'Petua ingatan',
          'Cari satu pemboleh ubah dahulu, kemudian pulangkan nilainya ke persamaan yang lebih mudah. Setiap x mesti mempunyai pasangan y sendiri.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah penyelesaian bagi y = x + 2 dan y = x^2?',
          options: ['(2, 4) dan (-1, 1)', '(2, 4) sahaja', '(-2, 0) dan (1, 3)', '(1, 1) dan (2, 4)'],
          correct: { optionIndex: 0 },
          explanation: 'x^2 = x + 2 memberi x = 2 atau x = -1, lalu y = 4 atau y = 1.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika y = 2x digantikan ke dalam x^2 + y^2 = 20, persamaan yang terhasil ialah',
          options: ['5x^2 = 20', '3x^2 = 20', 'x^2 + 2x = 20', 'x^2 - 2x = 20'],
          correct: { optionIndex: 0 },
          explanation: 'x^2 + (2x)^2 = x^2 + 4x^2 = 5x^2.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Sistem linear-tak linear sentiasa mempunyai tepat dua penyelesaian nyata.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Bilangan penyelesaian boleh menjadi dua, satu atau sifar.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Berapakah bilangan titik persilangan bagi y = x^2 + 1 dan y = 2x?',
          options: [],
          correct: { value: 1, tolerance: 0, unit: '' },
          explanation: 'x^2 + 1 = 2x memberi (x - 1)^2 = 0, jadi hanya satu titik persilangan.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menyelesaikan y = x + 2 dan y = x^2.',
          options: ['Gantikan x + 2 bagi y dalam y = x^2.', 'Susun kepada x^2 - x - 2 = 0.', 'Faktorkan kepada (x - 2)(x + 1) = 0.', 'Cari x = 2 atau x = -1.', 'Gantikan setiap x untuk mendapatkan y.'],
          correct: ['Gantikan x + 2 bagi y dalam y = x^2.', 'Susun kepada x^2 - x - 2 = 0.', 'Faktorkan kepada (x - 2)(x + 1) = 0.', 'Cari x = 2 atau x = -1.', 'Gantikan setiap x untuk mendapatkan y.'],
          explanation: 'Penggantian menukar sistem kepada satu persamaan kuadratik dalam x.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid mendapat x = 2 dan x = -1 tetapi hanya melaporkan y = 4. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tidak menggantikan setiap nilai x untuk mendapatkan pasangan y masing-masing.',
          explanation: 'Untuk x = -1, y = x + 2 = 1, jadi pasangan kedua ialah (-1, 1).',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Laluan drone dimodelkan oleh y = x + 2 dan sempadan zon isyarat oleh y = x^2. Nyatakan titik apabila drone menyentuh sempadan zon.',
          options: [],
          correct: 'Titik persilangan ialah (2, 4) dan (-1, 1).',
          explanation: 'Titik persilangan diperoleh dengan menyelesaikan x^2 = x + 2.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Indices & Logarithms',
      subtopic: 'Change of base & equations',
      title: 'Pertukaran Asas Logaritma dan Persamaan',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Logaritma ialah songsangan kepada indeks: jika a^x = b, maka log_a b = x. Rumus pertukaran asas ialah log_a b = log_c b / log_c a, dengan a > 0, a tidak sama dengan 1 dan b > 0. Persamaan indeks boleh diselesaikan dengan menyamakan asas atau menggunakan logaritma. Persamaan logaritma pula perlu mematuhi domain, iaitu ungkapan dalam log mesti positif.'
        ),
        section(
          'Contoh kerja',
          'Untuk menyelesaikan 2^x = 20, ambil log pada kedua-dua belah: x log 2 = log 20. Maka x = log 20 / log 2, kira-kira 4.32. Untuk log_2(x - 1) = 3, tukar kepada bentuk indeks: x - 1 = 2^3, jadi x = 9.'
        ),
        section(
          'Salah faham biasa',
          'log(a + b) tidak sama dengan log a + log b. Asas logaritma tidak boleh negatif, sifar atau 1. Selepas menyelesaikan persamaan logaritma, semak bahawa semua ungkapan dalam log adalah positif.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Indeks | Kuasa pada suatu asas. |\n| Logaritma | Kuasa yang diperlukan untuk menghasilkan suatu nombor. |\n| Pertukaran asas | Menukar log kepada asas yang mudah dikira. |\n| Domain log | Syarat bahawa argumen log mesti positif. |'
        ),
        section(
          'Petua ingatan',
          'Log menjawab soalan "asas ini perlu dinaikkan kepada kuasa berapa?" Untuk persamaan log, tukar balik kepada bentuk indeks sebelum menyelesaikan.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah nilai log_2 32?',
          options: ['5', '4', '16', '64'],
          correct: { optionIndex: 0 },
          explanation: '2^5 = 32, maka log_2 32 = 5.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Rumus pertukaran asas yang betul bagi log_3 7 ialah',
          options: ['log 7 / log 3', 'log 3 / log 7', 'log(7 - 3)', 'log 21'],
          correct: { optionIndex: 0 },
          explanation: 'log_3 7 = log_c 7 / log_c 3 untuk mana-mana asas c yang sah.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'log_5(a + b) = log_5 a + log_5 b untuk semua a dan b positif.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Hukum logaritma tidak membenarkan pemisahan hasil tambah seperti itu.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Selesaikan log_2 x = 4.',
          options: [],
          correct: { value: 16, tolerance: 0, unit: '' },
          explanation: 'log_2 x = 4 bermaksud x = 2^4 = 16.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menyelesaikan 3^(x + 1) = 81.',
          options: ['Tulis 81 sebagai 3^4.', 'Samakan eksponen: x + 1 = 4.', 'Tolak 1 pada kedua-dua belah.', 'Dapatkan x = 3.', 'Semak dengan menggantikan x ke persamaan asal.'],
          correct: ['Tulis 81 sebagai 3^4.', 'Samakan eksponen: x + 1 = 4.', 'Tolak 1 pada kedua-dua belah.', 'Dapatkan x = 3.', 'Semak dengan menggantikan x ke persamaan asal.'],
          explanation: 'Asas yang sama membolehkan eksponen disamakan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid menyelesaikan log_2(x - 1) = 3 sebagai x - 1 = 6. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menganggap log sebagai pendaraban; bentuk indeks yang betul ialah x - 1 = 2^3.',
          explanation: 'Maka x - 1 = 8 dan x = 9.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Populasi bakteria diberi oleh P = 100(2)^(t/6). Berapa jam diperlukan untuk populasi menjadi 800?',
          options: [],
          correct: 'Masa yang diperlukan ialah 18 jam.',
          explanation: '800/100 = 8 = 2^3, maka t/6 = 3 dan t = 18.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Coordinate Geometry',
      subtopic: 'Locus & equations of circle',
      title: 'Lokus dan Persamaan Bulatan',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Lokus ialah set semua titik yang memenuhi syarat tertentu. Bulatan ialah lokus titik yang berjarak tetap daripada satu titik tetap. Persamaan piawai bulatan berpusat di (h, k) dengan jejari r ialah (x - h)^2 + (y - k)^2 = r^2. Bentuk am x^2 + y^2 + 2gx + 2fy + c = 0 mempunyai pusat (-g, -f) dan jejari sqrt(g^2 + f^2 - c).'
        ),
        section(
          'Contoh kerja',
          'Bulatan berpusat di (2, -3) dengan jejari 5 mempunyai persamaan (x - 2)^2 + (y + 3)^2 = 25. Apabila dikembangkan, persamaannya ialah x^2 + y^2 - 4x + 6y - 12 = 0. Kedua-dua bentuk mewakili bulatan yang sama.'
        ),
        section(
          'Salah faham biasa',
          'Tanda dalam bentuk piawai adalah songsang dengan koordinat pusat: (x - 2)^2 bermaksud h = 2, manakala (y + 3)^2 bermaksud k = -3. Dalam bentuk am, pastikan pekali x dan y dibahagi dua untuk mendapat g dan f. Jejari tidak boleh negatif.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Lokus | Set titik yang memenuhi syarat tertentu. |\n| Pusat bulatan | Titik tetap yang sama jarak daripada semua titik pada bulatan. |\n| Jejari | Jarak dari pusat ke sebarang titik pada bulatan. |\n| Bentuk piawai | (x - h)^2 + (y - k)^2 = r^2. |'
        ),
        section(
          'Petua ingatan',
          'Dalam kurungan, tanda koordinat pusat kelihatan terbalik. Jika nampak (x - h) dan (y - k), pusatnya terus (h, k).'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Persamaan bulatan berpusat di (3, -2) dengan jejari 4 ialah',
          options: ['(x - 3)^2 + (y + 2)^2 = 16', '(x + 3)^2 + (y - 2)^2 = 16', '(x - 3)^2 + (y + 2)^2 = 4', '(x + 3)^2 + (y + 2)^2 = 16'],
          correct: { optionIndex: 0 },
          explanation: 'Gunakan (x - h)^2 + (y - k)^2 = r^2 dengan h = 3, k = -2 dan r = 4.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Pusat bulatan x^2 + y^2 - 6x + 4y - 12 = 0 ialah',
          options: ['(3, -2)', '(-3, 2)', '(6, -4)', '(-6, 4)'],
          correct: { optionIndex: 0 },
          explanation: '2g = -6 dan 2f = 4, jadi g = -3, f = 2, pusat = (-g, -f) = (3, -2).',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Lokus titik yang berjarak tetap daripada satu titik tetap ialah garis lurus.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Lokus itu ialah bulatan.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari jejari bulatan x^2 + y^2 - 4x + 6y - 12 = 0.',
          options: [],
          correct: { value: 5, tolerance: 0, unit: 'unit' },
          explanation: 'g = -2, f = 3 dan c = -12. Jejari = sqrt(4 + 9 + 12) = 5.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menukar x^2 + y^2 - 4x + 6y - 12 = 0 kepada bentuk piawai.',
          options: ['Kumpulkan sebutan x dan y.', 'Pindahkan pemalar ke sebelah kanan.', 'Lengkapkan kuasa dua bagi x dan y.', 'Tulis (x - 2)^2 + (y + 3)^2 = 25.', 'Nyatakan pusat (2, -3) dan jejari 5.'],
          correct: ['Kumpulkan sebutan x dan y.', 'Pindahkan pemalar ke sebelah kanan.', 'Lengkapkan kuasa dua bagi x dan y.', 'Tulis (x - 2)^2 + (y + 3)^2 = 25.', 'Nyatakan pusat (2, -3) dan jejari 5.'],
          explanation: 'Melengkapkan kuasa dua menghasilkan bentuk pusat-jejari.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata pusat bagi (x - 2)^2 + (y + 3)^2 = 25 ialah (2, 3). Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah membaca tanda y secara terus; (y + 3)^2 bermaksud koordinat y pusat ialah -3.',
          explanation: 'Pusat yang betul ialah (2, -3).',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Sebuah menara pemancar berada di (2, -3) dengan liputan jejari 5 km. Adakah rumah di (6, 0) berada pada sempadan liputan?',
          options: [],
          correct: 'Ya, rumah itu pada sempadan liputan kerana jaraknya daripada menara ialah 5 km.',
          explanation: 'Jarak = sqrt((6 - 2)^2 + (0 + 3)^2) = sqrt(16 + 9) = 5.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Statistics',
      subtopic: 'Permutations & combinations',
      title: 'Pilih Atur dan Gabungan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Pilih atur digunakan apabila susunan objek penting, manakala gabungan digunakan apabila susunan tidak penting. Bilangan pilih atur r objek daripada n objek ialah nPr = n! / (n - r)!. Bilangan gabungan r objek daripada n objek ialah nCr = n! / (r!(n - r)!). Prinsip pendaraban membantu mengira pilihan berturutan yang bebas.'
        ),
        section(
          'Contoh kerja',
          'Jika 3 murid dipilih daripada 5 murid untuk duduk dalam satu barisan, susunan penting, maka bilangannya ialah 5P3 = 5 x 4 x 3 = 60. Jika 3 murid dipilih daripada 5 murid untuk membentuk jawatankuasa tanpa jawatan khusus, susunan tidak penting, maka bilangannya ialah 5C3 = 10.'
        ),
        section(
          'Salah faham biasa',
          'Jangan gunakan pilih atur hanya kerana ada banyak objek; tanya dahulu sama ada urutan atau jawatan berbeza memberi hasil berbeza. Dalam gabungan, kumpulan A, B, C sama dengan C, B, A. Nilai nPr biasanya lebih besar daripada nCr kerana setiap gabungan boleh disusun beberapa cara.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Faktorial | n! = n x (n - 1) x ... x 1. |\n| Pilih atur | Susunan objek apabila urutan penting. |\n| Gabungan | Pemilihan objek apabila urutan tidak penting. |\n| Prinsip pendaraban | Jumlah cara bagi pilihan berturutan didarabkan. |'
        ),
        section(
          'Petua ingatan',
          'Perkataan "atur" dalam pilih atur mengingatkan bahawa susunan penting. Perkataan "gabung" mengingatkan bahawa ahli hanya dikumpulkan, bukan disusun.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah nilai 5P2?',
          options: ['20', '10', '25', '5'],
          correct: { optionIndex: 0 },
          explanation: '5P2 = 5 x 4 = 20.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Memilih 4 pengawas daripada 10 calon tanpa jawatan khusus menggunakan konsep',
          options: ['Gabungan', 'Pilih atur', 'Diskriminan', 'Logaritma'],
          correct: { optionIndex: 0 },
          explanation: 'Susunan tidak penting kerana semua yang dipilih memegang peranan yang sama.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'nCr sentiasa sama dengan nPr.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'nPr mengambil kira susunan, manakala nCr tidak.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari nilai 6C2.',
          options: [],
          correct: { value: 15, tolerance: 0, unit: '' },
          explanation: '6C2 = 6! / (2!4!) = 15.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mengira 7P3.',
          options: ['Tulis rumus nPr = n! / (n - r)!.', 'Gantikan n = 7 dan r = 3.', 'Ringkaskan kepada 7! / 4!.', 'Batalkan faktor sepunya.', 'Darab 7 x 6 x 5 = 210.'],
          correct: ['Tulis rumus nPr = n! / (n - r)!.', 'Gantikan n = 7 dan r = 3.', 'Ringkaskan kepada 7! / 4!.', 'Batalkan faktor sepunya.', 'Darab 7 x 6 x 5 = 210.'],
          explanation: 'Hanya tiga faktor pertama daripada 7! diperlukan selepas 4! dibatalkan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Untuk memilih 3 ahli jawatankuasa daripada 8 murid, seorang murid menggunakan 8P3 = 336. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menggunakan pilih atur walaupun susunan ahli jawatankuasa tidak penting; sepatutnya guna 8C3 = 56.',
          explanation: 'Jika tiada jawatan khusus, kumpulan yang sama tidak perlu dikira berulang kali.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Sebuah kedai aiskrim membenarkan pelanggan memilih 2 topping daripada 6 topping tanpa mengambil kira susunan. Berapa pilihan topping yang berbeza?',
          options: [],
          correct: 'Terdapat 15 pilihan topping yang berbeza.',
          explanation: 'Gunakan 6C2 = 15 kerana susunan topping tidak penting.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Statistics',
      subtopic: 'Probability theory',
      title: 'Teori Kebarangkalian',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Kebarangkalian mengukur kemungkinan sesuatu peristiwa berlaku. Untuk hasil yang sama mungkin, P(A) = n(A) / n(S), iaitu bilangan hasil memihak dibahagi bilangan semua hasil. Peristiwa pelengkap A\' mempunyai kebarangkalian 1 - P(A). Untuk dua peristiwa, P(A union B) = P(A) + P(B) - P(A intersection B).'
        ),
        section(
          'Contoh kerja',
          'Apabila satu dadu adil dibaling, peristiwa nombor genap ialah {2, 4, 6} dan peristiwa nombor lebih daripada 4 ialah {5, 6}. Gabungan dua peristiwa itu ialah {2, 4, 5, 6}. Maka kebarangkalian mendapat nombor genap atau lebih daripada 4 ialah 4/6 = 2/3.'
        ),
        section(
          'Salah faham biasa',
          'Peristiwa saling eksklusif tidak boleh berlaku serentak, tetapi peristiwa bebas boleh berlaku serentak. Jangan tambah P(A) dan P(B) tanpa menolak pertindihan jika peristiwa boleh bertindih. Kebarangkalian mesti berada antara 0 dan 1.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Ruang sampel | Set semua hasil yang mungkin. |\n| Peristiwa | Set hasil yang memenuhi syarat tertentu. |\n| Pelengkap | Peristiwa bahawa A tidak berlaku. |\n| Bebas | Berlaku satu peristiwa tidak mengubah kebarangkalian peristiwa lain. |'
        ),
        section(
          'Petua ingatan',
          'Kebarangkalian ialah bahagian daripada keseluruhan. Untuk "atau", berhati-hati dengan pertindihan; untuk "dan" bagi peristiwa bebas, darabkan kebarangkalian.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah kebarangkalian mendapat nombor perdana apabila satu dadu adil dibaling?',
          options: ['1/2', '1/3', '2/3', '1/6'],
          correct: { optionIndex: 0 },
          explanation: 'Nombor perdana pada dadu ialah 2, 3 dan 5, jadi kebarangkalian = 3/6 = 1/2.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika P(A) = 0.7, apakah P(A\')?',
          options: ['0.3', '0.7', '1.7', '-0.3'],
          correct: { optionIndex: 0 },
          explanation: 'P(A\') = 1 - P(A) = 0.3.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Peristiwa saling eksklusif boleh berlaku serentak.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Saling eksklusif bermaksud peristiwa tidak boleh berlaku pada masa yang sama.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Sebuah beg mengandungi 5 bola merah dan 3 bola biru. Cari kebarangkalian memilih bola merah.',
          options: [],
          correct: { value: 0.625, tolerance: 0.001, unit: '' },
          explanation: 'Jumlah bola = 8, maka P(merah) = 5/8 = 0.625.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mencari P(A union B) apabila P(A), P(B) dan P(A intersection B) diketahui.',
          options: ['Kenal pasti P(A).', 'Kenal pasti P(B).', 'Kenal pasti P(A intersection B).', 'Gantikan dalam P(A union B) = P(A) + P(B) - P(A intersection B).', 'Ringkaskan jawapan.'],
          correct: ['Kenal pasti P(A).', 'Kenal pasti P(B).', 'Kenal pasti P(A intersection B).', 'Gantikan dalam P(A union B) = P(A) + P(B) - P(A intersection B).', 'Ringkaskan jawapan.'],
          explanation: 'Pertindihan mesti ditolak supaya tidak dikira dua kali.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid mengira P(A union B) sebagai P(A) + P(B) walaupun A dan B boleh berlaku serentak. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tidak menolak P(A intersection B), menyebabkan hasil bertindih dikira dua kali.',
          explanation: 'Formula penuh ialah P(A union B) = P(A) + P(B) - P(A intersection B).',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Dalam pemeriksaan kualiti, 2% item dijangka rosak. Daripada 1000 item, berapa item rosak yang dijangka?',
          options: [],
          correct: 'Jangkaan item rosak ialah 20 item.',
          explanation: '0.02 x 1000 = 20.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Differentiation',
      subtopic: 'Gradient function & rules',
      title: 'Fungsi Kecerunan dan Petua Pembezaan',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Pembezaan menghasilkan fungsi kecerunan atau kadar perubahan seketika. Jika y = ax^n, maka dy/dx = anx^(n - 1) untuk nilai n yang sesuai dalam silibus. Terbitan pemalar ialah 0, dan terbitan hasil tambah atau beza boleh dibuat sebutan demi sebutan. Nilai dy/dx pada x tertentu memberi kecerunan tangen pada titik itu.'
        ),
        section(
          'Contoh kerja',
          'Jika y = 3x^4 - 5x^2 + 7, maka dy/dx = 12x^3 - 10x. Pada x = 2, kecerunan ialah 12(2^3) - 10(2) = 96 - 20 = 76. Ini bermaksud tangen kepada graf pada x = 2 mempunyai kecerunan 76.'
        ),
        section(
          'Salah faham biasa',
          'Jangan lupa mendarab pekali dengan kuasa asal sebelum mengurangkan kuasa. Terbitan pemalar bukan pemalar itu sendiri, tetapi 0. Jika mencari kecerunan pada titik tertentu, bezakan dahulu sebelum menggantikan nilai x.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Terbitan | Fungsi yang memberi kadar perubahan. |\n| dy/dx | Notasi terbitan y terhadap x. |\n| Kecerunan tangen | Kecerunan garis tangen pada satu titik. |\n| Petua kuasa | d(ax^n)/dx = anx^(n - 1). |'
        ),
        section(
          'Petua ingatan',
          'Turunkan kuasa ke depan, kemudian kuasa turun satu tingkat. Pemalar hilang kerana graf mendatar mempunyai kecerunan sifar.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah terbitan bagi x^5?',
          options: ['5x^4', 'x^4', '5x^5', '4x^5'],
          correct: { optionIndex: 0 },
          explanation: 'Mengikut petua kuasa, d(x^5)/dx = 5x^4.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Kecerunan graf y = x^2 pada x = 3 ialah',
          options: ['6', '9', '3', '12'],
          correct: { optionIndex: 0 },
          explanation: 'dy/dx = 2x, jadi pada x = 3 kecerunan ialah 6.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Terbitan bagi pemalar 7 ialah 7.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Terbitan pemalar ialah 0.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Jika y = 3x^2 - 4x + 1, cari dy/dx pada x = 2.',
          options: [],
          correct: { value: 8, tolerance: 0, unit: '' },
          explanation: 'dy/dx = 6x - 4. Pada x = 2, nilainya 12 - 4 = 8.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah membezakan y = 2x^3 - 5x + 4.',
          options: ['Gunakan petua kuasa pada 2x^3.', 'Dapatkan terbitan 6x^2.', 'Bezakan -5x menjadi -5.', 'Bezakan pemalar 4 menjadi 0.', 'Gabungkan dy/dx = 6x^2 - 5.'],
          correct: ['Gunakan petua kuasa pada 2x^3.', 'Dapatkan terbitan 6x^2.', 'Bezakan -5x menjadi -5.', 'Bezakan pemalar 4 menjadi 0.', 'Gabungkan dy/dx = 6x^2 - 5.'],
          explanation: 'Setiap sebutan boleh dibezakan secara berasingan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid membezakan 4x^3 sebagai 4x^2. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tidak mendarab pekali dengan kuasa asal; terbitan yang betul ialah 12x^2.',
          explanation: 'Petua kuasa memberi 4 x 3 x x^2 = 12x^2.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Sesaran zarah diberi oleh s(t) = t^3 - 6t^2 + 9t. Cari halaju pada t = 2 saat dan tafsirkan tandanya.',
          options: [],
          correct: 'Halaju ialah -3 m/s; tanda negatif menunjukkan gerakan arah bertentangan paksi positif.',
          explanation: 'v(t) = ds/dt = 3t^2 - 12t + 9, maka v(2) = 12 - 24 + 9 = -3.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Integration',
      subtopic: 'Definite & indefinite integrals',
      title: 'Kamiran Tak Tentu dan Kamiran Tentu',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Pengamiran ialah proses songsang kepada pembezaan. Kamiran tak tentu memberi keluarga fungsi dan mesti mengandungi pemalar + C. Untuk n tidak sama dengan -1, kamiran ax^n terhadap x ialah ax^(n + 1) / (n + 1) + C. Kamiran tentu dari a ke b dikira sebagai F(b) - F(a) dan mewakili perubahan terkumpul atau luas bertanda.'
        ),
        section(
          'Contoh kerja',
          'Kamirkan 6x^2 - 4x terhadap x. Tambah 1 pada setiap kuasa dan bahagi dengan kuasa baharu: integral 6x^2 dx = 2x^3 dan integral -4x dx = -2x^2. Maka kamiran tak tentu ialah 2x^3 - 2x^2 + C. Untuk kamiran tentu integral dari 0 ke 2 bagi 3x^2 dx, jawapannya ialah [x^3]_0^2 = 8.'
        ),
        section(
          'Salah faham biasa',
          'Kamiran tak tentu memerlukan + C kerana banyak fungsi berbeza boleh mempunyai terbitan yang sama. Dalam kamiran tentu, + C tidak muncul dalam jawapan akhir kerana ia saling hapus apabila F(b) - F(a) dikira. Jangan lupa bahagi dengan kuasa baharu selepas menambah kuasa.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Kamiran tak tentu | Antiterbitan yang mengandungi + C. |\n| Kamiran tentu | Nilai terkumpul antara had bawah dan had atas. |\n| Antiterbitan | Fungsi asal sebelum dibezakan. |\n| Had pengamiran | Nilai bawah dan atas bagi kamiran tentu. |'
        ),
        section(
          'Petua ingatan',
          'Untuk mengamir kuasa, naikkan kuasa dahulu, kemudian bahagi dengan kuasa baharu. Tak tentu tambah C; tentu tekan had atas tolak had bawah.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah kamiran tak tentu bagi 4x^3 terhadap x?',
          options: ['x^4 + C', '12x^2 + C', '4x^4 + C', 'x^3 + C'],
          correct: { optionIndex: 0 },
          explanation: 'Tambah kuasa menjadi 4 dan bahagi 4: 4x^4/4 = x^4.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Apakah nilai integral dari 0 ke 1 bagi 2x dx?',
          options: ['1', '2', '0', '4'],
          correct: { optionIndex: 0 },
          explanation: 'Antiterbitan 2x ialah x^2, jadi [x^2]_0^1 = 1.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Kamiran tentu mesti ditambah + C dalam jawapan akhir.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: '+ C hanya diperlukan untuk kamiran tak tentu.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari nilai integral dari 1 ke 3 bagi 2x dx.',
          options: [],
          correct: { value: 8, tolerance: 0, unit: '' },
          explanation: 'Antiterbitan 2x ialah x^2. Maka [x^2]_1^3 = 9 - 1 = 8.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mengamir 6x^2 - 4x + 5 terhadap x.',
          options: ['Tambah 1 pada kuasa setiap sebutan x.', 'Bahagi setiap sebutan dengan kuasa baharu.', 'Dapatkan kamiran 6x^2 sebagai 2x^3.', 'Dapatkan kamiran -4x sebagai -2x^2 dan 5 sebagai 5x.', 'Tambah pemalar C.'],
          correct: ['Tambah 1 pada kuasa setiap sebutan x.', 'Bahagi setiap sebutan dengan kuasa baharu.', 'Dapatkan kamiran 6x^2 sebagai 2x^3.', 'Dapatkan kamiran -4x sebagai -2x^2 dan 5 sebagai 5x.', 'Tambah pemalar C.'],
          explanation: 'Jawapan penuh ialah 2x^3 - 2x^2 + 5x + C.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid mengamir 3x^2 sebagai 3x^3 + C. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tidak membahagi dengan kuasa baharu; kamiran yang betul ialah x^3 + C.',
          explanation: 'Tambah kuasa kepada 3, kemudian 3x^3/3 = x^3.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Kadar aliran air ke dalam tangki ialah r(t) = 4t liter/minit. Cari jumlah air yang masuk dari t = 0 hingga t = 5 minit.',
          options: [],
          correct: 'Jumlah air yang masuk ialah 50 liter.',
          explanation: 'Integral dari 0 ke 5 bagi 4t dt ialah [2t^2]_0^5 = 50.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.question,
        question.options,
        question.correct,
        question.explanation,
        question.points,
        questionIndex + 1
      );
    }
  }
}

async function seedForm4Science(client) {
  const subject = 'Sains';
  const formLevel = 4;
  const lessons = [
    {
      topic: 'Cell & Living Processes',
      subtopic: 'Cell structure overview',
      title: 'Struktur Sel: Gambaran Keseluruhan',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Sel ialah unit asas bagi semua organisma hidup. Sel haiwan dan sel tumbuhan mempunyai membran sel, sitoplasma, nukleus dan mitokondrion. Sel tumbuhan juga mempunyai dinding sel, kloroplas dan vakuol besar yang membantu sokongan, fotosintesis dan penyimpanan air sel.'
        ),
        section(
          'Contoh harian',
          'Bayangkan sel seperti sebuah kilang kecil. Nukleus bertindak seperti pusat kawalan, mitokondrion membekalkan tenaga, membran sel mengawal bahan yang masuk dan keluar, manakala sitoplasma menjadi kawasan berlakunya banyak tindak balas kimia.'
        ),
        section(
          'Awas salah faham',
          'Tidak semua sel mempunyai kloroplas. Sel haiwan tidak mempunyai dinding sel dan kloroplas, sebab itu sel haiwan biasanya lebih mudah berubah bentuk berbanding sel tumbuhan. Vakuol juga wujud dalam sesetengah sel haiwan, tetapi biasanya lebih kecil berbanding vakuol sel tumbuhan.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Sel | Unit asas struktur dan fungsi organisma hidup |\n| Nukleus | Mengawal aktiviti sel dan mengandungi bahan genetik |\n| Mitokondrion | Tapak respirasi sel untuk membebaskan tenaga |\n| Kloroplas | Mengandungi klorofil untuk fotosintesis dalam sel tumbuhan |\n| Membran sel | Mengawal pergerakan bahan masuk dan keluar sel |'
        ),
        section(
          'Cara ingat',
          'Ingat N-M-S-K: Nukleus mengawal, Mitokondrion menghasilkan tenaga, Sitoplasma tempat tindak balas, Kloroplas menangkap cahaya.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Organel manakah mengawal kebanyakan aktiviti sel?',
          options: ['Nukleus', 'Kloroplas', 'Dinding sel', 'Vakuol'],
          correct: { optionIndex: 0 },
          explanation: 'Nukleus mengandungi bahan genetik dan mengawal aktiviti sel.',
        },
        {
          type: 'multiple_choice',
          text: 'Antara struktur berikut, yang manakah biasanya terdapat dalam sel tumbuhan tetapi tiada dalam sel haiwan?',
          options: ['Membran sel', 'Mitokondrion', 'Kloroplas', 'Sitoplasma'],
          correct: { optionIndex: 2 },
          explanation: 'Kloroplas membolehkan sel tumbuhan menjalankan fotosintesis.',
        },
        {
          type: 'true_false',
          text: 'Sel haiwan mempunyai dinding sel yang tegar seperti sel tumbuhan.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Sel haiwan tidak mempunyai dinding sel.',
        },
        {
          type: 'diagram_label',
          text: 'Labelkan fungsi struktur sel berdasarkan rajah sel ringkas.',
          options: [
            { prompt: 'A: Nukleus', answer: 'Mengawal aktiviti sel' },
            { prompt: 'B: Membran sel', answer: 'Mengawal keluar masuk bahan' },
            { prompt: 'C: Mitokondrion', answer: 'Membebaskan tenaga melalui respirasi sel' },
          ],
          correct: {
            'A: Nukleus': 'Mengawal aktiviti sel',
            'B: Membran sel': 'Mengawal keluar masuk bahan',
            'C: Mitokondrion': 'Membebaskan tenaga melalui respirasi sel',
          },
          explanation: 'Setiap struktur sel mempunyai fungsi khusus yang menyokong proses hidup.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Satu sel daun didapati tidak dapat menghasilkan glukosa walaupun menerima cahaya. Organel manakah paling mungkin rosak?',
          options: [],
          correct: 'kloroplas',
          explanation: 'Kloroplas mengandungi klorofil yang memerangkap cahaya untuk fotosintesis.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Forces & Motion (applied)',
      subtopic: 'Newton in everyday life',
      title: 'Hukum Newton dalam Kehidupan Harian',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Hukum Newton menerangkan hubungan antara daya dan gerakan. Hukum pertama berkaitan inersia, iaitu objek kekal pegun atau bergerak seragam jika tiada daya paduan bertindak. Hukum kedua menyatakan pecutan bertambah apabila daya paduan bertambah dan berkurang apabila jisim bertambah. Hukum ketiga menyatakan setiap tindakan mempunyai tindak balas yang sama magnitud tetapi bertentangan arah.'
        ),
        section(
          'Contoh harian',
          'Apabila kereta berhenti secara mengejut, badan penumpang cenderung terus bergerak ke hadapan kerana inersia. Tali pinggang keledar mengenakan daya pada badan untuk memperlahankan gerakan tersebut dengan lebih selamat.'
        ),
        section(
          'Awas salah faham',
          'Jisim dan berat bukan perkara yang sama. Jisim ialah kuantiti jirim dalam objek dan unitnya kilogram, manakala berat ialah daya graviti ke atas objek dan unitnya newton. Daya tindakan dan tindak balas pula bertindak pada dua objek berbeza, bukan saling membatalkan pada objek yang sama.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Daya | Tolakan atau tarikan yang boleh mengubah gerakan objek |\n| Inersia | Kecenderungan objek mengekalkan keadaan gerakannya |\n| Jisim | Kuantiti jirim dalam objek |\n| Berat | Daya graviti yang bertindak ke atas objek |\n| Daya paduan | Jumlah daya bersih yang menentukan perubahan gerakan |'
        ),
        section(
          'Cara ingat',
          'Ingat 1-2-3 Newton: 1 kekal gerak, 2 daya ubah pecutan, 3 tindakan ada tindak balas.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Fenomena badan terdorong ke hadapan apabila bas berhenti mengejut paling berkait dengan konsep apa?',
          options: ['Inersia', 'Ketumpatan', 'Pembiasan', 'Penyejatan'],
          correct: { optionIndex: 0 },
          explanation: 'Inersia menyebabkan badan cenderung mengekalkan keadaan gerakan asalnya.',
        },
        {
          type: 'multiple_choice',
          text: 'Jika daya paduan ke atas troli ditambah tetapi jisim troli sama, apakah kesan terhadap pecutannya?',
          options: ['Pecutan bertambah', 'Pecutan menjadi sifar', 'Pecutan berkurang', 'Jisim bertambah'],
          correct: { optionIndex: 0 },
          explanation: 'Mengikut Hukum Newton kedua, pecutan berkadar terus dengan daya paduan apabila jisim tetap.',
        },
        {
          type: 'true_false',
          text: 'Berat ialah daya graviti yang bertindak ke atas sesuatu objek.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Berat ialah daya dan diukur dalam unit newton.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah menunjukkan penumpang di dalam kereta yang membrek. Padankan bahagian keselamatan dengan fungsinya.',
          options: [
            { prompt: 'A: Tali pinggang keledar', answer: 'Mengurangkan gerakan badan ke hadapan' },
            { prompt: 'B: Beg udara', answer: 'Memanjangkan masa hentaman' },
            { prompt: 'C: Tapak tayar', answer: 'Menambah geseran dengan jalan' },
          ],
          correct: {
            'A: Tali pinggang keledar': 'Mengurangkan gerakan badan ke hadapan',
            'B: Beg udara': 'Memanjangkan masa hentaman',
            'C: Tapak tayar': 'Menambah geseran dengan jalan',
          },
          explanation: 'Ciri keselamatan kenderaan mengawal kesan daya dan perubahan momentum semasa hentaman.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Dua troli ditolak dengan daya yang sama. Troli A kosong, troli B penuh buku. Troli manakah mempunyai pecutan lebih besar?',
          options: [],
          correct: 'Troli A',
          explanation: 'Troli A mempunyai jisim lebih kecil, jadi pecutannya lebih besar bagi daya yang sama.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Energy',
      subtopic: 'Renewable energy sources',
      title: 'Sumber Tenaga Boleh Baharu',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Tenaga boleh baharu ialah tenaga daripada sumber yang boleh diganti semula secara semula jadi dalam tempoh yang munasabah. Contohnya termasuk tenaga suria, angin, hidro, biojisim, geoterma dan ombak. Sumber ini membantu mengurangkan kebergantungan kepada bahan api fosil, tetapi setiap sumber masih mempunyai had lokasi, kos dan kesan alam sekitar.'
        ),
        section(
          'Contoh harian',
          'Panel suria menukarkan tenaga cahaya matahari kepada tenaga elektrik. Di kawasan berbukit dan mempunyai aliran air yang berterusan, tenaga hidro mikro boleh menjana elektrik berskala kecil untuk komuniti setempat.'
        ),
        section(
          'Awas salah faham',
          'Tenaga boleh baharu bukan bermaksud tiada kesan langsung terhadap alam sekitar. Empangan hidro boleh mengubah habitat sungai, manakala panel suria memerlukan bahan mentah dan ruang pemasangan. Pilihan sumber tenaga perlu mengambil kira keadaan setempat.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Tenaga boleh baharu | Tenaga daripada sumber yang boleh diganti semula secara semula jadi |\n| Tenaga suria | Tenaga daripada cahaya matahari |\n| Tenaga hidro | Tenaga daripada pergerakan air |\n| Biojisim | Bahan organik yang boleh digunakan sebagai sumber tenaga |\n| Bahan api fosil | Arang batu, petroleum dan gas asli yang terbentuk dalam masa sangat lama |'
        ),
        section(
          'Cara ingat',
          'Ingat S-A-H-B-G: Suria, Angin, Hidro, Biojisim, Geoterma sebagai contoh sumber boleh baharu.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Sumber manakah merupakan sumber tenaga boleh baharu?',
          options: ['Arang batu', 'Petroleum', 'Tenaga suria', 'Gas asli'],
          correct: { optionIndex: 2 },
          explanation: 'Tenaga suria diperoleh daripada cahaya matahari dan boleh diperbaharui secara semula jadi.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah perubahan tenaga utama dalam panel suria?',
          options: ['Tenaga kimia kepada haba', 'Tenaga cahaya kepada elektrik', 'Tenaga bunyi kepada cahaya', 'Tenaga nuklear kepada mekanikal'],
          correct: { optionIndex: 1 },
          explanation: 'Panel fotovolta menukarkan tenaga cahaya kepada tenaga elektrik.',
        },
        {
          type: 'true_false',
          text: 'Semua sumber tenaga boleh baharu sentiasa sesuai digunakan di semua tempat.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Kesesuaian sumber tenaga bergantung pada faktor seperti cuaca, bentuk muka bumi dan kos.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah menunjukkan sistem tenaga suria rumah. Padankan komponen dengan peranannya.',
          options: [
            { prompt: 'A: Panel suria', answer: 'Menukar cahaya kepada elektrik' },
            { prompt: 'B: Bateri', answer: 'Menyimpan tenaga elektrik' },
            { prompt: 'C: Inverter', answer: 'Menukar arus terus kepada arus ulang-alik' },
          ],
          correct: {
            'A: Panel suria': 'Menukar cahaya kepada elektrik',
            'B: Bateri': 'Menyimpan tenaga elektrik',
            'C: Inverter': 'Menukar arus terus kepada arus ulang-alik',
          },
          explanation: 'Sistem suria memerlukan komponen untuk menjana, menyimpan dan menyesuaikan elektrik kepada kegunaan rumah.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Sebuah sekolah di kawasan pedalaman mempunyai cahaya matahari kuat dan bekalan diesel mahal. Cadangkan sumber tenaga boleh baharu yang paling sesuai.',
          options: [],
          correct: 'tenaga suria',
          explanation: 'Tenaga suria sesuai apabila cahaya matahari banyak dan pemasangan boleh dibuat berhampiran tempat penggunaan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Biodiversity',
      subtopic: 'Classification of living things',
      title: 'Pengelasan Benda Hidup',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Pengelasan benda hidup membantu saintis menyusun organisma mengikut ciri sepunya. Aras pengelasan lazim bermula daripada kumpulan besar kepada kecil seperti alam, filum, kelas, order, famili, genus dan spesies. Nama saintifik menggunakan sistem binomial, iaitu genus diikuti spesies.'
        ),
        section(
          'Contoh harian',
          'Kucing domestik dikelaskan sebagai haiwan vertebrata kerana mempunyai tulang belakang. Dalam penamaan saintifik, nama seperti Panthera tigris menunjukkan Panthera sebagai genus dan tigris sebagai spesies.'
        ),
        section(
          'Awas salah faham',
          'Organisma yang kelihatan serupa tidak semestinya spesies yang sama. Pengelasan mengambil kira banyak ciri seperti struktur badan, cara pembiakan, pemakanan dan hubungan evolusi. Nama biasa juga boleh berbeza antara tempat, sebab itu nama saintifik lebih tepat.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Biodiversiti | Kepelbagaian organisma hidup dalam sesuatu kawasan |\n| Spesies | Kumpulan organisma yang boleh membiak sesama sendiri dan menghasilkan anak subur |\n| Vertebrata | Haiwan yang mempunyai tulang belakang |\n| Invertebrata | Haiwan yang tidak mempunyai tulang belakang |\n| Kekunci dikotomi | Alat pengelasan berdasarkan pilihan ciri berpasangan |'
        ),
        section(
          'Cara ingat',
          'Untuk aras pengelasan, ingat A-Fi-K-O-Fa-G-S: Alam, Filum, Kelas, Order, Famili, Genus, Spesies.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Aras pengelasan manakah paling khusus?',
          options: ['Alam', 'Kelas', 'Famili', 'Spesies'],
          correct: { optionIndex: 3 },
          explanation: 'Spesies ialah aras paling khusus dalam senarai pengelasan yang diberikan.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah ciri utama vertebrata?',
          options: ['Mempunyai klorofil', 'Mempunyai tulang belakang', 'Membiak melalui spora', 'Tidak memerlukan makanan'],
          correct: { optionIndex: 1 },
          explanation: 'Vertebrata ialah haiwan yang mempunyai tulang belakang.',
        },
        {
          type: 'true_false',
          text: 'Kekunci dikotomi menggunakan pilihan ciri berpasangan untuk mengenal pasti organisma.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Kekunci dikotomi memandu pengguna melalui dua pilihan ciri pada setiap langkah.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah menunjukkan kekunci dikotomi ringkas. Padankan pilihan ciri dengan kumpulan organisma.',
          options: [
            { prompt: 'A: Ada tulang belakang', answer: 'Vertebrata' },
            { prompt: 'B: Tiada tulang belakang', answer: 'Invertebrata' },
            { prompt: 'C: Menghasilkan bunga', answer: 'Tumbuhan berbunga' },
          ],
          correct: {
            'A: Ada tulang belakang': 'Vertebrata',
            'B: Tiada tulang belakang': 'Invertebrata',
            'C: Menghasilkan bunga': 'Tumbuhan berbunga',
          },
          explanation: 'Ciri yang jelas dan boleh diperhatikan membantu membezakan kumpulan organisma.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Seorang murid menemui haiwan kecil tanpa tulang belakang, berkaki enam dan berbadan bersegmen. Kumpulan umum manakah paling sesuai?',
          options: [],
          correct: 'serangga',
          explanation: 'Kaki enam dan badan bersegmen ialah ciri umum serangga.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Matter',
      subtopic: 'Chemical & physical changes',
      title: 'Perubahan Kimia dan Fizikal',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Perubahan fizikal tidak menghasilkan bahan baharu dan biasanya melibatkan perubahan keadaan, bentuk atau saiz. Perubahan kimia menghasilkan bahan baharu dengan sifat yang berbeza. Tanda perubahan kimia boleh termasuk perubahan warna kekal, pembebasan gas, pembentukan mendakan, perubahan suhu atau penghasilan cahaya.'
        ),
        section(
          'Contoh harian',
          'Ais yang mencair menjadi air ialah perubahan fizikal kerana bahan masih H2O. Paku yang berkarat pula ialah perubahan kimia kerana besi bertindak balas dengan oksigen dan air untuk membentuk karat.'
        ),
        section(
          'Awas salah faham',
          'Tidak semua perubahan warna ialah perubahan kimia. Contohnya, pewarna makanan yang bercampur dengan air hanya menyebarkan warna tanpa menghasilkan bahan baharu. Bukti paling penting ialah sama ada bahan baharu terbentuk.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Jirim | Sesuatu yang mempunyai jisim dan memenuhi ruang |\n| Perubahan fizikal | Perubahan tanpa pembentukan bahan baharu |\n| Perubahan kimia | Perubahan yang menghasilkan bahan baharu |\n| Mendakan | Pepejal tidak larut yang terbentuk dalam larutan |\n| Pembakaran | Tindak balas dengan oksigen yang membebaskan tenaga |'
        ),
        section(
          'Cara ingat',
          'Tanya soalan utama: adakah bahan baharu terbentuk? Jika ya, perubahan kimia. Jika tidak, biasanya perubahan fizikal.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Situasi manakah merupakan perubahan fizikal?',
          options: ['Kayu terbakar', 'Ais mencair', 'Besi berkarat', 'Telur dimasak'],
          correct: { optionIndex: 1 },
          explanation: 'Ais mencair hanya mengubah keadaan jirim daripada pepejal kepada cecair.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah petunjuk paling kuat bahawa perubahan kimia berlaku?',
          options: ['Bentuk objek berubah', 'Bahan baharu terbentuk', 'Objek dipotong kecil', 'Bahan dipindahkan tempat'],
          correct: { optionIndex: 1 },
          explanation: 'Perubahan kimia ditakrifkan oleh pembentukan bahan baharu.',
        },
        {
          type: 'true_false',
          text: 'Melarutkan gula dalam air sentiasa menghasilkan bahan baharu.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Gula masih boleh diperoleh semula melalui penyejatan air, jadi ini perubahan fizikal.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah menunjukkan tiga perubahan jirim. Padankan perubahan dengan jenisnya.',
          options: [
            { prompt: 'A: Lilin mencair', answer: 'Perubahan fizikal' },
            { prompt: 'B: Sumbu lilin terbakar', answer: 'Perubahan kimia' },
            { prompt: 'C: Garam larut dalam air', answer: 'Perubahan fizikal' },
          ],
          correct: {
            'A: Lilin mencair': 'Perubahan fizikal',
            'B: Sumbu lilin terbakar': 'Perubahan kimia',
            'C: Garam larut dalam air': 'Perubahan fizikal',
          },
          explanation: 'Pencairan dan pelarutan tidak semestinya membentuk bahan baharu, tetapi pembakaran menghasilkan bahan baharu.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Selepas beberapa hari di luar rumah, pagar besi menjadi perang kemerahan. Apakah jenis perubahan yang berlaku?',
          options: [],
          correct: 'perubahan kimia',
          explanation: 'Karat ialah bahan baharu yang terbentuk apabila besi bertindak balas dengan oksigen dan air.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Reproduction',
      subtopic: 'Asexual & sexual reproduction',
      title: 'Pembiakan Aseks dan Seks',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Pembiakan aseks melibatkan satu induk dan tidak melibatkan persenyawaan gamet. Anak yang terhasil biasanya seiras secara genetik dengan induk. Pembiakan seks melibatkan gamet jantan dan gamet betina, persenyawaan dan pembentukan zigot, lalu menghasilkan variasi genetik dalam anak.'
        ),
        section(
          'Contoh harian',
          'Bakteria boleh membiak melalui belahan dedua, yis melalui pertunasan, manakala tumbuhan seperti ubi kentang boleh membiak secara vegetatif. Manusia dan kebanyakan haiwan membiak secara seks melalui penghasilan sperma dan ovum.'
        ),
        section(
          'Awas salah faham',
          'Pembiakan aseks bukan sentiasa lebih baik kerana anak yang hampir seiras lebih mudah terjejas jika persekitaran berubah atau penyakit menyerang. Pembiakan seks mengambil masa lebih lama tetapi menghasilkan variasi yang membantu populasi menyesuaikan diri.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pembiakan aseks | Pembiakan yang melibatkan satu induk tanpa persenyawaan gamet |\n| Pembiakan seks | Pembiakan yang melibatkan percantuman gamet jantan dan betina |\n| Gamet | Sel pembiakan seperti sperma atau ovum |\n| Persenyawaan | Percantuman nukleus gamet jantan dan gamet betina |\n| Zigot | Sel pertama yang terbentuk selepas persenyawaan |'
        ),
        section(
          'Cara ingat',
          'Aseks: satu induk, anak seiras. Seks: dua gamet, anak bervariasi.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Ciri manakah paling tepat bagi pembiakan aseks?',
          options: ['Melibatkan dua gamet', 'Menghasilkan anak seiras secara genetik', 'Sentiasa berlaku dalam manusia', 'Memerlukan persenyawaan'],
          correct: { optionIndex: 1 },
          explanation: 'Pembiakan aseks biasanya menghasilkan anak yang seiras dengan induk.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah sel pembiakan jantan dalam manusia?',
          options: ['Ovum', 'Zigot', 'Sperma', 'Embrio'],
          correct: { optionIndex: 2 },
          explanation: 'Sperma ialah gamet jantan dalam manusia.',
        },
        {
          type: 'true_false',
          text: 'Pembiakan seks menghasilkan variasi genetik dalam anak.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Gabungan bahan genetik daripada dua gamet menghasilkan variasi.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah bunga menunjukkan bahagian pembiakan. Padankan label dengan fungsi.',
          options: [
            { prompt: 'A: Anter', answer: 'Menghasilkan debunga' },
            { prompt: 'B: Stigma', answer: 'Menerima debunga' },
            { prompt: 'C: Ovari', answer: 'Mengandungi ovul' },
          ],
          correct: {
            'A: Anter': 'Menghasilkan debunga',
            'B: Stigma': 'Menerima debunga',
            'C: Ovari': 'Mengandungi ovul',
          },
          explanation: 'Bahagian pembiakan bunga menyokong pendebungaan dan persenyawaan.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Pokok pisang baharu tumbuh daripada sulur induk dan mempunyai ciri hampir sama dengan induknya. Apakah jenis pembiakan ini?',
          options: [],
          correct: 'pembiakan aseks',
          explanation: 'Sulur ialah contoh pembiakan vegetatif, iaitu pembiakan aseks dalam tumbuhan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Technology',
      subtopic: 'Smart materials',
      title: 'Bahan Pintar',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Bahan pintar ialah bahan yang boleh berubah sifat apabila menerima rangsangan seperti suhu, cahaya, tekanan, medan elektrik atau kelembapan. Perubahan ini boleh berlaku pada warna, bentuk, kekonduksian atau keanjalan. Banyak bahan pintar direka supaya perubahan tersebut boleh berlaku secara terkawal dan berguna dalam teknologi moden.'
        ),
        section(
          'Contoh harian',
          'Kaca mata foto-kromik menjadi gelap apabila terkena cahaya ultraungu dan kembali cerah apabila kurang cahaya. Aloi ingatan bentuk seperti nikel-titanium boleh kembali kepada bentuk asal apabila dipanaskan, lalu digunakan dalam wayar ortodontik dan alat perubatan tertentu.'
        ),
        section(
          'Awas salah faham',
          'Bahan pintar bukan bahan yang mempunyai komputer kecil di dalamnya. Istilah pintar merujuk kepada kebolehan bahan bertindak balas terhadap rangsangan. Bahan biasa seperti plastik yang tidak berubah sifat secara khas apabila dirangsang tidak dianggap bahan pintar.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Bahan pintar | Bahan yang berubah sifat sebagai tindak balas kepada rangsangan |\n| Foto-kromik | Berubah warna apabila intensiti cahaya berubah |\n| Termo-kromik | Berubah warna apabila suhu berubah |\n| Piezoelektrik | Menghasilkan cas elektrik apabila dikenakan tekanan |\n| Aloi ingatan bentuk | Aloi yang boleh kembali kepada bentuk asal apabila dirangsang, biasanya oleh haba |'
        ),
        section(
          'Cara ingat',
          'Kenal bahan pintar melalui rangsangan dan tindak balas: cahaya ubah warna, suhu ubah warna atau bentuk, tekanan hasilkan cas.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud bahan pintar?',
          options: ['Bahan yang sentiasa mahal', 'Bahan yang berubah sifat apabila menerima rangsangan', 'Bahan yang hanya dibuat daripada logam', 'Bahan yang tidak boleh dikitar semula'],
          correct: { optionIndex: 1 },
          explanation: 'Bahan pintar memberi tindak balas terhadap rangsangan tertentu.',
        },
        {
          type: 'multiple_choice',
          text: 'Kanta kaca mata yang menjadi gelap di bawah cahaya matahari ialah contoh bahan apa?',
          options: ['Termo-kromik', 'Foto-kromik', 'Radioaktif', 'Berkonduktor super'],
          correct: { optionIndex: 1 },
          explanation: 'Bahan foto-kromik berubah warna atau kegelapan apabila terkena cahaya.',
        },
        {
          type: 'true_false',
          text: 'Bahan piezoelektrik boleh menghasilkan cas elektrik apabila dikenakan tekanan mekanikal.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Kesan piezoelektrik menukarkan tekanan mekanikal kepada isyarat elektrik.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah menunjukkan contoh bahan pintar. Padankan bahan dengan rangsangannya.',
          options: [
            { prompt: 'A: Kaca foto-kromik', answer: 'Cahaya ultraungu' },
            { prompt: 'B: Pelekat termo-kromik', answer: 'Suhu' },
            { prompt: 'C: Sensor piezoelektrik', answer: 'Tekanan' },
          ],
          correct: {
            'A: Kaca foto-kromik': 'Cahaya ultraungu',
            'B: Pelekat termo-kromik': 'Suhu',
            'C: Sensor piezoelektrik': 'Tekanan',
          },
          explanation: 'Setiap bahan pintar direka untuk bertindak balas terhadap rangsangan tertentu.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Seorang doktor gigi mahu wayar pendakap yang boleh kembali kepada bentuk asal secara perlahan pada suhu mulut. Bahan pintar manakah sesuai?',
          options: [],
          correct: 'aloi ingatan bentuk',
          explanation: 'Aloi ingatan bentuk seperti nikel-titanium boleh kembali kepada bentuk asal apabila berada pada suhu tertentu.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Health',
      subtopic: 'Infectious diseases & immunity',
      title: 'Penyakit Berjangkit dan Keimunan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Penyakit berjangkit disebabkan oleh patogen seperti bakteria, virus, kulat atau protozoa dan boleh merebak daripada satu hos kepada hos lain. Penyebaran boleh berlaku melalui udara, air, makanan tercemar, sentuhan, darah atau vektor seperti nyamuk. Keimunan ialah keupayaan badan mengenal pasti dan melawan patogen melalui pertahanan tidak khusus dan pertahanan khusus seperti antibodi.'
        ),
        section(
          'Contoh harian',
          'Influenza boleh merebak melalui titisan pernafasan apabila seseorang batuk atau bersin. Vaksin melatih sistem keimunan mengenal antigen tertentu supaya badan dapat menghasilkan tindak balas lebih cepat apabila terdedah kepada patogen sebenar.'
        ),
        section(
          'Awas salah faham',
          'Antibiotik berkesan terhadap banyak jangkitan bakteria tetapi tidak membunuh virus. Mengambil antibiotik tanpa keperluan boleh menyumbang kepada rintangan antibiotik. Vaksin pula tidak merawat jangkitan semasa, tetapi membantu mencegah penyakit atau mengurangkan keterukan.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Patogen | Mikroorganisma atau agen yang menyebabkan penyakit |\n| Antigen | Bahan asing yang merangsang tindak balas imun |\n| Antibodi | Protein yang dihasilkan oleh limfosit untuk mengenal dan meneutralkan antigen |\n| Vaksin | Persediaan yang merangsang keimunan terhadap penyakit tertentu |\n| Vektor | Organisma yang memindahkan patogen, contohnya nyamuk |'
        ),
        section(
          'Cara ingat',
          'Rantai jangkitan boleh dipecahkan pada laluan keluar, cara merebak atau laluan masuk melalui kebersihan, pelitup muka, kawalan vektor dan vaksinasi.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud patogen?',
          options: ['Bahan makanan berkhasiat', 'Agen yang menyebabkan penyakit', 'Sel darah merah', 'Vitamin larut air'],
          correct: { optionIndex: 1 },
          explanation: 'Patogen ialah agen penyebab penyakit seperti bakteria, virus, kulat atau protozoa.',
        },
        {
          type: 'multiple_choice',
          text: 'Mengapa antibiotik tidak digunakan untuk membunuh virus?',
          options: ['Virus terlalu besar', 'Antibiotik hanya bertindak terhadap sasaran tertentu pada bakteria', 'Virus sentiasa berguna', 'Antibiotik ialah sejenis vaksin'],
          correct: { optionIndex: 1 },
          explanation: 'Antibiotik menyasarkan struktur atau proses bakteria, bukan virus.',
        },
        {
          type: 'true_false',
          text: 'Vaksin merangsang sistem keimunan untuk mengenal antigen penyakit tertentu.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Vaksin membantu badan membina memori imun terhadap antigen tertentu.',
        },
        {
          type: 'diagram_label',
          text: 'Rajah menunjukkan rantai jangkitan. Padankan label dengan contoh.',
          options: [
            { prompt: 'A: Agen berjangkit', answer: 'Virus influenza' },
            { prompt: 'B: Cara penyebaran', answer: 'Titisan pernafasan' },
            { prompt: 'C: Hos rentan', answer: 'Individu tanpa keimunan mencukupi' },
          ],
          correct: {
            'A: Agen berjangkit': 'Virus influenza',
            'B: Cara penyebaran': 'Titisan pernafasan',
            'C: Hos rentan': 'Individu tanpa keimunan mencukupi',
          },
          explanation: 'Penyakit berjangkit merebak apabila patogen mempunyai laluan untuk sampai kepada hos rentan.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Kes denggi meningkat di sebuah kawasan perumahan. Tindakan pencegahan manakah paling terus memutuskan vektor penyakit?',
          options: [],
          correct: 'hapuskan tempat pembiakan nyamuk',
          explanation: 'Denggi disebarkan oleh nyamuk Aedes, jadi menghapuskan air bertakung mengurangkan tempat pembiakan vektor.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.text,
        question.options,
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm4CompSci(client) {
  const subject = 'Sains Komputer';
  const formLevel = 4;
  const lessons = [
    {
      topic: 'Computational Thinking',
      subtopic: 'Decomposition & pattern recognition',
      title: 'Pemikiran Komputasional: Leraian dan Pengecaman Corak',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Pemikiran komputasional ialah cara menyelesaikan masalah secara sistematik supaya penyelesaian boleh difahami oleh manusia dan dilaksanakan oleh komputer. Leraian bermaksud memecahkan masalah besar kepada bahagian kecil yang lebih mudah diurus. Pengecaman corak pula mencari persamaan, pengulangan atau hubungan dalam data dan proses. Dua kemahiran ini membantu murid mengurangkan kerumitan sebelum menulis algoritma atau program.'
        ),
        section(
          'Contoh harian',
          'Untuk membina aplikasi rekod kehadiran kelas, masalah boleh dipecahkan kepada beberapa bahagian: daftar murid, ambil kehadiran, simpan tarikh, jana laporan dan cari murid tidak hadir. Corak boleh dilihat apabila setiap rekod kehadiran memerlukan medan yang sama seperti nama, tarikh dan status. Apabila corak ini dikenal pasti, borang dan jadual data boleh direka dengan lebih konsisten.'
        ),
        section(
          'Awas salah faham',
          'Leraian bukan bermaksud membuang bahagian penting masalah. Ia bermaksud mengasingkan bahagian supaya setiap satu boleh dianalisis dengan jelas. Pengecaman corak juga bukan meneka jawapan berdasarkan satu contoh sahaja; corak perlu disokong oleh beberapa contoh atau data yang berulang. Masalah yang dipecahkan terlalu kecil tanpa hubungan yang jelas boleh menyukarkan penyatuan semula penyelesaian.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pemikiran komputasional | Pendekatan menyelesaikan masalah menggunakan konsep seperti leraian, corak, peniskalaan dan algoritma |\n| Leraian | Memecahkan masalah kompleks kepada bahagian kecil yang boleh diselesaikan |\n| Pengecaman corak | Mengenal pasti persamaan atau pengulangan dalam masalah, data atau proses |\n| Submasalah | Bahagian kecil daripada masalah utama |\n| Kerumitan | Tahap kesukaran sesuatu masalah untuk difahami atau diselesaikan |'
        ),
        section(
          'Cara ingat',
          'Ingat "pecah dan cari sama": pecahkan masalah dahulu, kemudian cari bahagian yang berulang supaya penyelesaian boleh diguna semula.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud leraian dalam pemikiran komputasional?',
          options: ['Memecahkan masalah besar kepada bahagian lebih kecil', 'Menukar semua data kepada nombor rawak', 'Menghapuskan semua input pengguna', 'Menyimpan fail tanpa struktur'],
          correct: { optionIndex: 0 },
          explanation: 'Leraian membantu masalah kompleks diurus sebagai beberapa submasalah yang lebih jelas.',
        },
        {
          type: 'multiple_choice',
          text: 'Situasi manakah menunjukkan pengecaman corak?',
          options: ['Murid mendapati setiap rekod pelanggan mempunyai nama, nombor telefon dan alamat', 'Murid memadam semua rekod lama', 'Murid menutup komputer selepas kelas', 'Murid memilih warna latar secara rawak'],
          correct: { optionIndex: 0 },
          explanation: 'Pengecaman corak mencari ciri berulang dalam data atau proses.',
        },
        {
          type: 'true_false',
          text: 'Leraian menyebabkan setiap submasalah boleh dikaji secara lebih teratur.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Submasalah yang lebih kecil biasanya lebih mudah difahami, diuji dan digabungkan semula.',
        },
        {
          type: 'representation_match',
          text: 'Padankan konsep pemikiran komputasional dengan maksudnya.',
          options: [
            { prompt: 'Leraian', answer: 'Memecahkan masalah kepada submasalah' },
            { prompt: 'Pengecaman corak', answer: 'Mencari persamaan atau pengulangan' },
            { prompt: 'Submasalah', answer: 'Bahagian kecil daripada masalah utama' },
          ],
          correct: {
            Leraian: 'Memecahkan masalah kepada submasalah',
            'Pengecaman corak': 'Mencari persamaan atau pengulangan',
            Submasalah: 'Bahagian kecil daripada masalah utama',
          },
          explanation: 'Leraian dan pengecaman corak saling membantu dalam analisis masalah.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah menggunakan leraian dan pengecaman corak untuk masalah sistem pinjaman buku.',
          options: [
            'Kenal pasti masalah utama sistem pinjaman buku',
            'Pecahkan kepada daftar ahli, rekod buku, pinjaman, pemulangan dan denda',
            'Cari medan berulang seperti ID ahli, ID buku dan tarikh',
            'Gunakan corak itu untuk mereka bentuk jadual dan proses yang konsisten',
          ],
          correct: [
            'Kenal pasti masalah utama sistem pinjaman buku',
            'Pecahkan kepada daftar ahli, rekod buku, pinjaman, pemulangan dan denda',
            'Cari medan berulang seperti ID ahli, ID buku dan tarikh',
            'Gunakan corak itu untuk mereka bentuk jadual dan proses yang konsisten',
          ],
          explanation: 'Masalah utama perlu difahami dahulu sebelum dipecahkan dan dianalisis coraknya.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid terus menulis semua kod sistem kantin dalam satu fail besar tanpa menyenaraikan bahagian seperti menu, pesanan dan pembayaran. Apakah kesilapannya?',
          options: [],
          correct: 'Murid itu tidak menggunakan leraian untuk memecahkan sistem kepada submasalah yang lebih mudah diurus.',
          explanation: 'Tanpa leraian, kod menjadi sukar dirancang, diuji dan diselenggara.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Computational Thinking',
      subtopic: 'Abstraction & algorithms',
      title: 'Peniskalaan dan Algoritma',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Peniskalaan ialah proses menumpukan perhatian kepada maklumat penting dan mengetepikan butiran yang tidak diperlukan untuk tujuan penyelesaian. Algoritma pula ialah satu set langkah tersusun, terhingga dan jelas untuk menyelesaikan masalah. Algoritma yang baik mempunyai input, proses dan output yang dapat diuji. Dalam Sains Komputer, algoritma boleh ditulis menggunakan pseudokod, carta alir atau bahasa pengaturcaraan.'
        ),
        section(
          'Contoh harian',
          'Apabila mencari laluan ke sekolah, peta tidak perlu menunjukkan setiap pokok atau rumah kecil. Peta hanya menunjukkan maklumat penting seperti jalan, simpang dan jarak. Itulah peniskalaan. Algoritma perjalanan pula boleh menjadi: semak lokasi semasa, pilih jalan utama, belok di simpang tertentu dan berhenti apabila sampai ke sekolah.'
        ),
        section(
          'Awas salah faham',
          'Peniskalaan bukan bermaksud mengabaikan semua butiran. Butiran yang dibuang mestilah tidak menjejaskan penyelesaian. Algoritma pula tidak semestinya kod komputer, tetapi langkahnya mesti cukup jelas supaya orang lain boleh mengikutinya. Algoritma yang kabur seperti "buat sampai siap" tidak sesuai kerana tiada syarat atau urutan yang jelas.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Peniskalaan | Memilih maklumat penting dan menyembunyikan butiran tidak perlu |\n| Algoritma | Langkah teratur dan terhingga untuk menyelesaikan masalah |\n| Pseudokod | Cara menulis algoritma menggunakan bahasa hampir semula jadi dan struktur logik |\n| Carta alir | Perwakilan grafik langkah algoritma menggunakan simbol piawai |\n| Output | Hasil yang dikeluarkan selepas input diproses |'
        ),
        section(
          'Cara ingat',
          'Peniskalaan menjawab "apa yang penting?", manakala algoritma menjawab "apa langkah seterusnya?".'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah tujuan utama peniskalaan?',
          options: ['Menumpukan maklumat penting dan mengurangkan butiran tidak perlu', 'Menambah sebanyak mungkin hiasan pada antara muka', 'Menghapuskan semua input', 'Menukar algoritma kepada gambar sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Peniskalaan mengurangkan kerumitan dengan mengekalkan maklumat yang relevan.',
        },
        {
          type: 'multiple_choice',
          text: 'Ciri manakah paling penting bagi algoritma yang baik?',
          options: ['Langkah jelas dan terhingga', 'Sentiasa panjang', 'Tidak mempunyai output', 'Tidak boleh diuji'],
          correct: { optionIndex: 0 },
          explanation: 'Algoritma mesti mempunyai langkah yang jelas, tersusun dan berakhir.',
        },
        {
          type: 'true_false',
          text: 'Pseudokod boleh digunakan untuk menerangkan algoritma sebelum program sebenar ditulis.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Pseudokod membantu perancang fokus kepada logik sebelum sintaks bahasa pengaturcaraan.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah membina algoritma untuk menentukan nombor ganjil atau genap.',
          options: [
            'Terima satu nombor sebagai input',
            'Kira baki nombor apabila dibahagi dengan 2',
            'Jika baki ialah 0, paparkan genap',
            'Jika baki bukan 0, paparkan ganjil',
          ],
          correct: [
            'Terima satu nombor sebagai input',
            'Kira baki nombor apabila dibahagi dengan 2',
            'Jika baki ialah 0, paparkan genap',
            'Jika baki bukan 0, paparkan ganjil',
          ],
          explanation: 'Input mesti diterima dahulu sebelum syarat ganjil atau genap boleh diuji.',
          points: 2,
        },
        {
          type: 'representation_match',
          text: 'Padankan bentuk perwakilan algoritma dengan kegunaannya.',
          options: [
            { prompt: 'Pseudokod', answer: 'Menulis logik dalam ayat berstruktur' },
            { prompt: 'Carta alir', answer: 'Menunjukkan aliran langkah dengan simbol' },
            { prompt: 'Kod program', answer: 'Melaksanakan algoritma dalam bahasa komputer' },
          ],
          correct: {
            Pseudokod: 'Menulis logik dalam ayat berstruktur',
            'Carta alir': 'Menunjukkan aliran langkah dengan simbol',
            'Kod program': 'Melaksanakan algoritma dalam bahasa komputer',
          },
          explanation: 'Algoritma boleh diwakili dalam bentuk teks, grafik atau kod.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Algoritma seorang murid berbunyi: "Ambil nombor, buat kira-kira, kemudian beri jawapan." Mengapa algoritma ini lemah?',
          options: [],
          correct: 'Langkah algoritma terlalu kabur kerana tidak menyatakan operasi kira-kira dan syarat output dengan jelas.',
          explanation: 'Algoritma perlu cukup tepat supaya boleh diikuti dan diuji.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Programming Basics',
      subtopic: 'Variables, data types, operators',
      title: 'Asas Pengaturcaraan: Pemboleh Ubah, Jenis Data dan Operator',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Pemboleh ubah ialah nama storan dalam memori yang menyimpan nilai dan nilainya boleh berubah semasa program berjalan. Jenis data menerangkan bentuk nilai seperti integer, nombor nyata, aksara, rentetan dan Boolean. Operator digunakan untuk melakukan operasi seperti tambah, tolak, bandingan dan logik. Penggunaan jenis data yang betul mengelakkan ralat seperti mencampurkan teks dengan nombor tanpa penukaran yang sesuai.'
        ),
        section(
          'Contoh berprogram',
          `Pseudokod ringkas:
markah = 72
lulus = markah >= 50
nama = "Aina"

Nilai markah ialah integer, lulus ialah Boolean, dan nama ialah rentetan. Operator >= membandingkan markah dengan 50 lalu menghasilkan nilai benar atau palsu.`
        ),
        section(
          'Awas salah faham',
          'Pemboleh ubah bukan nilai tetap; nilainya boleh dikemas kini. Tanda sama dengan dalam pengaturcaraan lazimnya bermaksud pemberian nilai, bukan persamaan matematik semata-mata. Nombor 18 dan rentetan "18" kelihatan sama kepada manusia tetapi berlainan jenis data kepada komputer. Operator perbandingan menghasilkan nilai Boolean.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pemboleh ubah | Nama storan yang menyimpan nilai dalam program |\n| Integer | Jenis data nombor bulat |\n| Rentetan | Urutan aksara seperti nama atau ayat |\n| Boolean | Jenis data yang bernilai benar atau palsu |\n| Operator | Simbol atau kata kunci untuk menjalankan operasi pada nilai |'
        ),
        section(
          'Cara ingat',
          'Ingat N-J-O: namakan pemboleh ubah, jelaskan jenis data, kemudian pilih operator yang sesuai.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Jenis data manakah paling sesuai untuk menyimpan nilai benar atau palsu?',
          options: ['Boolean', 'Integer', 'Rentetan', 'Aksara'],
          correct: { optionIndex: 0 },
          explanation: 'Boolean menyimpan dua keadaan logik, iaitu benar atau palsu.',
        },
        {
          type: 'multiple_choice',
          text: 'Operator manakah digunakan untuk membandingkan sama ada markah lebih besar atau sama dengan 50?',
          options: ['>=', '+', '&&', '= teks'],
          correct: { optionIndex: 0 },
          explanation: 'Operator >= ialah operator perbandingan lebih besar atau sama dengan.',
        },
        {
          type: 'true_false',
          text: 'Rentetan "25" dan integer 25 sentiasa dianggap jenis data yang sama.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Rentetan ialah teks, manakala integer ialah nombor bulat.',
        },
        {
          type: 'code_trace',
          text: `Jejak kod berikut. Apakah nilai akhir pemboleh ubah jumlah?

jumlah = 5
jumlah = jumlah + 3
jumlah = jumlah * 2`,
          options: [],
          correct: '16',
          explanation: 'Nilai bermula 5, menjadi 8 selepas tambah 3, kemudian menjadi 16 selepas didarab 2.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah mengisytiharkan dan menggunakan pemboleh ubah markah.',
          options: [
            'Pilih nama pemboleh ubah yang bermakna seperti markah',
            'Tentukan jenis data yang sesuai, contohnya integer',
            'Berikan nilai awal seperti 80',
            'Gunakan operator perbandingan untuk menguji markah >= 50',
          ],
          correct: [
            'Pilih nama pemboleh ubah yang bermakna seperti markah',
            'Tentukan jenis data yang sesuai, contohnya integer',
            'Berikan nilai awal seperti 80',
            'Gunakan operator perbandingan untuk menguji markah >= 50',
          ],
          explanation: 'Nama, jenis data dan nilai perlu jelas sebelum pemboleh ubah digunakan dalam operasi.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid menyimpan umur sebagai rentetan "16" kemudian cuba mengira umur + 1 tetapi hasilnya menjadi teks bergabung. Apakah ralat konsepnya?',
          options: [],
          correct: 'Umur disimpan sebagai rentetan, bukan nombor, jadi nilai perlu disimpan atau ditukar kepada jenis data berangka sebelum pengiraan.',
          explanation: 'Jenis data mempengaruhi cara operator dilaksanakan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Programming Basics',
      subtopic: 'Control structures (if/loop)',
      title: 'Struktur Kawalan: Pilihan dan Ulangan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Struktur kawalan menentukan aliran pelaksanaan program. Struktur pilihan seperti if, if else dan switch memilih tindakan berdasarkan syarat Boolean. Struktur ulangan seperti for, while dan do while mengulang arahan selagi syarat tertentu dipenuhi atau untuk bilangan kali yang ditetapkan. Gabungan pilihan dan ulangan membolehkan program bertindak balas kepada input dan memproses banyak data dengan cekap.'
        ),
        section(
          'Contoh berprogram',
          `Pseudokod:
markah = 65
Jika markah >= 50
  papar "Lulus"
Jika tidak
  papar "Gagal"

Untuk i dari 1 hingga 3
  papar i

Bahagian if memilih mesej berdasarkan syarat. Bahagian untuk mengulang arahan papar sebanyak tiga kali.`
        ),
        section(
          'Awas salah faham',
          'Syarat dalam struktur pilihan perlu menghasilkan benar atau palsu. Dalam ulangan while, pemboleh ubah kawalan mesti dikemas kini supaya gelung boleh berhenti. Gelung tak terhingga berlaku apabila syarat sentiasa benar. Ulangan for lebih sesuai apabila bilangan ulangan diketahui, manakala while sesuai apabila ulangan bergantung kepada keadaan semasa.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Struktur pilihan | Kawalan aliran yang memilih arahan berdasarkan syarat |\n| Syarat Boolean | Ungkapan yang bernilai benar atau palsu |\n| Struktur ulangan | Kawalan aliran yang mengulang arahan |\n| Gelung tak terhingga | Ulangan yang tidak berhenti kerana syarat kekal benar |\n| Pemboleh ubah kawalan | Pemboleh ubah yang mengawal bilangan atau keadaan ulangan |'
        ),
        section(
          'Cara ingat',
          'If menjawab "pilih laluan mana?", loop menjawab "ulang sampai bila?".'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Struktur kawalan manakah paling sesuai untuk memilih mesej "Lulus" atau "Gagal" berdasarkan markah?',
          options: ['if else', 'for tanpa syarat', 'komen', 'pengisytiharan pemboleh ubah sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'if else memilih antara dua laluan berdasarkan syarat markah.',
        },
        {
          type: 'multiple_choice',
          text: 'Bilakah gelung for biasanya lebih sesuai digunakan?',
          options: ['Apabila bilangan ulangan diketahui', 'Apabila program tidak mempunyai arahan', 'Apabila tiada pemboleh ubah digunakan', 'Apabila output mesti sentiasa kosong'],
          correct: { optionIndex: 0 },
          explanation: 'Gelung for sesuai untuk ulangan dengan kiraan yang jelas.',
        },
        {
          type: 'true_false',
          text: 'Gelung while boleh menjadi gelung tak terhingga jika syaratnya tidak pernah berubah menjadi palsu.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Syarat perlu akhirnya menjadi palsu atau gelung akan terus berjalan.',
        },
        {
          type: 'code_trace',
          text: `Jejak pseudokod berikut. Apakah output yang dipaparkan?

x = 4
Jika x % 2 == 0
  papar "Genap"
Jika tidak
  papar "Ganjil"`,
          options: [],
          correct: 'Genap',
          explanation: '4 dibahagi 2 memberi baki 0, jadi syarat nombor genap adalah benar.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah membina gelung while yang mengira dari 1 hingga 5.',
          options: [
            'Tetapkan pemboleh ubah kira = 1',
            'Uji syarat kira <= 5',
            'Papar nilai kira',
            'Tambah kira sebanyak 1 pada setiap ulangan',
          ],
          correct: [
            'Tetapkan pemboleh ubah kira = 1',
            'Uji syarat kira <= 5',
            'Papar nilai kira',
            'Tambah kira sebanyak 1 pada setiap ulangan',
          ],
          explanation: 'Nilai awal, syarat, tindakan dan kemas kini kawalan diperlukan untuk gelung yang betul.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: `Kod berikut tidak berhenti:

i = 1
while i <= 5
  papar i

Apakah kesilapan utamanya?`,
          options: [],
          correct: 'Pemboleh ubah i tidak dikemas kini dalam gelung, jadi syarat i <= 5 kekal benar.',
          explanation: 'Tambah arahan seperti i = i + 1 supaya gelung boleh tamat.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Data Structures',
      subtopic: 'Arrays & lists',
      title: 'Struktur Data: Tatasusunan dan Senarai',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Struktur data ialah cara menyusun dan menyimpan data supaya boleh dicapai dan diproses dengan berkesan. Tatasusunan menyimpan beberapa nilai berkaitan di bawah satu nama dan biasanya dicapai menggunakan indeks. Senarai juga menyimpan koleksi item, tetapi dalam banyak bahasa ia lebih mudah ditambah atau dibuang item berbanding tatasusunan bersaiz tetap. Dalam pengaturcaraan sekolah, tatasusunan membantu memproses banyak nilai seperti markah murid menggunakan gelung.'
        ),
        section(
          'Contoh berprogram',
          `Contoh:
markah = [70, 85, 60]
jumlah = 0
Untuk setiap nilai dalam markah
  jumlah = jumlah + nilai
purata = jumlah / 3

Daripada menulis tiga pemboleh ubah berasingan, semua markah disimpan dalam satu koleksi dan diproses menggunakan gelung.`
        ),
        section(
          'Awas salah faham',
          'Indeks bukan sama dengan nilai item. Dalam banyak bahasa, indeks item pertama ialah 0, tetapi sesetengah pseudokod sekolah boleh menggunakan indeks bermula 1. Oleh itu, ikut peraturan bahasa atau soalan yang diberi. Ralat luar julat berlaku apabila program cuba mencapai indeks yang tidak wujud. Semua item dalam tatasusunan lazimnya mewakili jenis data atau kategori yang sama.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Struktur data | Susunan data untuk penyimpanan dan pemprosesan |\n| Tatasusunan | Koleksi nilai yang dicapai menggunakan indeks |\n| Senarai | Koleksi item yang boleh diurus sebagai satu kumpulan |\n| Indeks | Nombor kedudukan item dalam koleksi |\n| Ralat luar julat | Cubaan mencapai indeks yang tiada dalam koleksi |'
        ),
        section(
          'Cara ingat',
          'Tatasusunan seperti rak bernombor: nama rak ialah pemboleh ubah, nombor petak ialah indeks, dan isi petak ialah nilai.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah fungsi indeks dalam tatasusunan?',
          options: ['Menunjukkan kedudukan item dalam koleksi', 'Menukar komputer kepada pelayan', 'Menghapuskan semua nilai', 'Menentukan warna paparan sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Indeks digunakan untuk mencapai item tertentu dalam tatasusunan atau senarai.',
        },
        {
          type: 'multiple_choice',
          text: 'Mengapa tatasusunan sesuai untuk menyimpan markah 30 murid?',
          options: ['Semua markah boleh diurus sebagai satu koleksi dan diproses dengan gelung', 'Tatasusunan hanya boleh menyimpan satu nilai', 'Tatasusunan tidak memerlukan memori', 'Tatasusunan menggantikan semua algoritma'],
          correct: { optionIndex: 0 },
          explanation: 'Koleksi nilai berkaitan lebih mudah diproses apabila disimpan dalam satu struktur data.',
        },
        {
          type: 'true_false',
          text: 'Ralat luar julat boleh berlaku apabila program mencapai indeks yang tidak wujud.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Contohnya cuba membaca item keempat dalam koleksi yang hanya mempunyai tiga item.',
        },
        {
          type: 'code_trace',
          text: `Jejak pseudokod berikut. Apakah nilai jumlah?

markah = [70, 80, 90]
jumlah = 0
Untuk setiap m dalam markah
  jumlah = jumlah + m`,
          options: [],
          correct: '240',
          explanation: 'Jumlah = 70 + 80 + 90 = 240.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah mencari nilai maksimum dalam tatasusunan markah.',
          options: [
            'Tetapkan maksimum kepada item pertama',
            'Bandingkan setiap item seterusnya dengan maksimum',
            'Jika item lebih besar, kemas kini maksimum',
            'Selepas semua item disemak, papar maksimum',
          ],
          correct: [
            'Tetapkan maksimum kepada item pertama',
            'Bandingkan setiap item seterusnya dengan maksimum',
            'Jika item lebih besar, kemas kini maksimum',
            'Selepas semua item disemak, papar maksimum',
          ],
          explanation: 'Nilai maksimum perlu dikemas kini hanya apabila item semasa lebih besar.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Satu senarai mempunyai tiga item pada indeks 0, 1 dan 2. Murid cuba membaca item indeks 3. Apakah ralat yang berlaku?',
          options: [],
          correct: 'Ralat luar julat kerana indeks 3 tidak wujud dalam senarai tiga item yang bermula pada indeks 0.',
          explanation: 'Untuk indeks bermula 0, item terakhir bagi tiga item ialah indeks 2.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Networks',
      subtopic: 'Network types & protocols',
      title: 'Rangkaian: Jenis Rangkaian dan Protokol',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Rangkaian komputer menghubungkan peranti supaya data dan sumber boleh dikongsi. Jenis rangkaian termasuk PAN untuk kawasan sangat dekat, LAN untuk kawasan setempat seperti makmal komputer, MAN untuk kawasan bandar dan WAN untuk kawasan luas seperti hubungan antara negeri atau negara. Protokol ialah set peraturan komunikasi yang membolehkan peranti bertukar data dengan format yang dipersetujui. TCP/IP menjadi asas komunikasi Internet, manakala protokol aplikasi seperti HTTP, HTTPS, FTP, SMTP dan DNS menyokong perkhidmatan tertentu.'
        ),
        section(
          'Contoh harian',
          'Rangkaian Wi-Fi di sekolah ialah contoh LAN kerana ia meliputi kawasan setempat. Apabila pengguna menaip nama laman web, DNS membantu menukar nama domain kepada alamat IP. HTTP atau HTTPS kemudian digunakan untuk memindahkan halaman web antara pelayan dan pelayar. Tanpa protokol yang sama, peranti sukar memahami data yang dihantar.'
        ),
        section(
          'Awas salah faham',
          'Internet bukan sama dengan Wi-Fi. Wi-Fi ialah teknologi capaian tanpa wayar dalam rangkaian setempat, manakala Internet ialah rangkaian global yang menghubungkan banyak rangkaian. Alamat IP mengenal pasti peranti atau hos dalam rangkaian, manakala nama domain memudahkan manusia mengingati alamat. HTTPS bukan hanya "HTTP biasa"; ia menambah penyulitan untuk melindungi komunikasi web.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| LAN | Rangkaian kawasan setempat seperti rumah, sekolah atau pejabat |\n| WAN | Rangkaian kawasan luas yang menghubungkan lokasi berjauhan |\n| Protokol | Peraturan komunikasi data antara peranti |\n| Alamat IP | Pengenal berangka bagi peranti atau hos dalam rangkaian |\n| DNS | Sistem yang memetakan nama domain kepada alamat IP |'
        ),
        section(
          'Cara ingat',
          'Jenis rangkaian ikut keluasan: PAN paling dekat, LAN setempat, MAN bandar, WAN paling luas.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Rangkaian komputer dalam satu makmal sekolah biasanya dikategorikan sebagai apa?',
          options: ['LAN', 'WAN', 'MAN seluruh negara', 'DNS'],
          correct: { optionIndex: 0 },
          explanation: 'LAN meliputi kawasan setempat seperti bilik, bangunan atau kampus kecil.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah fungsi utama DNS?',
          options: ['Menukar nama domain kepada alamat IP', 'Menambah memori RAM', 'Mencetak dokumen', 'Menyimpan kata laluan dalam buku nota'],
          correct: { optionIndex: 0 },
          explanation: 'DNS membolehkan manusia menggunakan nama domain yang mudah diingati.',
        },
        {
          type: 'true_false',
          text: 'Protokol ialah peraturan yang dipersetujui untuk komunikasi data.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Peranti memerlukan peraturan yang sama supaya data dapat dihantar dan diterima dengan betul.',
        },
        {
          type: 'representation_match',
          text: 'Padankan istilah rangkaian dengan penerangan yang tepat.',
          options: [
            { prompt: 'LAN', answer: 'Rangkaian kawasan setempat' },
            { prompt: 'WAN', answer: 'Rangkaian kawasan luas' },
            { prompt: 'HTTPS', answer: 'Protokol web dengan penyulitan' },
            { prompt: 'SMTP', answer: 'Protokol penghantaran e-mel' },
          ],
          correct: {
            LAN: 'Rangkaian kawasan setempat',
            WAN: 'Rangkaian kawasan luas',
            HTTPS: 'Protokol web dengan penyulitan',
            SMTP: 'Protokol penghantaran e-mel',
          },
          explanation: 'Setiap istilah menerangkan skop rangkaian atau peranan protokol tertentu.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun urutan ringkas apabila pengguna membuka halaman web menggunakan nama domain.',
          options: [
            'Pengguna memasukkan nama domain dalam pelayar',
            'DNS mendapatkan alamat IP bagi nama domain',
            'Pelayar membuat sambungan ke pelayan web',
            'HTTP atau HTTPS memindahkan data halaman web',
          ],
          correct: [
            'Pengguna memasukkan nama domain dalam pelayar',
            'DNS mendapatkan alamat IP bagi nama domain',
            'Pelayar membuat sambungan ke pelayan web',
            'HTTP atau HTTPS memindahkan data halaman web',
          ],
          explanation: 'Nama domain perlu dipetakan kepada alamat IP sebelum pelayan web boleh dihubungi.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Sebuah syarikat mahu menghubungkan pejabat di Kuala Lumpur dan Kota Kinabalu. Jenis rangkaian manakah paling sesuai untuk menerangkan sambungan luas ini?',
          options: [],
          correct: 'WAN',
          explanation: 'WAN menghubungkan rangkaian atau lokasi yang berjauhan secara geografi.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Cybersecurity',
      subtopic: 'Threats & protective measures',
      title: 'Keselamatan Siber: Ancaman dan Langkah Perlindungan',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Keselamatan siber melindungi sistem komputer, rangkaian dan data daripada capaian tanpa kebenaran, kerosakan atau kecurian. Ancaman biasa termasuk perisian hasad, pancingan data, kejuruteraan sosial, kata laluan lemah dan serangan penafian perkhidmatan. Langkah perlindungan termasuk kata laluan kukuh, pengesahan dua faktor, kemas kini perisian, antivirus, sandaran data, penyulitan dan penggunaan rangkaian yang selamat. Kesedaran pengguna sama penting dengan alat keselamatan.'
        ),
        section(
          'Contoh harian',
          'E-mel pancingan data mungkin menyamar sebagai bank dan meminta pengguna menekan pautan untuk mengesahkan akaun. Pengguna perlu memeriksa pengirim, bahasa mesej dan permintaan maklumat sensitif sebelum bertindak. Jika akaun penting menggunakan pengesahan dua faktor, pencuri masih memerlukan kod tambahan walaupun kata laluan telah diketahui.'
        ),
        section(
          'Awas salah faham',
          'Antivirus tidak menjamin perlindungan penuh jika pengguna tetap memuat turun fail berbahaya atau berkongsi kata laluan. Kata laluan yang panjang tetapi mudah diteka seperti nama sendiri dan tahun lahir masih lemah. Sandaran data perlu diuji dan disimpan dengan selamat. Maklumat peribadi seperti nombor kad pengenalan, alamat dan kod OTP tidak patut dikongsi tanpa sebab yang sah.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Perisian hasad | Perisian berniat jahat seperti virus, worm, trojan atau ransomware |\n| Pancingan data | Penipuan yang cuba mendapatkan maklumat sensitif melalui penyamaran |\n| Pengesahan dua faktor | Kaedah log masuk menggunakan dua bukti identiti |\n| Penyulitan | Menukar data kepada bentuk yang tidak mudah dibaca tanpa kunci |\n| Sandaran | Salinan data untuk pemulihan jika data asal hilang atau rosak |'
        ),
        section(
          'Cara ingat',
          'Lindungi akaun dengan K-D-K: kata laluan kukuh, dua faktor, kemas kini perisian.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud pancingan data?',
          options: ['Percubaan menipu pengguna supaya memberikan maklumat sensitif', 'Kaedah menyusun fail mengikut abjad', 'Proses memasang pencetak', 'Teknik memadam data sementara sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Pancingan data sering menggunakan e-mel, mesej atau laman palsu untuk mencuri maklumat.',
        },
        {
          type: 'multiple_choice',
          text: 'Langkah manakah paling baik untuk menambah keselamatan akaun selain kata laluan?',
          options: ['Pengesahan dua faktor', 'Menggunakan kata laluan yang sama di semua akaun', 'Menulis kata laluan pada skrin', 'Membuka semua lampiran e-mel'],
          correct: { optionIndex: 0 },
          explanation: 'Pengesahan dua faktor menambah bukti identiti kedua semasa log masuk.',
        },
        {
          type: 'true_false',
          text: 'Kod OTP patut dikongsi dengan sesiapa sahaja yang mengaku sebagai pegawai sokongan.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Kod OTP ialah bukti keselamatan peribadi dan tidak patut dikongsi.',
        },
        {
          type: 'representation_match',
          text: 'Padankan ancaman atau perlindungan dengan maksudnya.',
          options: [
            { prompt: 'Ransomware', answer: 'Perisian hasad yang menyekat atau menyulitkan data untuk menuntut bayaran' },
            { prompt: 'Firewall', answer: 'Sistem yang menapis trafik rangkaian berdasarkan peraturan' },
            { prompt: 'Sandaran', answer: 'Salinan data untuk pemulihan' },
            { prompt: 'Penyulitan', answer: 'Menukar data kepada bentuk yang sukar dibaca tanpa kunci' },
          ],
          correct: {
            Ransomware: 'Perisian hasad yang menyekat atau menyulitkan data untuk menuntut bayaran',
            Firewall: 'Sistem yang menapis trafik rangkaian berdasarkan peraturan',
            Sandaran: 'Salinan data untuk pemulihan',
            Penyulitan: 'Menukar data kepada bentuk yang sukar dibaca tanpa kunci',
          },
          explanation: 'Ancaman dan kawalan keselamatan perlu dikenal pasti dengan fungsi masing-masing.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun tindakan selamat apabila menerima e-mel mencurigakan yang meminta kata laluan.',
          options: [
            'Jangan klik pautan atau buka lampiran',
            'Semak alamat pengirim dan tanda amaran mesej',
            'Laporkan kepada guru, pentadbir sistem atau pihak berkaitan',
            'Padam atau asingkan mesej selepas laporan dibuat',
          ],
          correct: [
            'Jangan klik pautan atau buka lampiran',
            'Semak alamat pengirim dan tanda amaran mesej',
            'Laporkan kepada guru, pentadbir sistem atau pihak berkaitan',
            'Padam atau asingkan mesej selepas laporan dibuat',
          ],
          explanation: 'Tindakan awal ialah mengelakkan interaksi dengan pautan atau lampiran berbahaya.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Komputer sekolah diserang ransomware dan fail penting tidak boleh dibuka. Langkah perlindungan manakah paling membantu memulihkan data tanpa membayar penyerang?',
          options: [],
          correct: 'sandaran data',
          explanation: 'Sandaran yang selamat membolehkan data dipulihkan jika fail asal disulitkan atau rosak.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Information Systems',
      subtopic: 'Database concepts',
      title: 'Sistem Maklumat: Konsep Pangkalan Data',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Pangkalan data ialah koleksi data tersusun yang disimpan supaya mudah dicapai, dikemas kini dan dianalisis. Sistem pengurusan pangkalan data, atau DBMS, membantu pengguna mencipta jadual, memasukkan rekod, membuat pertanyaan dan mengawal keselamatan data. Dalam model hubungan, data disusun dalam jadual yang mempunyai medan, rekod, kunci primer dan kunci asing. Reka bentuk pangkalan data yang baik mengurangkan pertindihan data dan menjaga integriti data.'
        ),
        section(
          'Contoh harian',
          'Sistem perpustakaan boleh mempunyai jadual Murid, Buku dan Pinjaman. Jadual Murid menyimpan ID murid, nama dan kelas. Jadual Buku menyimpan ID buku, tajuk dan pengarang. Jadual Pinjaman menghubungkan murid dengan buku menggunakan ID murid dan ID buku supaya sistem tahu siapa meminjam buku tertentu.'
        ),
        section(
          'Awas salah faham',
          'Pangkalan data bukan sekadar satu jadual besar. Jika semua data murid, buku dan pinjaman dicampur dalam satu jadual, data mudah berulang dan sukar dikemas kini. Kunci primer mesti mengenal pasti rekod secara unik. Kunci asing bukan data rawak; ia merujuk kepada kunci primer dalam jadual lain untuk membina hubungan yang sah.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pangkalan data | Koleksi data tersusun untuk penyimpanan dan capaian |\n| Jadual | Struktur baris dan lajur untuk menyimpan data berkaitan |\n| Medan | Lajur yang mewakili atribut seperti nama atau tarikh |\n| Rekod | Baris data lengkap bagi satu entiti |\n| Kunci primer | Medan yang mengenal pasti setiap rekod secara unik |\n| Kunci asing | Medan yang merujuk kunci primer dalam jadual lain |'
        ),
        section(
          'Cara ingat',
          'Jadual seperti helaian tersusun: medan ialah lajur, rekod ialah baris, kunci primer ialah ID unik.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah fungsi kunci primer dalam jadual pangkalan data?',
          options: ['Mengenal pasti setiap rekod secara unik', 'Menyimpan warna latar aplikasi', 'Menghapuskan semua rekod lama', 'Menukar teks kepada gambar'],
          correct: { optionIndex: 0 },
          explanation: 'Kunci primer memastikan setiap rekod boleh dikenal pasti tanpa kekeliruan.',
        },
        {
          type: 'multiple_choice',
          text: 'Dalam jadual Murid, lajur seperti nama, kelas dan nombor telefon dipanggil apa?',
          options: ['Medan', 'Pelayan', 'Protokol', 'Gelung'],
          correct: { optionIndex: 0 },
          explanation: 'Medan ialah lajur yang mewakili atribut sesuatu entiti.',
        },
        {
          type: 'true_false',
          text: 'Kunci asing digunakan untuk mewujudkan hubungan antara jadual.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Kunci asing merujuk kepada kunci primer dalam jadual lain.',
        },
        {
          type: 'representation_match',
          text: 'Padankan konsep pangkalan data dengan contoh sistem perpustakaan.',
          options: [
            { prompt: 'Entiti', answer: 'Murid atau Buku' },
            { prompt: 'Medan', answer: 'Nama murid atau tajuk buku' },
            { prompt: 'Rekod', answer: 'Satu baris lengkap data murid' },
            { prompt: 'Kunci primer', answer: 'ID murid yang unik' },
          ],
          correct: {
            Entiti: 'Murid atau Buku',
            Medan: 'Nama murid atau tajuk buku',
            Rekod: 'Satu baris lengkap data murid',
            'Kunci primer': 'ID murid yang unik',
          },
          explanation: 'Konsep pangkalan data boleh dilihat melalui contoh entiti, atribut dan rekod harian.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah asas mereka bentuk pangkalan data sistem pinjaman buku.',
          options: [
            'Kenal pasti entiti seperti Murid, Buku dan Pinjaman',
            'Tentukan medan penting bagi setiap entiti',
            'Pilih kunci primer untuk setiap jadual',
            'Tetapkan kunci asing untuk menghubungkan jadual berkaitan',
          ],
          correct: [
            'Kenal pasti entiti seperti Murid, Buku dan Pinjaman',
            'Tentukan medan penting bagi setiap entiti',
            'Pilih kunci primer untuk setiap jadual',
            'Tetapkan kunci asing untuk menghubungkan jadual berkaitan',
          ],
          explanation: 'Reka bentuk bermula dengan entiti sebelum medan dan hubungan ditetapkan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Dalam jadual Murid, seorang murid boleh mempunyai nombor ID yang sama dengan murid lain. Mengapa ini reka bentuk yang salah?',
          options: [],
          correct: 'Kunci primer tidak unik, jadi sistem tidak dapat mengenal pasti setiap rekod murid dengan tepat.',
          explanation: 'Nilai kunci primer mestilah unik untuk menjaga integriti data.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.text,
        question.options || [],
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm5Biology(client) {
  const subject = 'Biology';
  const formLevel = 5;
  const blocks = (concept, workedExample, misconceptions, keyTerms, memoryAid) => [
    section('Concept', concept),
    section('Worked example', workedExample),
    section('Common misconceptions', misconceptions),
    section('Key terms', keyTerms),
    section('Memory aid', memoryAid),
  ];

  const lessons = [
    {
      topic: 'Transport',
      subtopic: 'Blood composition & functions',
      difficulty: 'easy',
      blocks: blocks(
        'Blood is a connective tissue made of plasma, red blood cells, white blood cells and platelets. Plasma carries dissolved substances such as nutrients, hormones, carbon dioxide, urea and heat around the body. Red blood cells contain haemoglobin, which combines with oxygen in the lungs and releases it in body tissues. White blood cells defend the body against pathogens, while platelets help blood clot at damaged blood vessels.',
        'During exercise, muscle cells need more oxygen and glucose and produce more carbon dioxide and heat. Red blood cells deliver extra oxygen to the muscles, plasma transports glucose and carries carbon dioxide away, and blood flow helps distribute heat to the skin. If a small blood vessel is cut, platelets and clotting factors form a clot to reduce blood loss and block pathogen entry.',
        'Students often think plasma is just water, but it also contains proteins and many dissolved substances. Red blood cells do not fight pathogens; that is mainly the role of white blood cells. Mature human red blood cells have no nucleus, giving more space for haemoglobin. Platelets are cell fragments, not complete cells, and they begin clotting rather than carrying oxygen.',
        '| Term | Meaning |\n|---|---|\n| Plasma (Plasma) | Liquid part of blood that transports dissolved substances and heat. |\n| Red blood cell (Sel darah merah) | Biconcave cell containing haemoglobin for oxygen transport. |\n| White blood cell (Sel darah putih) | Defence cell that destroys pathogens or produces antibodies. |\n| Platelet (Platlet) | Cell fragment involved in blood clotting. |\n| Haemoglobin (Hemoglobin) | Red pigment that binds oxygen reversibly. |',
        'Remember the four blood parts as "Plasma carries, red cells oxygenate, white cells defend, platelets plug".'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which blood component transports most dissolved nutrients, hormones and urea?',
          options: ['Plasma', 'Red blood cells', 'Platelets', 'Haemoglobin'],
          correct: { optionIndex: 0 },
          explanation: 'Plasma is the liquid part of blood and transports many dissolved substances.',
        },
        {
          type: 'multiple_choice',
          question: 'What is the main function of platelets?',
          options: ['Transport oxygen', 'Produce insulin', 'Start blood clotting', 'Digest bacteria inside the stomach'],
          correct: { optionIndex: 2 },
          explanation: 'Platelets help form clots at damaged blood vessels.',
        },
        {
          type: 'true_false',
          question: 'Mature human red blood cells contain a nucleus.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Mature human red blood cells lose their nucleus, leaving more space for haemoglobin.',
        },
        {
          type: 'representation_match',
          question: 'Match each blood component with its main function.',
          options: [
            { prompt: 'Plasma', answer: 'Transports dissolved substances and heat' },
            { prompt: 'Red blood cell', answer: 'Transports oxygen using haemoglobin' },
            { prompt: 'White blood cell', answer: 'Defends the body against pathogens' },
            { prompt: 'Platelet', answer: 'Helps blood clot at wounds' },
          ],
          correct: {
            Plasma: 'Transports dissolved substances and heat',
            'Red blood cell': 'Transports oxygen using haemoglobin',
            'White blood cell': 'Defends the body against pathogens',
            Platelet: 'Helps blood clot at wounds',
          },
          explanation: 'Each component has a specialised role in transport, defence or clotting.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the steps in blood clot formation after a small cut.',
          options: ['Fibrin threads trap blood cells', 'Platelets gather at the damaged site', 'Clotting factors are activated', 'A stable clot seals the wound'],
          correct: ['Platelets gather at the damaged site', 'Clotting factors are activated', 'Fibrin threads trap blood cells', 'A stable clot seals the wound'],
          explanation: 'Platelet activity starts the clotting process, and fibrin forms the mesh that stabilises the clot.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says white blood cells carry oxygen because they are cells in the blood. Identify the error.',
          options: [],
          correct: 'The student confused blood cell roles; red blood cells carry oxygen while white blood cells defend the body against pathogens.',
          explanation: 'Oxygen transport depends on haemoglobin in red blood cells.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Transport',
      subtopic: 'Heart structure & cardiac cycle',
      difficulty: 'medium',
      blocks: blocks(
        'The human heart is a muscular pump divided into right and left sides. The right side pumps deoxygenated blood to the lungs, while the left side pumps oxygenated blood to the whole body. Valves keep blood moving in one direction: atrioventricular valves separate atria from ventricles, and semilunar valves guard the exits to the arteries. The cardiac cycle consists of atrial systole, ventricular systole and diastole. The left ventricle has the thickest muscular wall because it pumps blood at high pressure to the body.',
        'When the ventricles contract, pressure inside them rises and the atrioventricular valves close, producing the first heart sound. Blood is then forced into the pulmonary artery and aorta through the semilunar valves. As ventricles relax, semilunar valves close to prevent backflow from the arteries. This sequence allows the heart to pump repeatedly without mixing the two blood circuits.',
        'A common misconception is that both sides of the heart carry the same kind of blood. In fact, the right side handles deoxygenated blood and the left side handles oxygenated blood. Arteries are defined by carrying blood away from the heart, not by oxygen content, so the pulmonary artery is an exception because it carries deoxygenated blood. Valves do not pump blood; they only prevent backflow.',
        '| Term | Meaning |\n|---|---|\n| Atrium (Atrium) | Upper heart chamber that receives blood. |\n| Ventricle (Ventrikel) | Lower heart chamber that pumps blood out of the heart. |\n| Atrioventricular valve (Injap atrioventrikel) | Valve between atrium and ventricle that prevents backflow. |\n| Semilunar valve (Injap semilunar) | Valve at artery exits from the heart. |\n| Cardiac cycle (Kitar kardium) | Repeating sequence of contraction and relaxation in one heartbeat. |',
        'Use "A before V, then rest": atria contract first, ventricles contract second, and diastole lets chambers refill.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which chamber has the thickest muscular wall?',
          options: ['Right atrium', 'Left atrium', 'Right ventricle', 'Left ventricle'],
          correct: { optionIndex: 3 },
          explanation: 'The left ventricle pumps blood to the whole body and needs the highest pressure.',
        },
        {
          type: 'multiple_choice',
          question: 'What is the function of heart valves?',
          options: ['Produce red blood cells', 'Prevent backflow of blood', 'Exchange oxygen with tissues', 'Digest blood proteins'],
          correct: { optionIndex: 1 },
          explanation: 'Heart valves maintain one-way blood flow through the heart.',
        },
        {
          type: 'true_false',
          question: 'The semilunar valves prevent blood in the arteries from flowing back into the ventricles.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Semilunar valves are located at the exits to the pulmonary artery and aorta.',
        },
        {
          type: 'representation_match',
          question: 'Match each heart structure or phase with its description.',
          options: [
            { prompt: 'Right ventricle', answer: 'Pumps deoxygenated blood to the lungs' },
            { prompt: 'Left ventricle', answer: 'Pumps oxygenated blood to the body' },
            { prompt: 'Atrial systole', answer: 'Atria contract and push blood into ventricles' },
            { prompt: 'Diastole', answer: 'Heart chambers relax and refill with blood' },
          ],
          correct: {
            'Right ventricle': 'Pumps deoxygenated blood to the lungs',
            'Left ventricle': 'Pumps oxygenated blood to the body',
            'Atrial systole': 'Atria contract and push blood into ventricles',
            Diastole: 'Heart chambers relax and refill with blood',
          },
          explanation: 'Heart structure and cycle phases work together to maintain one-way pumping.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the cardiac cycle phases in order.',
          options: ['Ventricular systole', 'Diastole and filling', 'Atrial systole', 'Semilunar valves close as ventricles relax'],
          correct: ['Diastole and filling', 'Atrial systole', 'Ventricular systole', 'Semilunar valves close as ventricles relax'],
          explanation: 'The heart fills during diastole, atria finish filling the ventricles, then ventricles pump blood out.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says the right side of the heart pumps oxygenated blood to the body. Identify the error.',
          options: [],
          correct: 'The right side pumps deoxygenated blood to the lungs; the left side pumps oxygenated blood to the body.',
          explanation: 'The heart is a double pump with separate pulmonary and systemic circuits.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Transport',
      subtopic: 'Blood vessels & circulation',
      difficulty: 'medium',
      blocks: blocks(
        'Blood vessels are specialised for different parts of circulation. Arteries carry blood away from the heart under high pressure and have thick, muscular, elastic walls. Veins carry blood back to the heart at lower pressure and usually have valves to prevent backflow. Capillaries are one cell thick, giving a short diffusion distance for exchange of gases, nutrients and wastes. Humans have double circulation: pulmonary circulation links the heart and lungs, while systemic circulation links the heart and body tissues.',
        'A red blood cell leaving the right ventricle travels through the pulmonary artery to the lungs, where it gains oxygen. It returns by the pulmonary vein to the left atrium, passes to the left ventricle and is pumped through the aorta to body tissues. After releasing oxygen and collecting carbon dioxide, it returns through veins to the vena cava and right atrium.',
        'Do not identify arteries and veins by oxygen content alone. Arteries carry blood away from the heart and veins carry blood toward the heart. The pulmonary artery carries deoxygenated blood, while the pulmonary vein carries oxygenated blood. Capillaries are not simply tiny veins; they are exchange vessels with very thin walls.',
        '| Term | Meaning |\n|---|---|\n| Artery (Arteri) | Vessel that carries blood away from the heart. |\n| Vein (Vena) | Vessel that carries blood toward the heart. |\n| Capillary (Kapilari) | Microscopic vessel where exchange occurs. |\n| Pulmonary circulation (Peredaran pulmonari) | Blood flow between heart and lungs. |\n| Systemic circulation (Peredaran sistemik) | Blood flow between heart and body tissues. |',
        'Remember "A-away, V-visits heart": arteries go away from the heart, veins return to the heart.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which feature best suits arteries to high-pressure blood flow?',
          options: ['Very thin one-cell wall', 'Thick muscular and elastic wall', 'No elastic tissue', 'Large pores for filtration only'],
          correct: { optionIndex: 1 },
          explanation: 'Arteries need thick, elastic walls to withstand and maintain high pressure.',
        },
        {
          type: 'multiple_choice',
          question: 'Where does most exchange of gases and nutrients with body cells occur?',
          options: ['Capillaries', 'Aorta', 'Vena cava', 'Pulmonary artery only'],
          correct: { optionIndex: 0 },
          explanation: 'Capillaries have thin walls and a large surface area for exchange.',
        },
        {
          type: 'true_false',
          question: 'Veins normally carry blood at higher pressure than arteries.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Veins carry blood at lower pressure and often contain valves.',
        },
        {
          type: 'representation_match',
          question: 'Match each vessel or circulation route with its role.',
          options: [
            { prompt: 'Artery', answer: 'Carries blood away from the heart' },
            { prompt: 'Vein', answer: 'Carries blood back to the heart' },
            { prompt: 'Capillary', answer: 'Allows exchange with tissues' },
            { prompt: 'Pulmonary circulation', answer: 'Carries blood between heart and lungs' },
          ],
          correct: {
            Artery: 'Carries blood away from the heart',
            Vein: 'Carries blood back to the heart',
            Capillary: 'Allows exchange with tissues',
            'Pulmonary circulation': 'Carries blood between heart and lungs',
          },
          explanation: 'The vessel name describes the direction or exchange function.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the route of blood from the body back to the body again.',
          options: ['Left ventricle to aorta', 'Right ventricle to lungs', 'Vena cava to right atrium', 'Pulmonary vein to left atrium'],
          correct: ['Vena cava to right atrium', 'Right ventricle to lungs', 'Pulmonary vein to left atrium', 'Left ventricle to aorta'],
          explanation: 'Blood returns to the right side, goes to the lungs, returns to the left side and is pumped to the body.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says the pulmonary artery must carry oxygenated blood because all arteries carry oxygenated blood. Identify the error.',
          options: [],
          correct: 'Arteries are defined by carrying blood away from the heart; the pulmonary artery carries deoxygenated blood to the lungs.',
          explanation: 'The pulmonary artery is an important exception to the oxygen-content shortcut.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Transport in Plants',
      subtopic: 'Xylem & phloem',
      difficulty: 'medium',
      blocks: blocks(
        'Vascular plants transport substances using xylem and phloem. Xylem vessels are dead, hollow and strengthened with lignin, so they transport water and mineral ions from roots to stems and leaves. Phloem consists of living sieve tube elements and companion cells that translocate sucrose and amino acids between sources and sinks. Transpiration pull is the main force moving water upward through xylem. Translocation in phloem can move in different directions depending on where food is made and used.',
        'In a leafy shoot on a hot day, water evaporates from moist mesophyll cell walls and diffuses out through stomata. This creates tension that pulls a continuous column of water up the xylem from the roots. At the same time, sucrose made in leaves can be loaded into phloem and transported to growing shoots, roots or fruits where it is used or stored.',
        'Xylem does not transport sugar, and phloem does not mainly transport water for transpiration. Another common error is saying xylem transport needs living cells throughout; mature xylem vessels are dead and hollow. Phloem transport is not always downward, because a developing fruit above a leaf can be a sink. Removing bark in a ring affects phloem more directly than xylem.',
        '| Term | Meaning |\n|---|---|\n| Xylem (Xilem) | Tissue that transports water and mineral ions. |\n| Phloem (Floem) | Tissue that transports sucrose and amino acids. |\n| Transpiration (Transpirasi) | Loss of water vapour from aerial parts of plants. |\n| Translocation (Translokasi) | Movement of organic substances in phloem. |\n| Lignin (Lignin) | Strengthening material in xylem walls. |',
        'Use "Xylem up water, phloem feeds": xylem carries water upward, while phloem carries food from sources to sinks.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What is transported mainly by xylem?',
          options: ['Sucrose and amino acids', 'Water and mineral ions', 'Antibodies', 'Carbon dioxide in blood'],
          correct: { optionIndex: 1 },
          explanation: 'Xylem carries water and dissolved mineral ions from roots upward.',
        },
        {
          type: 'multiple_choice',
          question: 'Which cells are closely associated with sieve tube elements in phloem?',
          options: ['Guard cells', 'Companion cells', 'Red blood cells', 'Root hair cells only'],
          correct: { optionIndex: 1 },
          explanation: 'Companion cells support the living sieve tube elements in phloem.',
        },
        {
          type: 'true_false',
          question: 'Mature xylem vessels are living cells with cytoplasm throughout.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Mature xylem vessels are dead, hollow and strengthened by lignin.',
        },
        {
          type: 'representation_match',
          question: 'Match each plant transport term with its description.',
          options: [
            { prompt: 'Xylem vessel', answer: 'Dead hollow tube strengthened by lignin' },
            { prompt: 'Sieve tube element', answer: 'Living phloem cell that conducts sucrose' },
            { prompt: 'Companion cell', answer: 'Supports phloem loading and unloading' },
            { prompt: 'Transpiration pull', answer: 'Tension pulling water upward through xylem' },
          ],
          correct: {
            'Xylem vessel': 'Dead hollow tube strengthened by lignin',
            'Sieve tube element': 'Living phloem cell that conducts sucrose',
            'Companion cell': 'Supports phloem loading and unloading',
            'Transpiration pull': 'Tension pulling water upward through xylem',
          },
          explanation: 'Plant vascular tissues have specialised structures for their transport roles.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the movement of water from soil to air through a leaf.',
          options: ['Water evaporates from mesophyll cell walls', 'Water enters root hair cells by osmosis', 'Water moves up xylem vessels', 'Water vapour diffuses out through stomata'],
          correct: ['Water enters root hair cells by osmosis', 'Water moves up xylem vessels', 'Water evaporates from mesophyll cell walls', 'Water vapour diffuses out through stomata'],
          explanation: 'Water is absorbed by roots, transported in xylem, evaporates in leaves and leaves through stomata.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says removing a ring of bark stops xylem transport first because xylem is in the bark. Identify the error.',
          options: [],
          correct: 'The bark contains phloem, so ringing interrupts phloem translocation; xylem is mainly deeper in the wood.',
          explanation: 'Ringing experiments show the role of phloem in transporting sugars.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Immunity',
      subtopic: 'Specific & non-specific immunity',
      difficulty: 'medium',
      blocks: blocks(
        'Immunity is the body\'s ability to resist infection and disease. Non-specific immunity acts quickly against many pathogens and includes skin, mucus, stomach acid, inflammation and phagocytosis. Specific immunity targets particular antigens using lymphocytes and antibodies. B lymphocytes can produce antibodies, while T lymphocytes can coordinate responses or destroy infected cells. Memory cells remain after an infection and allow a faster response if the same antigen enters again.',
        'When bacteria enter a wound, phagocytes may engulf and digest them as part of non-specific defence. If antigens from the bacteria are recognised by lymphocytes, selected B lymphocytes divide and form plasma cells that release specific antibodies. Some lymphocytes become memory cells. On a second exposure to the same antigen, antibody production is faster and stronger.',
        'Non-specific immunity is not weak; it is the first essential barrier and response. Specific immunity does not attack every pathogen in the same way because it recognises antigens. Antibodies are specific proteins, not living cells. Inflammation is a protective response, although excessive inflammation can damage tissues.',
        '| Term | Meaning |\n|---|---|\n| Immunity (Keimunan) | Ability of the body to resist disease. |\n| Antigen (Antigen) | Foreign molecule that triggers an immune response. |\n| Antibody (Antibodi) | Specific protein that binds to an antigen. |\n| Phagocytosis (Fagositosis) | Engulfing and digesting pathogens by phagocytes. |\n| Memory cell (Sel memori) | Lymphocyte that enables a faster response on re-exposure. |',
        'Remember "barriers first, antibodies specific": non-specific defences block or engulf broadly, while specific immunity recognises antigen shapes.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which is an example of non-specific immunity?',
          options: ['Skin acting as a barrier', 'Antibody specific to measles antigen', 'Memory B cells for one antigen', 'A Punnett square'],
          correct: { optionIndex: 0 },
          explanation: 'Skin is a general physical barrier against many pathogens.',
        },
        {
          type: 'multiple_choice',
          question: 'Which cells produce antibodies?',
          options: ['Red blood cells', 'Platelets', 'B lymphocytes after activation', 'Xylem vessels'],
          correct: { optionIndex: 2 },
          explanation: 'Activated B lymphocytes form plasma cells that secrete antibodies.',
        },
        {
          type: 'true_false',
          question: 'Specific immunity can form memory cells that respond faster during a second exposure.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Memory cells are the basis of long-term specific immunity.',
        },
        {
          type: 'representation_match',
          question: 'Match each immune component with its role.',
          options: [
            { prompt: 'Skin', answer: 'Physical barrier against pathogen entry' },
            { prompt: 'Phagocyte', answer: 'Engulfs and digests pathogens' },
            { prompt: 'B lymphocyte', answer: 'Produces specific antibodies after activation' },
            { prompt: 'Memory cell', answer: 'Responds rapidly to the same antigen later' },
          ],
          correct: {
            Skin: 'Physical barrier against pathogen entry',
            Phagocyte: 'Engulfs and digests pathogens',
            'B lymphocyte': 'Produces specific antibodies after activation',
            'Memory cell': 'Responds rapidly to the same antigen later',
          },
          explanation: 'Immune defence includes both general barriers and antigen-specific cells.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the specific immune response after a new antigen enters the body.',
          options: ['Memory cells remain', 'Specific lymphocyte is activated', 'Antibodies bind to antigen', 'Pathogen antigen is recognised'],
          correct: ['Pathogen antigen is recognised', 'Specific lymphocyte is activated', 'Antibodies bind to antigen', 'Memory cells remain'],
          explanation: 'Recognition and lymphocyte activation occur before antibodies and memory formation.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says all white blood cells make antibodies. Identify the error.',
          options: [],
          correct: 'Only certain activated B lymphocytes form plasma cells that secrete antibodies; other white blood cells have different defence roles.',
          explanation: 'White blood cells include several types with different immune functions.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Immunity',
      subtopic: 'Vaccination & antibiotics',
      difficulty: 'easy',
      blocks: blocks(
        'Vaccination introduces a harmless form or part of a pathogen antigen to stimulate active immunity without causing the full disease. The immune system produces specific antibodies and memory cells, so later exposure to the real pathogen produces a faster response. Booster doses can strengthen or renew immunity. Antibiotics are medicines that kill bacteria or stop their growth, but they do not kill viruses. Incorrect or unnecessary antibiotic use can select resistant bacteria.',
        'A vaccine against a viral disease trains lymphocytes to recognise viral antigens before infection occurs. If the vaccinated person later meets the virus, memory cells respond quickly and reduce the chance of severe disease. In contrast, an antibiotic may be prescribed for a confirmed bacterial infection because it targets bacterial structures or processes. Taking antibiotics for a common cold caused by a virus is ineffective and increases resistance risk.',
        'Vaccines prevent or reduce disease; they are not antibiotics. Antibiotics do not treat viral infections such as influenza. Completing an antibiotic course matters because stopping early may leave more tolerant bacteria alive. Herd immunity reduces spread in a population, but it does not mean every unvaccinated person is fully protected.',
        '| Term | Meaning |\n|---|---|\n| Vaccine (Vaksin) | Preparation containing antigen that stimulates immunity. |\n| Vaccination (Pemvaksinan) | Process of giving a vaccine to induce protection. |\n| Antibiotic (Antibiotik) | Medicine that kills bacteria or inhibits bacterial growth. |\n| Booster dose (Dos penggalak) | Additional vaccine dose that strengthens immune memory. |\n| Antibiotic resistance (Rintangan antibiotik) | Ability of bacteria to survive an antibiotic that used to work. |',
        'Use "V for vaccine before virus, A for antibiotic against bacteria": vaccines prepare immunity; antibiotics act on bacteria.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What does a vaccine mainly stimulate the body to produce?',
          options: ['Memory cells and specific antibodies', 'Extra red blood cells only', 'Digestive enzymes', 'Xylem vessels'],
          correct: { optionIndex: 0 },
          explanation: 'Vaccination induces specific immunity and memory cells.',
        },
        {
          type: 'multiple_choice',
          question: 'Why are antibiotics not used to kill viruses?',
          options: ['Viruses are plant cells', 'Viruses lack the bacterial targets that antibiotics act on', 'Viruses are always helpful', 'Antibiotics are a type of vaccine'],
          correct: { optionIndex: 1 },
          explanation: 'Antibiotics target bacterial structures or processes, not viral replication inside host cells.',
        },
        {
          type: 'true_false',
          question: 'Unnecessary antibiotic use can contribute to antibiotic resistance.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Antibiotic exposure can select bacteria with resistance traits.',
        },
        {
          type: 'representation_match',
          question: 'Match each immunity term with its correct meaning.',
          options: [
            { prompt: 'Vaccine', answer: 'Contains antigen that stimulates immune memory' },
            { prompt: 'Antibiotic', answer: 'Acts against bacteria, not viruses' },
            { prompt: 'Booster dose', answer: 'Strengthens or renews immunity' },
            { prompt: 'Herd immunity', answer: 'Reduced spread when many people are immune' },
          ],
          correct: {
            Vaccine: 'Contains antigen that stimulates immune memory',
            Antibiotic: 'Acts against bacteria, not viruses',
            'Booster dose': 'Strengthens or renews immunity',
            'Herd immunity': 'Reduced spread when many people are immune',
          },
          explanation: 'Vaccination and antibiotics are different tools used in disease prevention and treatment.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the events after a person receives a vaccine.',
          options: ['Memory cells are formed', 'Antigen is introduced safely', 'Specific lymphocytes are activated', 'A faster response occurs during later exposure'],
          correct: ['Antigen is introduced safely', 'Specific lymphocytes are activated', 'Memory cells are formed', 'A faster response occurs during later exposure'],
          explanation: 'Vaccination works by safely triggering immune recognition and memory before real infection.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student stops taking prescribed antibiotics after two days because symptoms improved. Identify the biological risk.',
          options: [],
          correct: 'Some bacteria may survive and resistant strains can be selected, causing the infection to return or spread.',
          explanation: 'Antibiotics should be used as prescribed to reduce treatment failure and resistance.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Reproduction',
      subtopic: 'Male & female reproductive systems',
      difficulty: 'medium',
      blocks: blocks(
        'Human reproduction depends on specialised male and female organs that produce gametes and support fertilisation and development. In males, testes produce sperm and testosterone; the epididymis stores and matures sperm; sperm ducts carry sperm; and accessory glands add fluid to form semen. In females, ovaries produce ova and hormones, oviducts carry ova and are the usual site of fertilisation, and the uterus supports embryo development. The cervix connects the uterus to the vagina. Hormones coordinate gamete production and menstrual cycle changes.',
        'After sperm are produced in the seminiferous tubules of the testes, they mature in the epididymis. During ejaculation, sperm travel through sperm ducts and urethra with fluid from glands. In the female system, ovulation releases an ovum from an ovary into an oviduct. If sperm meet the ovum in the oviduct, fertilisation may occur and the early embryo later moves to the uterus.',
        'Fertilisation normally occurs in the oviduct, not in the uterus. The urethra in males carries semen during ejaculation, but this does not mean urine and semen are released at the same time. The uterus is not the same as the ovary; ovaries produce ova, while the uterus is where implantation and pregnancy occur. Menstruation is the shedding of the uterine lining, not simply the loss of an unfertilised ovum.',
        '| Term | Meaning |\n|---|---|\n| Testis (Testis) | Male organ that produces sperm and testosterone. |\n| Epididymis (Epididimis) | Coiled tube where sperm mature and are stored. |\n| Ovary (Ovari) | Female organ that produces ova and hormones. |\n| Oviduct (Tiub Fallopio) | Tube that carries ovum and is the usual site of fertilisation. |\n| Uterus (Uterus) | Muscular organ where embryo implants and develops. |',
        'Remember "testes make, epididymis matures, ducts deliver; ovaries release, oviduct meets, uterus nurtures".'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which organ produces sperm?',
          options: ['Ovary', 'Testis', 'Uterus', 'Placenta'],
          correct: { optionIndex: 1 },
          explanation: 'The testes produce sperm cells and testosterone.',
        },
        {
          type: 'multiple_choice',
          question: 'Where does fertilisation normally occur in humans?',
          options: ['Oviduct', 'Vagina', 'Uterine wall', 'Ovary surface'],
          correct: { optionIndex: 0 },
          explanation: 'Fertilisation normally occurs in the oviduct.',
        },
        {
          type: 'true_false',
          question: 'The uterus produces ova every month.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Ovaries produce ova; the uterus supports implantation and development.',
        },
        {
          type: 'representation_match',
          question: 'Match each reproductive structure with its function.',
          options: [
            { prompt: 'Testis', answer: 'Produces sperm and testosterone' },
            { prompt: 'Epididymis', answer: 'Stores and matures sperm' },
            { prompt: 'Ovary', answer: 'Produces ova and female sex hormones' },
            { prompt: 'Uterus', answer: 'Supports embryo implantation and development' },
          ],
          correct: {
            Testis: 'Produces sperm and testosterone',
            Epididymis: 'Stores and matures sperm',
            Ovary: 'Produces ova and female sex hormones',
            Uterus: 'Supports embryo implantation and development',
          },
          explanation: 'The reproductive organs have specialised roles in gamete production, transport and development.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the route of sperm from production to release.',
          options: ['Urethra', 'Testis', 'Epididymis', 'Sperm duct'],
          correct: ['Testis', 'Epididymis', 'Sperm duct', 'Urethra'],
          explanation: 'Sperm are produced in the testis, mature in the epididymis and pass through ducts before release.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says menstruation is the release of an ovum from the ovary. Identify the error.',
          options: [],
          correct: 'Menstruation is the shedding of the uterine lining; release of an ovum from the ovary is ovulation.',
          explanation: 'Ovulation and menstruation are different events in the menstrual cycle.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Reproduction',
      subtopic: 'Fertilisation & development',
      difficulty: 'hard',
      blocks: blocks(
        'Fertilisation is the fusion of the nucleus of a sperm with the nucleus of an ovum to form a diploid zygote. In humans, it usually occurs in the oviduct after ovulation and sexual intercourse. The zygote divides by mitosis to form an embryo while moving toward the uterus. Implantation occurs when the embryo embeds in the uterine lining. During pregnancy, the placenta enables exchange of oxygen, nutrients, carbon dioxide and urea between maternal and fetal blood without the two blood supplies normally mixing directly.',
        'After fertilisation, the zygote undergoes repeated mitotic divisions called cleavage. The embryo reaches the uterus and implants in a thick, blood-rich endometrium. The placenta and umbilical cord then support development by transferring oxygen and nutrients to the fetus and removing carbon dioxide and urea. The amnion and amniotic fluid help protect the developing fetus from mechanical shock.',
        'Fertilisation is not the same as implantation. Fertilisation forms a zygote, while implantation attaches the embryo to the uterine lining. Maternal blood and fetal blood are close in the placenta but normally remain separated by a thin barrier. A placenta is not a lung; it is an exchange organ that relies on the mother respiratory and circulatory systems.',
        '| Term | Meaning |\n|---|---|\n| Fertilisation (Persenyawaan) | Fusion of male and female gamete nuclei. |\n| Zygote (Zigot) | First diploid cell formed after fertilisation. |\n| Embryo (Embrio) | Early developing organism after zygote divisions. |\n| Implantation (Penempelan) | Embedding of embryo in the uterine lining. |\n| Placenta (Plasenta) | Exchange organ between mother and fetus during pregnancy. |',
        'Use "FZDI": fertilisation forms zygote, divisions form embryo, implantation anchors it.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What is formed immediately after fertilisation?',
          options: ['Zygote', 'Placenta', 'Gamete', 'Menstrual blood'],
          correct: { optionIndex: 0 },
          explanation: 'Fertilisation forms a diploid zygote.',
        },
        {
          type: 'multiple_choice',
          question: 'Which structure exchanges materials between mother and fetus?',
          options: ['Placenta', 'Epididymis', 'Sperm duct', 'Xylem'],
          correct: { optionIndex: 0 },
          explanation: 'The placenta allows exchange of gases, nutrients and wastes.',
        },
        {
          type: 'true_false',
          question: 'Maternal blood and fetal blood normally mix freely in the placenta.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'The two blood supplies are close but normally separated by a placental barrier.',
        },
        {
          type: 'representation_match',
          question: 'Match each development term with its description.',
          options: [
            { prompt: 'Fertilisation', answer: 'Fusion of sperm and ovum nuclei' },
            { prompt: 'Zygote', answer: 'Diploid cell formed after fertilisation' },
            { prompt: 'Implantation', answer: 'Embryo embeds in uterine lining' },
            { prompt: 'Amniotic fluid', answer: 'Cushions and protects the fetus' },
          ],
          correct: {
            Fertilisation: 'Fusion of sperm and ovum nuclei',
            Zygote: 'Diploid cell formed after fertilisation',
            Implantation: 'Embryo embeds in uterine lining',
            'Amniotic fluid': 'Cushions and protects the fetus',
          },
          explanation: 'Development proceeds through fertilisation, early division, implantation and fetal support.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the early events from ovulation to implantation.',
          options: ['Embryo implants in uterine lining', 'Ovum is released into oviduct', 'Sperm nucleus fuses with ovum nucleus', 'Zygote divides by mitosis'],
          correct: ['Ovum is released into oviduct', 'Sperm nucleus fuses with ovum nucleus', 'Zygote divides by mitosis', 'Embryo implants in uterine lining'],
          explanation: 'The ovum is released first, fertilisation forms a zygote, divisions form an embryo, and implantation occurs in the uterus.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says identical twins are produced when two sperm fertilise the same ovum. Identify the error.',
          options: [],
          correct: 'Identical twins usually form when one fertilised embryo splits; two sperm fertilising one ovum is abnormal and does not produce normal twins.',
          explanation: 'Fraternal twins come from two ova fertilised by two sperm, while identical twins come from one embryo splitting.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Growth',
      subtopic: 'Growth patterns & hormones',
      difficulty: 'medium',
      blocks: blocks(
        'Growth is a permanent and irreversible increase in size, dry mass and number of cells. Humans and many mammals show a sigmoid growth curve with slow growth, rapid growth and a phase where growth slows toward maturity. Insects show intermittent growth because the exoskeleton must be shed during ecdysis before body size can increase. Plant growth occurs mainly at meristems, where cells divide and then elongate and differentiate. Hormones such as growth hormone in humans and auxin in plants regulate growth processes.',
        'A seedling bends toward light because auxin accumulates more on the shaded side of the shoot and stimulates greater cell elongation there. The shaded side grows faster, so the shoot curves toward the light. In an insect, the body may remain almost the same length between moults, then increase suddenly after ecdysis when the new exoskeleton is still soft.',
        'Growth should not be judged only by wet mass because water content can change quickly. A plant that absorbs water may become heavier without making much new living material. Insects do not show a smooth sigmoid body-length curve because their exoskeleton limits continuous expansion. Hormones regulate growth, but they do not replace nutrients, respiration and cell division.',
        '| Term | Meaning |\n|---|---|\n| Growth (Pertumbuhan) | Permanent increase in size, dry mass and cell number. |\n| Sigmoid curve (Lengkung sigmoid) | S-shaped growth curve with slow, rapid and slowing phases. |\n| Ecdysis (Ekdisis) | Shedding of exoskeleton in arthropods. |\n| Meristem (Meristem) | Plant tissue where active cell division occurs. |\n| Auxin (Auksin) | Plant hormone that promotes cell elongation in shoots. |',
        'Remember "divide, elongate, differentiate": cells multiply, enlarge and specialise during growth.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which measurement best indicates true growth in a plant sample?',
          options: ['Dry mass increase', 'Temporary water uptake only', 'Colour of the pot', 'Time of day only'],
          correct: { optionIndex: 0 },
          explanation: 'Dry mass better reflects new biological material than water content alone.',
        },
        {
          type: 'multiple_choice',
          question: 'Why does an insect show intermittent growth?',
          options: ['It has no cells', 'Its exoskeleton must be shed before size increases', 'It has xylem instead of blood', 'It never undergoes mitosis'],
          correct: { optionIndex: 1 },
          explanation: 'The hard exoskeleton restricts growth until ecdysis occurs.',
        },
        {
          type: 'true_false',
          question: 'Auxin can promote cell elongation in plant shoots.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Auxin is involved in shoot elongation and phototropic responses.',
        },
        {
          type: 'representation_match',
          question: 'Match each growth term with its meaning.',
          options: [
            { prompt: 'Lag phase', answer: 'Slow early growth as cells adjust' },
            { prompt: 'Log phase', answer: 'Rapid growth rate' },
            { prompt: 'Ecdysis', answer: 'Moulting of exoskeleton' },
            { prompt: 'Meristem', answer: 'Region of active plant cell division' },
          ],
          correct: {
            'Lag phase': 'Slow early growth as cells adjust',
            'Log phase': 'Rapid growth rate',
            Ecdysis: 'Moulting of exoskeleton',
            Meristem: 'Region of active plant cell division',
          },
          explanation: 'Growth patterns are interpreted using phases, tissues and developmental processes.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for investigating seedling growth accurately.',
          options: ['Record measurements at fixed intervals', 'Choose a suitable growth variable such as height or dry mass', 'Plot the data against time', 'Interpret the growth pattern'],
          correct: ['Choose a suitable growth variable such as height or dry mass', 'Record measurements at fixed intervals', 'Plot the data against time', 'Interpret the growth pattern'],
          explanation: 'A valid growth investigation uses a suitable variable, repeated measurements and a graph over time.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student concludes a plant doubled its growth because its wet mass doubled after watering. Identify the error.',
          options: [],
          correct: 'Wet mass can increase because of water uptake, so it does not necessarily show a doubling of new dry biological material.',
          explanation: 'Dry mass is a more reliable indicator of true growth.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Heredity',
      subtopic: 'Mendel\'s laws',
      difficulty: 'medium',
      blocks: blocks(
        'Mendel studied inheritance using pea plants and proposed that traits are controlled by paired factors now called alleles. The law of segregation states that the two alleles for a gene separate during gamete formation, so each gamete receives only one allele. A dominant allele can mask a recessive allele in a heterozygote. The law of independent assortment states that alleles of different genes assort independently during gamete formation when the genes are not linked. These laws explain predictable ratios in many monohybrid and dihybrid crosses.',
        'For a monohybrid cross between two heterozygous tall pea plants, Tt x Tt, each parent produces gametes T and t. The Punnett square gives TT, Tt, Tt and tt. If T is dominant for tallness, the phenotype ratio is 3 tall : 1 dwarf, while the genotype ratio is 1 TT : 2 Tt : 1 tt.',
        'Dominant does not mean stronger, better or more common in a population. Recessive alleles can be common, and dominant alleles can be rare. Mendel ratios are probabilities, so small families or small plant samples may not show the exact ratio. Independent assortment does not strictly apply to genes that are linked close together on the same chromosome.',
        '| Term | Meaning |\n|---|---|\n| Allele (Alel) | Alternative form of a gene. |\n| Dominant allele (Alel dominan) | Allele expressed in a heterozygote. |\n| Recessive allele (Alel resesif) | Allele expressed only when no dominant allele is present. |\n| Segregation (Segregasi) | Separation of allele pairs during gamete formation. |\n| Independent assortment (Pengaturan bebas) | Random assortment of alleles of different unlinked genes. |',
        'Use "pairs split, gametes get one": Mendel segregation means each gamete receives one allele from each pair.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What does Mendel\'s law of segregation state?',
          options: ['Allele pairs separate during gamete formation', 'All traits are controlled by one chromosome only', 'Dominant alleles are always more common', 'Gametes contain both alleles for every gene'],
          correct: { optionIndex: 0 },
          explanation: 'Segregation means each gamete receives one allele from an allele pair.',
        },
        {
          type: 'multiple_choice',
          question: 'In a heterozygote Tt, what happens if T is dominant over t?',
          options: ['Only the recessive trait is expressed', 'The dominant trait is expressed', 'Both alleles disappear', 'No gametes can form'],
          correct: { optionIndex: 1 },
          explanation: 'A dominant allele is expressed in the heterozygous condition.',
        },
        {
          type: 'true_false',
          question: 'Mendel\'s law of independent assortment applies perfectly to all genes, including genes linked close together on the same chromosome.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Linked genes close together on the same chromosome may not assort independently.',
        },
        {
          type: 'representation_match',
          question: 'Match each Punnett square pairing with the expected offspring result for a single gene where T is dominant over t.',
          options: [
            { prompt: 'TT x tt', answer: 'All offspring are Tt and show the dominant trait' },
            { prompt: 'Tt x Tt', answer: 'Genotype ratio 1 TT : 2 Tt : 1 tt' },
            { prompt: 'Tt x tt', answer: 'Half Tt dominant phenotype and half tt recessive phenotype' },
            { prompt: 'tt x tt', answer: 'All offspring are tt and show the recessive trait' },
          ],
          correct: {
            'TT x tt': 'All offspring are Tt and show the dominant trait',
            'Tt x Tt': 'Genotype ratio 1 TT : 2 Tt : 1 tt',
            'Tt x tt': 'Half Tt dominant phenotype and half tt recessive phenotype',
            'tt x tt': 'All offspring are tt and show the recessive trait',
          },
          explanation: 'Punnett square pairings show allele combinations produced by parental gametes.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for solving a monohybrid genetic cross.',
          options: ['Fill the Punnett square and read ratios', 'Write parental genotypes', 'Determine possible gametes', 'State genotype and phenotype outcomes'],
          correct: ['Write parental genotypes', 'Determine possible gametes', 'Fill the Punnett square and read ratios', 'State genotype and phenotype outcomes'],
          explanation: 'The parent genotypes determine gametes, which determine offspring combinations.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says a dominant allele is always the most common allele in a population. Identify the error.',
          options: [],
          correct: 'Dominance describes expression in a heterozygote, not how common an allele is in a population.',
          explanation: 'Allele frequency and dominance are different ideas.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Heredity',
      subtopic: 'Genetics terminology & crosses',
      difficulty: 'hard',
      blocks: blocks(
        'Genetic crosses use precise terms to connect alleles with observable traits. A genotype is the allele combination an organism has, while a phenotype is the visible or measurable expression of a trait. Homozygous individuals have two identical alleles, such as AA or aa, while heterozygous individuals have two different alleles, such as Aa. A Punnett square organises gametes from each parent to predict possible offspring genotypes. Test crosses can help identify whether an individual showing a dominant phenotype is homozygous dominant or heterozygous.',
        'Suppose purple flower colour P is dominant over white p. A cross Pp x pp gives parental gametes P and p from the first parent and p from the second parent. The offspring are Pp and pp in a 1:1 ratio, so about half are purple and half are white. This result shows why a recessive homozygous tester can reveal the genotype of an individual with a dominant phenotype.',
        'Phenotype is not always determined by genotype alone; environment can influence traits such as height and skin tanning. A Punnett square gives probabilities, not guaranteed outcomes for every small family. Heterozygous does not mean weak or mixed-looking in simple dominance; the dominant phenotype is expressed. A test cross uses a homozygous recessive individual, not another unknown dominant individual.',
        '| Term | Meaning |\n|---|---|\n| Genotype (Genotip) | Allele combination of an organism. |\n| Phenotype (Fenotip) | Observable expression of a trait. |\n| Homozygous (Homozigot) | Having two identical alleles for a gene. |\n| Heterozygous (Heterozigot) | Having two different alleles for a gene. |\n| Test cross (Kacukan uji) | Cross with a homozygous recessive individual to infer genotype. |',
        'Remember "geno is genes, pheno is face": genotype is allele makeup, phenotype is what is expressed or measured.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which term means the allele combination of an organism?',
          options: ['Phenotype', 'Genotype', 'Gamete', 'Antibody'],
          correct: { optionIndex: 1 },
          explanation: 'Genotype refers to the alleles an organism carries.',
        },
        {
          type: 'multiple_choice',
          question: 'Which genotype is heterozygous?',
          options: ['AA', 'aa', 'Aa', 'TT and TT only'],
          correct: { optionIndex: 2 },
          explanation: 'Heterozygous means having two different alleles, such as Aa.',
        },
        {
          type: 'true_false',
          question: 'Phenotype can be influenced by both genotype and environment.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Many traits are influenced by genes and environmental conditions.',
        },
        {
          type: 'representation_match',
          question: 'Match each Punnett square pairing with the expected result where A is dominant over a.',
          options: [
            { prompt: 'AA x aa', answer: 'All Aa offspring show the dominant phenotype' },
            { prompt: 'Aa x Aa', answer: 'Phenotype ratio 3 dominant : 1 recessive' },
            { prompt: 'Aa x aa', answer: 'Phenotype ratio 1 dominant : 1 recessive' },
            { prompt: 'aa x aa', answer: 'All offspring show the recessive phenotype' },
          ],
          correct: {
            'AA x aa': 'All Aa offspring show the dominant phenotype',
            'Aa x Aa': 'Phenotype ratio 3 dominant : 1 recessive',
            'Aa x aa': 'Phenotype ratio 1 dominant : 1 recessive',
            'aa x aa': 'All offspring show the recessive phenotype',
          },
          explanation: 'These common Punnett square pairings connect genotype combinations with expected phenotype ratios.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for drawing and using a Punnett square.',
          options: ['Combine gametes in the boxes', 'Write possible gametes from each parent on the square edges', 'Calculate genotype and phenotype ratios', 'Identify the parental genotypes'],
          correct: ['Identify the parental genotypes', 'Write possible gametes from each parent on the square edges', 'Combine gametes in the boxes', 'Calculate genotype and phenotype ratios'],
          explanation: 'A Punnett square starts from parental genotypes and ends with offspring probability ratios.',
        },
        {
          type: 'error_diagnosis',
          question: 'For the cross Pp x pp, a student predicts 75% dominant phenotype. Identify the error.',
          options: [],
          correct: 'The student used the 3:1 result for Pp x Pp; Pp x pp gives a 1 dominant : 1 recessive phenotype ratio.',
          explanation: 'A heterozygote crossed with a homozygous recessive produces half heterozygous and half homozygous recessive offspring.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Variation',
      subtopic: 'Continuous vs discontinuous variation',
      difficulty: 'easy',
      blocks: blocks(
        'Variation means differences in characteristics among individuals of the same species. Continuous variation shows a range of values between two extremes and is usually controlled by many genes plus environmental effects. Examples include height, body mass and skin colour. Discontinuous variation has distinct categories with no intermediate values, such as ABO blood group and ability to roll the tongue in simple classroom examples. Variation provides raw material for natural selection and helps populations adapt.',
        'If the heights of students in a class are measured, the data usually form a range and may produce a bell-shaped distribution when many individuals are sampled. This is continuous variation because height is affected by many genes and environmental factors such as nutrition. ABO blood group is discontinuous because a person belongs to category A, B, AB or O, with no value halfway between A and B.',
        'Do not assume every trait is purely genetic. Environment can strongly affect continuous traits such as height and body mass. Discontinuous variation is not always controlled by only one gene, but it still appears as clear categories. A bar chart is usually more suitable for categories, while a histogram is suitable for grouped continuous measurements.',
        '| Term | Meaning |\n|---|---|\n| Variation (Variasi) | Differences in characteristics among individuals. |\n| Continuous variation (Variasi selanjar) | Variation with a range of intermediate values. |\n| Discontinuous variation (Variasi tak selanjar) | Variation with distinct categories. |\n| Genetic variation (Variasi genetik) | Variation caused by differences in genes or alleles. |\n| Environmental variation (Variasi persekitaran) | Variation caused by environmental factors. |',
        'Use "continuous can be measured, discontinuous can be counted in categories".'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which trait is an example of continuous variation?',
          options: ['Human height', 'ABO blood group', 'Sex chromosome pattern only', 'Presence of a particular blood group category'],
          correct: { optionIndex: 0 },
          explanation: 'Height varies over a range and is affected by many genes and the environment.',
        },
        {
          type: 'multiple_choice',
          question: 'Which graph is usually suitable for discontinuous categories such as blood group?',
          options: ['Bar chart', 'Smooth line through every measurement', 'Distance-time graph only', 'Punnett square only'],
          correct: { optionIndex: 0 },
          explanation: 'A bar chart compares separate categories.',
        },
        {
          type: 'true_false',
          question: 'Continuous variation is often influenced by many genes and environmental factors.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Polygenic inheritance and environment commonly produce continuous ranges.',
        },
        {
          type: 'representation_match',
          question: 'Match each variation term with the correct example or meaning.',
          options: [
            { prompt: 'Continuous variation', answer: 'Height measured across a range' },
            { prompt: 'Discontinuous variation', answer: 'ABO blood group categories' },
            { prompt: 'Genetic variation', answer: 'Difference caused by alleles inherited from parents' },
            { prompt: 'Environmental variation', answer: 'Difference caused by nutrition or surroundings' },
          ],
          correct: {
            'Continuous variation': 'Height measured across a range',
            'Discontinuous variation': 'ABO blood group categories',
            'Genetic variation': 'Difference caused by alleles inherited from parents',
            'Environmental variation': 'Difference caused by nutrition or surroundings',
          },
          explanation: 'Variation can be classified by pattern and by cause.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the steps for studying height variation in a class.',
          options: ['Group the heights into suitable class intervals', 'Measure height using the same method for all students', 'Plot a histogram', 'Interpret the spread and most common range'],
          correct: ['Measure height using the same method for all students', 'Group the heights into suitable class intervals', 'Plot a histogram', 'Interpret the spread and most common range'],
          explanation: 'Continuous data should be measured consistently, grouped and plotted before interpretation.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student draws a smooth histogram for ABO blood groups and says blood group is continuous. Identify the error.',
          options: [],
          correct: 'ABO blood group has distinct categories, so it is discontinuous variation and is better shown with a bar chart.',
          explanation: 'There are no intermediate ABO blood group values.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Biotechnology',
      subtopic: 'Genetic engineering overview',
      difficulty: 'hard',
      blocks: blocks(
        'Genetic engineering is the deliberate modification of genetic material to give an organism a desired characteristic or product. A useful gene is identified and cut using restriction enzymes, then inserted into a vector such as a plasmid using DNA ligase. The recombinant vector is introduced into a host cell, which may express the gene and produce the desired protein. Selection methods identify host cells that successfully received the recombinant DNA. This technology is used in medicine, agriculture and research, but it requires biosafety and ethical evaluation.',
        'To produce human insulin using bacteria, the human insulin gene is isolated and inserted into a bacterial plasmid. The recombinant plasmid is transferred into bacterial cells. Bacteria that contain the plasmid are selected and grown in fermenters, where they express the insulin gene. The insulin protein is then harvested and purified for medical use.',
        'Restriction enzymes cut DNA; DNA ligase joins DNA fragments. A plasmid is a vector, not the gene itself. Genetic engineering does not create traits from nothing; it changes or adds DNA instructions. A genetically modified organism must be assessed for safety, environmental impact and ethical concerns before use.',
        '| Term | Meaning |\n|---|---|\n| Genetic engineering (Kejuruteraan genetik) | Direct modification of an organism\'s genetic material. |\n| Restriction enzyme (Enzim pembatasan) | Enzyme that cuts DNA at specific sequences. |\n| DNA ligase (DNA ligase) | Enzyme that joins DNA fragments. |\n| Plasmid (Plasmid) | Small circular DNA molecule used as a vector in bacteria. |\n| Recombinant DNA (DNA rekombinan) | DNA formed by combining genetic material from different sources. |',
        'Remember "cut, join, carry, clone, express": restriction enzyme cuts, ligase joins, vector carries, host cells multiply and express the gene.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What is the role of a restriction enzyme in genetic engineering?',
          options: ['Cut DNA at specific sequences', 'Join amino acids into protein', 'Pump blood through vessels', 'Destroy all plasmids'],
          correct: { optionIndex: 0 },
          explanation: 'Restriction enzymes cut DNA at specific recognition sites.',
        },
        {
          type: 'multiple_choice',
          question: 'Which molecule is commonly used as a vector in bacterial genetic engineering?',
          options: ['Plasmid', 'Haemoglobin', 'Antibody only', 'Urea'],
          correct: { optionIndex: 0 },
          explanation: 'Plasmids are small circular DNA molecules that can carry inserted genes into bacteria.',
        },
        {
          type: 'true_false',
          question: 'DNA ligase is used to join DNA fragments together.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'DNA ligase forms bonds that join DNA fragments.',
        },
        {
          type: 'scenario',
          question: 'A laboratory has isolated a human insulin gene and a bacterial plasmid. What key action should be done to make recombinant DNA before transformation?',
          options: [],
          correct: 'Insert the insulin gene into the plasmid using compatible cuts and DNA ligase.',
          explanation: 'The desired gene must be joined into a vector before the recombinant plasmid is introduced into bacteria.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the main stages of producing a recombinant protein in bacteria.',
          options: ['Select transformed bacteria', 'Insert the gene into a plasmid vector', 'Grow bacteria and harvest the protein', 'Isolate the desired gene'],
          correct: ['Isolate the desired gene', 'Insert the gene into a plasmid vector', 'Select transformed bacteria', 'Grow bacteria and harvest the protein'],
          explanation: 'The gene must be isolated and inserted before host cells are selected and cultured.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says DNA ligase cuts the plasmid open and restriction enzymes glue the insulin gene into it. Identify the error.',
          options: [],
          correct: 'The enzyme roles are reversed; restriction enzymes cut DNA and DNA ligase joins DNA fragments.',
          explanation: 'Correct enzyme roles are essential for explaining recombinant DNA formation.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Biotechnology',
      subtopic: 'Applications in medicine & agriculture',
      difficulty: 'medium',
      blocks: blocks(
        'Biotechnology applies biological knowledge and organisms to produce useful goods and services. In medicine, genetic engineering can produce human insulin, some vaccines, clotting factors and diagnostic tools. In agriculture, biotechnology can produce crops with resistance to pests, herbicides or diseases, and can improve shelf life or nutritional value. Tissue culture can rapidly produce many genetically identical plants with desirable traits. These applications must be balanced with biosafety, biodiversity, food safety and social concerns.',
        'Recombinant insulin is produced by inserting the human insulin gene into bacteria or yeast so they make insulin protein. This provides a reliable supply for people with diabetes. In agriculture, a crop variety may be engineered for pest resistance so that fewer insecticide sprays are needed. However, field use should include monitoring to reduce resistance development and protect non-target organisms.',
        'Biotechnology is not automatically good or bad; each application must be judged using evidence. A genetically modified crop is not the same as a pesticide, although it may reduce pesticide use in some cases. Tissue culture clones are uniform, which is useful for quality but can reduce genetic diversity if overused. Medical biotechnology products still require purification, dosage control and safety testing.',
        '| Term | Meaning |\n|---|---|\n| Biotechnology (Bioteknologi) | Use of organisms, cells or biological molecules for useful applications. |\n| Recombinant insulin (Insulin rekombinan) | Human insulin made using genetically engineered microbes. |\n| Tissue culture (Kultur tisu) | Growth of cells or tissues under sterile conditions to produce new organisms. |\n| Genetically modified crop (Tanaman terubah suai genetik) | Crop with DNA deliberately modified for a desired trait. |\n| Biosafety (Biokeselamatan) | Measures to reduce risks to health and the environment. |',
        'Use "medicine makes molecules, agriculture improves traits": biotechnology can produce proteins for treatment and traits for farming.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'Which is a medical application of biotechnology?',
          options: ['Production of recombinant human insulin', 'Opening heart valves', 'Transpiration in xylem', 'Formation of a blood clot only'],
          correct: { optionIndex: 0 },
          explanation: 'Recombinant insulin is a major medical product of genetic engineering.',
        },
        {
          type: 'multiple_choice',
          question: 'What is one advantage of plant tissue culture?',
          options: ['It rapidly produces many identical plants with desired traits', 'It guarantees unlimited genetic diversity', 'It replaces photosynthesis', 'It produces red blood cells'],
          correct: { optionIndex: 0 },
          explanation: 'Tissue culture can clone many plants quickly under sterile conditions.',
        },
        {
          type: 'true_false',
          question: 'Every biotechnology product should be assessed for safety and ethical issues before wide use.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Biosafety and ethical review are important for medical and agricultural biotechnology.',
        },
        {
          type: 'scenario',
          question: 'A farmer has severe crop damage by a specific insect pest. Which biotechnology approach could reduce losses while still needing environmental monitoring?',
          options: [],
          correct: 'Use a pest-resistant genetically modified crop after biosafety assessment and resistance monitoring.',
          explanation: 'Pest-resistant crops can reduce insect damage, but they require careful management to protect ecosystems and slow resistance.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the general workflow for producing recombinant insulin for medicine.',
          options: ['Purify and test the insulin protein', 'Insert human insulin gene into a microbial vector', 'Grow selected engineered microbes', 'Identify and isolate the insulin gene'],
          correct: ['Identify and isolate the insulin gene', 'Insert human insulin gene into a microbial vector', 'Grow selected engineered microbes', 'Purify and test the insulin protein'],
          explanation: 'Medical production requires gene insertion, microbial expression, purification and quality testing.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says tissue culture always increases genetic variation because it makes many plants quickly. Identify the error.',
          options: [],
          correct: 'Tissue culture usually produces clones that are genetically identical, so it can reduce variation if relied on too heavily.',
          explanation: 'Cloning is useful for uniformity but does not create broad genetic diversity.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Homeostasis',
      subtopic: 'Osmoregulation & thermoregulation',
      difficulty: 'hard',
      blocks: blocks(
        'Homeostasis keeps the internal environment within narrow limits despite external changes. Osmoregulation controls water potential and solute concentration of body fluids, mainly through the kidneys and the hormone ADH. When blood becomes too concentrated, more ADH is released, causing kidney tubules and collecting ducts to reabsorb more water and produce a smaller volume of concentrated urine. Thermoregulation keeps body temperature near the normal range through the hypothalamus, skin, muscles and hormones. Negative feedback reverses deviations from the set point.',
        'On a hot day, thermoreceptors detect a rise in body temperature and the hypothalamus coordinates responses. Sweat glands produce more sweat, and evaporation removes heat from the skin. Skin arterioles dilate so more warm blood flows near the skin surface, increasing heat loss. If the body is dehydrated, ADH secretion increases so more water is reabsorbed by the kidneys and urine becomes more concentrated.',
        'ADH does not add water to the blood directly; it changes kidney tubule permeability so more water is reabsorbed. Sweating cools mainly when sweat evaporates, not simply when it appears on the skin. Vasodilation increases heat loss, while vasoconstriction reduces heat loss. Negative feedback does not amplify a change; it counteracts the change.',
        '| Term | Meaning |\n|---|---|\n| Homeostasis (Homeostasis) | Maintenance of a stable internal environment. |\n| Osmoregulation (Pengosmokawalaturan) | Regulation of water and solute concentration in body fluids. |\n| ADH (Hormon antidiuresis) | Hormone that increases water reabsorption in kidneys. |\n| Thermoregulation (Termoregulasi) | Regulation of body temperature. |\n| Negative feedback (Maklum balas negatif) | Control mechanism that reverses a change from the set point. |',
        'Remember "too concentrated, add ADH; too hot, lose heat": ADH saves water, sweating and vasodilation release heat.'
      ),
      questions: [
        {
          type: 'multiple_choice',
          question: 'What is the effect of increased ADH on the kidneys?',
          options: ['Less water is reabsorbed and urine becomes dilute', 'More water is reabsorbed and urine becomes concentrated', 'Red blood cells are destroyed', 'Sweat glands stop existing'],
          correct: { optionIndex: 1 },
          explanation: 'ADH increases water reabsorption, producing a smaller volume of concentrated urine.',
        },
        {
          type: 'multiple_choice',
          question: 'Which response increases heat loss from the body?',
          options: ['Vasodilation of skin arterioles', 'Shivering', 'Vasoconstriction of skin arterioles', 'Reduced sweating'],
          correct: { optionIndex: 0 },
          explanation: 'Vasodilation brings more warm blood near the skin surface, increasing heat loss.',
        },
        {
          type: 'true_false',
          question: 'Negative feedback reverses changes away from a normal set point.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Negative feedback counteracts deviations and helps restore normal conditions.',
        },
        {
          type: 'representation_match',
          question: 'Match each homeostasis term with its role.',
          options: [
            { prompt: 'Osmoregulation', answer: 'Controls water and solute concentration' },
            { prompt: 'Thermoregulation', answer: 'Controls body temperature' },
            { prompt: 'ADH', answer: 'Increases water reabsorption in kidneys' },
            { prompt: 'Hypothalamus', answer: 'Coordinates temperature regulation responses' },
          ],
          correct: {
            Osmoregulation: 'Controls water and solute concentration',
            Thermoregulation: 'Controls body temperature',
            ADH: 'Increases water reabsorption in kidneys',
            Hypothalamus: 'Coordinates temperature regulation responses',
          },
          explanation: 'Homeostasis uses receptors, control centres, hormones and effectors to maintain stability.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Arrange the response when blood water potential is too low.',
          options: ['More water is reabsorbed by kidney tubules and collecting ducts', 'Pituitary gland releases more ADH', 'Hypothalamus detects concentrated blood', 'Urine becomes more concentrated and blood water level rises'],
          correct: ['Hypothalamus detects concentrated blood', 'Pituitary gland releases more ADH', 'More water is reabsorbed by kidney tubules and collecting ducts', 'Urine becomes more concentrated and blood water level rises'],
          explanation: 'Detection leads to ADH release, kidney response and restoration by negative feedback.',
        },
        {
          type: 'error_diagnosis',
          question: 'A student says skin arterioles dilate on a cold day to conserve heat. Identify the error.',
          options: [],
          correct: 'On a cold day skin arterioles constrict to reduce heat loss; dilation increases heat loss and is more useful when hot.',
          explanation: 'Vasoconstriction keeps more blood away from the skin surface in cold conditions.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      `${lesson.topic}: ${lesson.subtopic}`,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.question,
        question.options || [],
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm5Chemistry(client) {
  const subject = 'Kimia';
  const formLevel = 5;
  const trueFalseOptions = ['true', 'false'];

  const lessons = [
    {
      topic: 'Rate of Reaction',
      subtopic: 'Factors affecting rate',
      title: 'Kadar Tindak Balas: Faktor yang Mempengaruhi Kadar',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Kadar tindak balas ialah perubahan kuantiti bahan tindak balas atau hasil tindak balas dalam satu unit masa. Kadar boleh diukur melalui perubahan jisim, isipadu gas, keamatan warna, pembentukan mendakan atau perubahan pH. Faktor utama yang mempengaruhi kadar ialah saiz zarah, kepekatan larutan, suhu, tekanan bagi gas dan kehadiran mangkin. Faktor ini mengubah kekerapan perlanggaran berkesan antara zarah.'
        ),
        section(
          'Contoh kerja',
          'Apabila ketulan marmar bertindak balas dengan asid hidroklorik, gas karbon dioksida terbebas. Serbuk marmar bertindak balas lebih cepat berbanding ketulan besar kerana jumlah luas permukaan yang terdedah lebih besar. Jika jumlah kalsium karbonat yang digunakan sama, jumlah gas akhir tetap sama, tetapi masa untuk menghasilkan gas itu menjadi lebih singkat.'
        ),
        section(
          'Awas salah faham',
          'Kadar tindak balas yang lebih tinggi tidak semestinya menghasilkan lebih banyak hasil akhir. Jumlah hasil bergantung pada jumlah mol bahan tindak balas dan bahan pengehad. Saiz zarah, suhu, kepekatan dan mangkin biasanya mengubah kelajuan tindak balas, bukan nisbah stoikiometri persamaan kimia.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Kadar tindak balas | Perubahan kuantiti bahan tindak balas atau hasil per unit masa |
| Luas permukaan | Jumlah kawasan pepejal yang terdedah kepada bahan tindak balas |
| Kepekatan | Kuantiti zarah terlarut dalam satu unit isipadu larutan |
| Tekanan gas | Kekerapan zarah gas berlanggar dengan dinding bekas dan antara satu sama lain |
| Bahan pengehad | Bahan tindak balas yang habis dahulu dan menentukan jumlah hasil maksimum |`
        ),
        section(
          'Cara ingat',
          'Ingat L-K-S-T-M: luas permukaan, kepekatan, suhu, tekanan dan mangkin. Semuanya menambah peluang perlanggaran berkesan, kecuali jumlah hasil akhir masih ditentukan oleh mol bahan tindak balas.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud kadar tindak balas?',
          options: [
            'Jumlah hasil maksimum yang boleh terbentuk',
            'Perubahan kuantiti bahan tindak balas atau hasil dalam satu unit masa',
            'Jumlah tenaga yang tersimpan dalam ikatan kimia',
            'Bilangan unsur dalam satu sebatian',
          ],
          correct: { optionIndex: 1 },
          explanation: 'Kadar tindak balas mengukur perubahan kuantiti bahan terhadap masa.',
        },
        {
          type: 'multiple_choice',
          text: 'Mengapakah serbuk kalsium karbonat bertindak balas lebih cepat dengan asid berbanding ketulan besar yang sama jisim?',
          options: [
            'Serbuk mempunyai takat lebur lebih rendah',
            'Serbuk mempunyai jumlah luas permukaan lebih besar',
            'Serbuk menghasilkan gas yang berlainan',
            'Serbuk menukar persamaan kimia tindak balas',
          ],
          correct: { optionIndex: 1 },
          explanation: 'Luas permukaan lebih besar menyebabkan lebih banyak zarah terdedah kepada perlanggaran.',
        },
        {
          type: 'true_false',
          text: 'Jika jumlah kalsium karbonat sama, menukarkan ketulan kepada serbuk biasanya meningkatkan kadar tindak balas tetapi tidak semestinya menambah jumlah gas akhir.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Saiz zarah mempengaruhi kelajuan tindak balas, manakala jumlah gas akhir bergantung pada jumlah mol bahan tindak balas.',
        },
        {
          type: 'data_interpret',
          text: 'Graf isipadu gas melawan masa bagi tindak balas marmar dengan asid memberikan data: 0 s = 0 cm3, 20 s = 18 cm3, 40 s = 30 cm3, 60 s = 38 cm3, 80 s = 42 cm3. Selang masa manakah menunjukkan kadar purata paling tinggi?',
          options: [],
          correct: '0-20 s',
          explanation: 'Pertambahan gas paling besar berlaku pada 0-20 s, iaitu 18 cm3 dalam 20 s. Selang selepas itu mempunyai pertambahan yang semakin kecil.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyiasat kesan kepekatan asid terhadap kadar tindak balas dengan marmar.',
          options: [
            'Ulang eksperimen dengan asid yang berlainan kepekatan tetapi isipadu sama',
            'Masukkan jisim marmar yang sama ke dalam kelalang',
            'Ukur isipadu gas karbon dioksida pada selang masa tetap',
            'Sediakan larutan asid hidroklorik dengan kepekatan tertentu',
          ],
          correct: [
            'Sediakan larutan asid hidroklorik dengan kepekatan tertentu',
            'Masukkan jisim marmar yang sama ke dalam kelalang',
            'Ukur isipadu gas karbon dioksida pada selang masa tetap',
            'Ulang eksperimen dengan asid yang berlainan kepekatan tetapi isipadu sama',
          ],
          explanation: 'Pemboleh ubah dimanipulasi ialah kepekatan, manakala jisim marmar dan isipadu asid perlu dikawal.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid menyatakan bahawa serbuk marmar menghasilkan lebih banyak karbon dioksida daripada ketulan marmar yang sama jisim kerana tindak balasnya lebih cepat. Apakah ralatnya?',
          options: [],
          correct: 'Serbuk marmar hanya meningkatkan kadar tindak balas melalui luas permukaan yang lebih besar; jumlah karbon dioksida akhir ditentukan oleh jumlah mol kalsium karbonat dan bahan pengehad.',
          explanation: 'Kelajuan tindak balas dan jumlah hasil akhir ialah dua perkara berbeza.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Rate of Reaction',
      subtopic: 'Collision theory & catalysts',
      title: 'Kadar Tindak Balas: Teori Perlanggaran dan Mangkin',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Teori perlanggaran menyatakan bahawa tindak balas berlaku apabila zarah berlanggar dengan tenaga yang cukup dan orientasi yang sesuai. Perlanggaran yang memenuhi syarat ini disebut perlanggaran berkesan. Tenaga pengaktifan ialah tenaga minimum yang diperlukan untuk memulakan tindak balas. Mangkin menyediakan laluan tindak balas alternatif dengan tenaga pengaktifan yang lebih rendah.'
        ),
        section(
          'Contoh kerja',
          'Dalam penguraian hidrogen peroksida, mangan(IV) oksida boleh bertindak sebagai mangkin. Apabila mangkin ditambah, oksigen terbentuk dengan lebih cepat kerana lebih banyak zarah mempunyai tenaga mencukupi untuk bertindak balas. Mangkin tidak habis digunakan, jadi ia boleh diperoleh semula pada akhir tindak balas.'
        ),
        section(
          'Awas salah faham',
          'Mangkin tidak menaikkan suhu campuran dan tidak menambah tenaga zarah secara terus. Mangkin juga tidak mengubah kedudukan keseimbangan atau jumlah hasil maksimum bagi tindak balas boleh balik. Dalam graf isipadu gas melawan masa, mangkin menghasilkan cerun awal yang lebih curam tetapi isipadu akhir yang sama jika jumlah bahan tindak balas sama.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Perlanggaran berkesan | Perlanggaran yang menghasilkan tindak balas kimia |
| Tenaga pengaktifan | Tenaga minimum yang mesti dicapai untuk tindak balas berlaku |
| Orientasi | Arah susunan zarah semasa berlanggar |
| Mangkin | Bahan yang meningkatkan kadar tindak balas tanpa habis digunakan |
| Laluan alternatif | Mekanisme tindak balas dengan tenaga pengaktifan lebih rendah |`
        ),
        section(
          'Cara ingat',
          'Ingat "cukup tenaga, arah kena". Mangkin pula seperti laluan bukit yang lebih rendah: lebih ramai zarah boleh melepasi halangan tenaga.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah syarat utama bagi perlanggaran berkesan?',
          options: [
            'Zarah mesti berlanggar dengan tenaga mencukupi dan orientasi sesuai',
            'Zarah mesti berada dalam keadaan pepejal sahaja',
            'Zarah mesti mempunyai jisim yang sama',
            'Zarah mesti bergerak pada kelajuan sifar',
          ],
          correct: { optionIndex: 0 },
          explanation: 'Perlanggaran berkesan memerlukan tenaga sekurang-kurangnya tenaga pengaktifan serta orientasi yang betul.',
        },
        {
          type: 'multiple_choice',
          text: 'Bagaimanakah mangkin meningkatkan kadar tindak balas?',
          options: [
            'Dengan menaikkan tenaga pengaktifan',
            'Dengan menyediakan laluan tindak balas alternatif yang mempunyai tenaga pengaktifan lebih rendah',
            'Dengan menukar hasil tindak balas kepada unsur lain',
            'Dengan menghapuskan semua perlanggaran antara zarah',
          ],
          correct: { optionIndex: 1 },
          explanation: 'Mangkin menurunkan halangan tenaga supaya lebih banyak perlanggaran menjadi berkesan.',
        },
        {
          type: 'true_false',
          text: 'Mangkin biasanya tidak habis digunakan dalam tindak balas kimia.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Mangkin mengambil bahagian dalam mekanisme tindak balas tetapi dijana semula pada akhir tindak balas.',
        },
        {
          type: 'data_interpret',
          text: 'Dua lengkung isipadu gas melawan masa mencapai isipadu akhir 50 cm3. Lengkung A mencapai 50 cm3 selepas 40 s, manakala lengkung B selepas 90 s. Jika hanya satu eksperimen menggunakan mangkin, lengkung manakah lebih mungkin menggunakan mangkin?',
          options: [],
          correct: 'A',
          explanation: 'Mangkin meningkatkan kadar tindak balas, jadi grafnya lebih curam dan mencapai isipadu akhir yang sama dalam masa lebih singkat.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun penerangan kesan kenaikan suhu berdasarkan teori perlanggaran.',
          options: [
            'Bilangan perlanggaran berkesan per saat meningkat',
            'Kadar tindak balas meningkat',
            'Zarah bergerak lebih laju dan mempunyai tenaga kinetik lebih tinggi',
            'Lebih banyak zarah mencapai atau melebihi tenaga pengaktifan',
          ],
          correct: [
            'Zarah bergerak lebih laju dan mempunyai tenaga kinetik lebih tinggi',
            'Lebih banyak zarah mencapai atau melebihi tenaga pengaktifan',
            'Bilangan perlanggaran berkesan per saat meningkat',
            'Kadar tindak balas meningkat',
          ],
          explanation: 'Suhu lebih tinggi meningkatkan tenaga kinetik, lalu menambah perlanggaran berkesan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata mangkin mempercepat tindak balas kerana mangkin membekalkan tenaga kepada zarah. Apakah ralatnya?',
          options: [],
          correct: 'Mangkin tidak membekalkan tenaga kepada zarah; mangkin menyediakan laluan alternatif dengan tenaga pengaktifan yang lebih rendah.',
          explanation: 'Kesan mangkin diterangkan melalui penurunan tenaga pengaktifan, bukan penambahan tenaga zarah.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Carbon Compounds',
      subtopic: 'Alkanes & alkenes',
      title: 'Sebatian Karbon: Alkana dan Alkena',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Alkana dan alkena ialah hidrokarbon, iaitu sebatian yang mengandungi karbon dan hidrogen sahaja. Alkana ialah hidrokarbon tepu yang mempunyai ikatan tunggal C-C sahaja dan formula am CnH2n+2. Alkena ialah hidrokarbon tak tepu yang mempunyai sekurang-kurangnya satu ikatan ganda dua C=C dan formula am CnH2n bagi rantai terbuka. Kedua-duanya mengalami pembakaran, tetapi alkena juga mudah menjalani tindak balas penambahan.'
        ),
        section(
          'Contoh kerja',
          'Etana mempunyai dua atom karbon dan mengikut formula alkana CnH2n+2, maka formulanya C2H6. Etena mempunyai dua atom karbon dan mengikut formula alkena CnH2n, maka formulanya C2H4. Ujian air bromin membezakan alkena daripada alkana kerana alkena menyahwarnakan air bromin perang kepada tidak berwarna.'
        ),
        section(
          'Awas salah faham',
          'Istilah tepu tidak bermaksud bahan itu larut sampai maksimum; dalam kimia organik, tepu bermaksud atom karbon mempunyai ikatan tunggal sahaja. Alkana biasanya kurang reaktif berbanding alkena kerana tiada ikatan C=C yang mudah terbuka. Pembakaran tidak lengkap hidrokarbon boleh menghasilkan karbon monoksida dan jelaga.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Hidrokarbon | Sebatian yang mengandungi karbon dan hidrogen sahaja |
| Alkana | Hidrokarbon tepu dengan formula am CnH2n+2 |
| Alkena | Hidrokarbon tak tepu yang mengandungi ikatan ganda dua C=C |
| Tindak balas penambahan | Tindak balas yang menambahkan atom kepada ikatan ganda dua |
| Air bromin | Reagen perang yang digunakan untuk menguji ketaktepuan |`
        ),
        section(
          'Cara ingat',
          'Alkana "Akhir -ana" ada ikatan tunggal yang stabil; alkena "E" ada dua garis pada C=C dan boleh menyahwarnakan bromin.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah formula am alkana rantai terbuka?',
          options: ['CnH2n', 'CnH2n+2', 'CnH2n-2', 'CnHn'],
          correct: { optionIndex: 1 },
          explanation: 'Alkana tepu rantai terbuka mempunyai formula am CnH2n+2.',
        },
        {
          type: 'multiple_choice',
          text: 'Bahan manakah boleh menyahwarnakan air bromin dengan cepat dalam keadaan biasa?',
          options: ['Metana', 'Etana', 'Etena', 'Propana'],
          correct: { optionIndex: 2 },
          explanation: 'Etena ialah alkena yang mempunyai ikatan C=C dan menjalani tindak balas penambahan dengan bromin.',
        },
        {
          type: 'true_false',
          text: 'Alkena ialah hidrokarbon tak tepu kerana mempunyai sekurang-kurangnya satu ikatan ganda dua karbon-karbon.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Ikatan ganda dua C=C menyebabkan alkena dikategorikan sebagai tak tepu.',
        },
        {
          type: 'representation_match',
          text: 'Padankan formula atau ciri dengan kumpulan sebatian karbon yang betul.',
          options: [
            { prompt: 'C2H6', answer: 'Alkana' },
            { prompt: 'C2H4', answer: 'Alkena' },
            { prompt: 'Menyahwarnakan air bromin', answer: 'Alkena' },
          ],
          correct: {
            C2H6: 'Alkana',
            C2H4: 'Alkena',
            'Menyahwarnakan air bromin': 'Alkena',
          },
          explanation: 'C2H6 memenuhi formula alkana, manakala C2H4 dan ujian bromin positif menunjukkan alkena.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah menjalankan ujian air bromin untuk mengenal pasti alkena.',
          options: [
            'Goncang campuran dengan perlahan',
            'Perhatikan sama ada warna perang air bromin menjadi tidak berwarna',
            'Masukkan sedikit sampel hidrokarbon ke dalam tabung uji',
            'Tambahkan beberapa titis air bromin',
          ],
          correct: [
            'Masukkan sedikit sampel hidrokarbon ke dalam tabung uji',
            'Tambahkan beberapa titis air bromin',
            'Goncang campuran dengan perlahan',
            'Perhatikan sama ada warna perang air bromin menjadi tidak berwarna',
          ],
          explanation: 'Alkena menyahwarnakan air bromin melalui tindak balas penambahan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid menulis formula propana sebagai C3H6 kerana menyangka semua hidrokarbon mempunyai formula CnH2n. Apakah ralatnya?',
          options: [],
          correct: 'Propana ialah alkana, jadi formula amnya CnH2n+2 dan formulanya ialah C3H8, bukan C3H6.',
          explanation: 'Formula CnH2n ialah formula am alkena rantai terbuka, bukan alkana.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Carbon Compounds',
      subtopic: 'Polymers & plastics',
      title: 'Sebatian Karbon: Polimer dan Plastik',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Polimer ialah molekul sangat besar yang terbentuk daripada banyak unit kecil berulang yang disebut monomer. Dalam pempolimeran penambahan, monomer alkena membuka ikatan ganda dua C=C dan bergabung membentuk rantai polimer tanpa menghasilkan molekul kecil lain. Plastik seperti poli(etena), poli(propena) dan poli(kloroetena) ialah polimer sintetik. Sifat plastik bergantung pada monomer, panjang rantai dan susunan rantai polimer.'
        ),
        section(
          'Contoh kerja',
          'Etena, CH2=CH2, boleh mengalami pempolimeran penambahan untuk membentuk poli(etena). Ikatan ganda dua dalam setiap monomer terbuka lalu membentuk ikatan tunggal dalam rantai panjang. Poli(etena) digunakan untuk beg plastik dan bekas kerana ringan, tidak mudah bertindak balas dan penebat elektrik yang baik.'
        ),
        section(
          'Awas salah faham',
          'Polimer bukan semestinya bahan buatan manusia; kanji, selulosa, protein dan getah asli juga polimer. Plastik pula sukar terurai kerana rantai polimernya stabil dan tidak mudah diuraikan oleh mikroorganisma. Pembakaran plastik tanpa kawalan boleh menghasilkan gas berbahaya, terutama jika plastik mengandungi klorin seperti PVC.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Monomer | Molekul kecil yang boleh bergabung membentuk polimer |
| Polimer | Molekul besar yang mengandungi unit berulang |
| Pempolimeran | Proses pembentukan polimer daripada monomer |
| Plastik | Bahan polimer sintetik yang boleh dibentuk apabila dipanaskan atau diproses |
| Unit berulang | Susunan atom yang berulang sepanjang rantai polimer |`
        ),
        section(
          'Cara ingat',
          'Monomer seperti manik, polimer seperti rantai. Untuk alkena, ikatan ganda dua dibuka supaya banyak manik boleh disambung menjadi rantai panjang.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah monomer bagi poli(etena)?',
          options: ['Metana', 'Etena', 'Etana', 'Etanol'],
          correct: { optionIndex: 1 },
          explanation: 'Poli(etena) terbentuk melalui pempolimeran penambahan monomer etena.',
        },
        {
          type: 'multiple_choice',
          text: 'Dalam pempolimeran penambahan alkena, apakah perubahan utama yang berlaku?',
          options: [
            'Ikatan ganda dua C=C dalam monomer terbuka dan membentuk rantai panjang',
            'Semua atom karbon dibebaskan sebagai karbon dioksida',
            'Air sentiasa terbentuk sebagai hasil sampingan',
            'Monomer berubah menjadi logam',
          ],
          correct: { optionIndex: 0 },
          explanation: 'Pempolimeran penambahan menggunakan ikatan C=C tanpa menghasilkan molekul kecil sebagai hasil sampingan.',
        },
        {
          type: 'true_false',
          text: 'Semua polimer ialah plastik sintetik.',
          options: trueFalseOptions,
          correct: 'false',
          explanation: 'Terdapat polimer semula jadi seperti protein, kanji, selulosa dan getah asli.',
        },
        {
          type: 'representation_match',
          text: 'Padankan bahan dengan penerangan yang betul.',
          options: [
            { prompt: 'Etena', answer: 'Monomer bagi poli(etena)' },
            { prompt: 'Poli(etena)', answer: 'Polimer sintetik untuk beg plastik' },
            { prompt: 'Selulosa', answer: 'Polimer semula jadi dalam dinding sel tumbuhan' },
          ],
          correct: {
            Etena: 'Monomer bagi poli(etena)',
            'Poli(etena)': 'Polimer sintetik untuk beg plastik',
            Selulosa: 'Polimer semula jadi dalam dinding sel tumbuhan',
          },
          explanation: 'Monomer ialah unit kecil, manakala polimer boleh bersifat sintetik atau semula jadi.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun perubahan ringkas semasa etena membentuk poli(etena).',
          options: [
            'Ikatan tunggal baharu terbentuk antara monomer',
            'Banyak unit berulang menghasilkan rantai poli(etena)',
            'Molekul etena didekatkan dalam keadaan sesuai',
            'Ikatan ganda dua C=C terbuka',
          ],
          correct: [
            'Molekul etena didekatkan dalam keadaan sesuai',
            'Ikatan ganda dua C=C terbuka',
            'Ikatan tunggal baharu terbentuk antara monomer',
            'Banyak unit berulang menghasilkan rantai poli(etena)',
          ],
          explanation: 'Pempolimeran penambahan menukar ikatan ganda dua kepada ikatan tunggal dalam rantai polimer.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata plastik mudah hilang dalam tanah kerana semua polimer cepat diuraikan oleh bakteria. Apakah ralatnya?',
          options: [],
          correct: 'Banyak plastik sintetik mempunyai rantai polimer yang stabil dan sukar diuraikan oleh mikroorganisma, maka plastik boleh kekal lama dalam alam sekitar.',
          explanation: 'Ketahanan kimia plastik memberi kegunaan praktikal tetapi juga menyebabkan masalah pelupusan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Oxidation & Reduction',
      subtopic: 'Redox reactions',
      title: 'Pengoksidaan dan Penurunan: Tindak Balas Redoks',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Tindak balas redoks melibatkan pengoksidaan dan penurunan yang berlaku serentak. Dari segi elektron, pengoksidaan ialah kehilangan elektron manakala penurunan ialah penerimaan elektron. Dari segi nombor pengoksidaan, pengoksidaan menaikkan nombor pengoksidaan dan penurunan menurunkannya. Agen pengoksidaan menyebabkan bahan lain teroksida, manakala agen penurunan menyebabkan bahan lain terturun.'
        ),
        section(
          'Contoh kerja',
          'Dalam tindak balas Zn + Cu2+ -> Zn2+ + Cu, atom zink kehilangan dua elektron dan membentuk Zn2+, maka zink teroksida. Ion kuprum(II), Cu2+, menerima dua elektron dan membentuk kuprum, maka Cu2+ terturun. Zink bertindak sebagai agen penurunan kerana ia mendermakan elektron kepada Cu2+.'
        ),
        section(
          'Awas salah faham',
          'Agen pengoksidaan sendiri mengalami penurunan, manakala agen penurunan sendiri mengalami pengoksidaan. Jangan keliru antara bahan yang menyebabkan proses dan bahan yang mengalami proses. Dalam persamaan ion, elektron mesti seimbang kerana elektron yang hilang oleh satu bahan diterima oleh bahan lain.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Pengoksidaan | Kehilangan elektron atau kenaikan nombor pengoksidaan |
| Penurunan | Penerimaan elektron atau penurunan nombor pengoksidaan |
| Agen pengoksidaan | Bahan yang menerima elektron dan menyebabkan bahan lain teroksida |
| Agen penurunan | Bahan yang mendermakan elektron dan menyebabkan bahan lain terturun |
| Nombor pengoksidaan | Nilai cas formal yang digunakan untuk mengesan perubahan elektron |`
        ),
        section(
          'Cara ingat',
          'Gunakan OIL RIG: Oxidation Is Loss, Reduction Is Gain. Dalam BM, "oksida hilang elektron, reduksi gain elektron".'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Menurut takrif elektron, apakah maksud pengoksidaan?',
          options: ['Penerimaan elektron', 'Kehilangan elektron', 'Pembentukan neutron', 'Pelarutan dalam air'],
          correct: { optionIndex: 1 },
          explanation: 'Pengoksidaan ialah kehilangan elektron.',
        },
        {
          type: 'multiple_choice',
          text: 'Dalam tindak balas Zn + Cu2+ -> Zn2+ + Cu, bahan manakah mengalami penurunan?',
          options: ['Zn', 'Cu2+', 'Zn2+', 'Elektron'],
          correct: { optionIndex: 1 },
          explanation: 'Cu2+ menerima elektron untuk membentuk Cu, maka Cu2+ mengalami penurunan.',
        },
        {
          type: 'true_false',
          text: 'Agen penurunan mendermakan elektron dan dirinya sendiri mengalami pengoksidaan.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Agen penurunan menyebabkan bahan lain terturun dengan mendermakan elektron.',
        },
        {
          type: 'representation_match',
          text: 'Padankan istilah redoks dengan penerangan yang betul.',
          options: [
            { prompt: 'OIL', answer: 'Pengoksidaan ialah kehilangan elektron' },
            { prompt: 'RIG', answer: 'Penurunan ialah penerimaan elektron' },
            { prompt: 'Agen pengoksidaan', answer: 'Menerima elektron dan mengalami penurunan' },
          ],
          correct: {
            OIL: 'Pengoksidaan ialah kehilangan elektron',
            RIG: 'Penurunan ialah penerimaan elektron',
            'Agen pengoksidaan': 'Menerima elektron dan mengalami penurunan',
          },
          explanation: 'Istilah redoks boleh dikenal pasti melalui arah pergerakan elektron.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah menentukan bahan yang teroksida dalam persamaan ion.',
          options: [
            'Kenal pasti spesies yang nombor pengoksidaannya meningkat',
            'Bandingkan nombor pengoksidaan sebelum dan selepas tindak balas',
            'Tulis nombor pengoksidaan bagi unsur yang berubah',
            'Nyatakan spesies itu mengalami pengoksidaan',
          ],
          correct: [
            'Tulis nombor pengoksidaan bagi unsur yang berubah',
            'Bandingkan nombor pengoksidaan sebelum dan selepas tindak balas',
            'Kenal pasti spesies yang nombor pengoksidaannya meningkat',
            'Nyatakan spesies itu mengalami pengoksidaan',
          ],
          explanation: 'Kenaikan nombor pengoksidaan menandakan pengoksidaan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata Cu2+ ialah agen penurunan dalam tindak balas Zn + Cu2+ -> Zn2+ + Cu kerana Cu2+ terturun. Apakah ralatnya?',
          options: [],
          correct: 'Cu2+ terturun kerana menerima elektron, maka Cu2+ ialah agen pengoksidaan, bukan agen penurunan.',
          explanation: 'Agen pengoksidaan mengalami penurunan sambil mengoksidakan bahan lain.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Oxidation & Reduction',
      subtopic: 'Rusting & prevention',
      title: 'Pengoksidaan dan Penurunan: Pengaratan dan Pencegahan',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Pengaratan ialah kakisan besi yang berlaku apabila besi terdedah kepada air dan oksigen. Karat ialah besi(III) oksida terhidrat, dan proses ini melibatkan tindak balas redoks. Elektrolit seperti air garam mempercepat pengaratan kerana ion membantu pemindahan cas. Pengaratan boleh dicegah dengan menghalang sentuhan besi dengan air dan oksigen atau menggunakan perlindungan korban.'
        ),
        section(
          'Contoh kerja',
          'Paku besi yang disimpan dalam air paip dan udara akan berkarat selepas beberapa hari. Paku dalam air mendidih yang dilitupi minyak tidak mudah berkarat kerana oksigen terlarut telah disingkirkan dan minyak menghalang oksigen daripada larut semula. Paku dalam kalsium klorida kontang juga tidak berkarat kerana tiada air.'
        ),
        section(
          'Awas salah faham',
          'Besi tidak berkarat hanya kerana ada udara kering; air juga diperlukan. Mengecat dan menyapu gris tidak mengubah besi menjadi bahan lain, tetapi membentuk lapisan penghalang. Dalam penggalvanian, zink boleh melindungi besi walaupun permukaan tercalar kerana zink lebih mudah teroksida daripada besi.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Pengaratan | Kakisan besi dengan kehadiran air dan oksigen |
| Karat | Besi(III) oksida terhidrat |
| Kakisan | Pemusnahan logam akibat tindak balas kimia dengan persekitaran |
| Penggalvanian | Penyalutan besi dengan zink untuk mencegah karat |
| Perlindungan korban | Perlindungan logam oleh logam lebih reaktif yang teroksida dahulu |`
        ),
        section(
          'Cara ingat',
          'Karat perlukan B-A-O: besi, air dan oksigen. Putuskan salah satu daripada tiga syarat itu untuk memperlahankan pengaratan.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah dua bahan utama yang diperlukan bersama besi untuk pengaratan berlaku?',
          options: ['Nitrogen dan karbon dioksida', 'Air dan oksigen', 'Hidrogen dan helium', 'Minyak dan pasir'],
          correct: { optionIndex: 1 },
          explanation: 'Pengaratan besi memerlukan kehadiran air dan oksigen.',
        },
        {
          type: 'multiple_choice',
          text: 'Mengapakah zink digunakan dalam penggalvanian besi?',
          options: [
            'Zink lebih mudah teroksida dan boleh bertindak sebagai logam korban',
            'Zink menjadikan besi lebih larut dalam air',
            'Zink menukarkan karat menjadi oksigen',
            'Zink ialah gas lengai pada suhu bilik',
          ],
          correct: { optionIndex: 0 },
          explanation: 'Zink lebih reaktif daripada besi, jadi zink teroksida terlebih dahulu dan melindungi besi.',
        },
        {
          type: 'true_false',
          text: 'Air garam boleh mempercepat pengaratan kerana ion dalam larutan membantu pengaliran cas.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Elektrolit meningkatkan kekonduksian dan mempercepat proses kakisan.',
        },
        {
          type: 'scenario',
          text: 'Sebuah jambatan besi di kawasan pantai lebih cepat berkarat berbanding jambatan di kawasan kering. Nyatakan sebab utama.',
          options: [],
          correct: 'air garam mempercepat pengaratan',
          explanation: 'Persekitaran pantai lembap dan mengandungi garam yang bertindak sebagai elektrolit.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah menyediakan eksperimen ringkas untuk menunjukkan air diperlukan bagi pengaratan.',
          options: [
            'Masukkan paku besi ke dalam tabung uji berisi kalsium klorida kontang',
            'Sumbat tabung uji untuk mengelakkan udara lembap masuk',
            'Sediakan tabung uji kawalan yang mengandungi paku, air dan udara',
            'Bandingkan keadaan paku selepas beberapa hari',
          ],
          correct: [
            'Masukkan paku besi ke dalam tabung uji berisi kalsium klorida kontang',
            'Sumbat tabung uji untuk mengelakkan udara lembap masuk',
            'Sediakan tabung uji kawalan yang mengandungi paku, air dan udara',
            'Bandingkan keadaan paku selepas beberapa hari',
          ],
          explanation: 'Kalsium klorida kontang menyerap air, jadi paku tanpa air boleh dibandingkan dengan paku kawalan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata mengecat besi mencegah karat kerana cat meneutralkan oksigen. Apakah ralatnya?',
          options: [],
          correct: 'Cat tidak meneutralkan oksigen; cat membentuk lapisan penghalang yang mengurangkan sentuhan besi dengan air dan oksigen.',
          explanation: 'Kaedah lapisan pelindung berfungsi secara fizikal dengan menghalang bahan yang diperlukan untuk pengaratan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Thermochemistry',
      subtopic: 'Exo- & endothermic reactions',
      title: 'Termokimia: Tindak Balas Eksotermik dan Endotermik',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Termokimia mengkaji perubahan haba semasa tindak balas kimia. Tindak balas eksotermik membebaskan haba ke persekitaran, menyebabkan suhu persekitaran meningkat dan nilai Delta H negatif. Tindak balas endotermik menyerap haba daripada persekitaran, menyebabkan suhu persekitaran menurun dan nilai Delta H positif. Dalam rajah aras tenaga, hasil tindak balas eksotermik berada pada aras tenaga lebih rendah daripada bahan tindak balas.'
        ),
        section(
          'Contoh kerja',
          'Peneutralan antara asid kuat dan alkali kuat biasanya eksotermik kerana pembentukan air membebaskan haba. Pelarutan ammonium nitrat dalam air pula endotermik kerana larutan menyerap haba daripada persekitaran dan menjadi sejuk. Perubahan haba boleh dianggarkan menggunakan q = mcDeltaT, dengan air biasanya mengambil c = 4.2 J g-1 C-1.'
        ),
        section(
          'Awas salah faham',
          'Eksotermik tidak bermaksud tindak balas itu sentiasa memerlukan api; banyak tindak balas eksotermik berlaku pada suhu bilik. Endotermik juga bukan bermaksud tindak balas tidak berlaku, tetapi tindak balas menyerap tenaga daripada persekitaran. Tanda Delta H merujuk kepada sistem tindak balas, bukan hanya rasa panas atau sejuk pada tangan.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Eksotermik | Tindak balas yang membebaskan haba ke persekitaran |
| Endotermik | Tindak balas yang menyerap haba daripada persekitaran |
| Delta H | Perubahan haba tindak balas pada tekanan tetap |
| Aras tenaga | Perwakilan tenaga bahan tindak balas dan hasil |
| q = mcDeltaT | Rumus untuk mengira haba yang diserap atau dibebaskan oleh larutan |`
        ),
        section(
          'Cara ingat',
          'Exo keluar haba, Endo masuk haba. Jika termometer naik, persekitaran menerima haba dan tindak balas biasanya eksotermik.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah tanda Delta H bagi tindak balas eksotermik?',
          options: ['Positif', 'Negatif', 'Sifar sahaja', 'Tidak boleh ditentukan'],
          correct: { optionIndex: 1 },
          explanation: 'Tindak balas eksotermik membebaskan haba daripada sistem, jadi Delta H bernilai negatif.',
        },
        {
          type: 'multiple_choice',
          text: 'Dalam rajah aras tenaga eksotermik, kedudukan tenaga hasil berbanding bahan tindak balas ialah',
          options: [
            'lebih tinggi daripada bahan tindak balas',
            'sama tinggi dengan bahan tindak balas',
            'lebih rendah daripada bahan tindak balas',
            'tiada kaitan dengan bahan tindak balas',
          ],
          correct: { optionIndex: 2 },
          explanation: 'Hasil eksotermik mempunyai tenaga lebih rendah kerana tenaga dibebaskan.',
        },
        {
          type: 'true_false',
          text: 'Tindak balas endotermik menyerap haba daripada persekitaran dan boleh menyebabkan suhu persekitaran menurun.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Endotermik bermaksud haba diserap oleh sistem daripada persekitaran.',
        },
        {
          type: 'numeric',
          text: 'Dalam satu eksperimen, 50 g larutan meningkat suhu daripada 28 C kepada 38 C. Jika c = 4.2 J g-1 C-1, berapakah haba yang dibebaskan kepada larutan?',
          options: [],
          correct: { value: 2100, tolerance: 5, unit: 'J' },
          explanation: 'q = mcDeltaT = 50 x 4.2 x 10 = 2100 J.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah mengenal pasti tindak balas eksotermik melalui eksperimen suhu.',
          options: [
            'Catat suhu akhir selepas tindak balas selesai',
            'Bandingkan suhu akhir dengan suhu awal',
            'Campurkan bahan tindak balas dalam bekas berpenebat ringkas',
            'Catat suhu awal bahan tindak balas',
          ],
          correct: [
            'Catat suhu awal bahan tindak balas',
            'Campurkan bahan tindak balas dalam bekas berpenebat ringkas',
            'Catat suhu akhir selepas tindak balas selesai',
            'Bandingkan suhu akhir dengan suhu awal',
          ],
          explanation: 'Kenaikan suhu persekitaran atau larutan menunjukkan haba dibebaskan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid melihat suhu larutan turun dan menulis Delta H negatif kerana tindak balas berlaku dengan cepat. Apakah ralatnya?',
          options: [],
          correct: 'Penurunan suhu menunjukkan tindak balas menyerap haba daripada persekitaran, jadi tindak balas itu endotermik dan Delta H positif.',
          explanation: 'Tanda Delta H ditentukan oleh arah pemindahan haba, bukan oleh kelajuan tindak balas.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Thermochemistry',
      subtopic: 'Heat of combustion & neutralisation',
      title: 'Termokimia: Haba Pembakaran dan Peneutralan',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Haba pembakaran ialah perubahan haba apabila satu mol bahan terbakar lengkap dalam oksigen berlebihan. Haba peneutralan ialah perubahan haba apabila satu mol air terbentuk daripada tindak balas antara asid dan alkali. Bagi asid kuat dan alkali kuat, nilai haba peneutralan hampir malar kerana tindak balas ion bersihnya ialah H+ + OH- -> H2O. Pengiraan termokimia menggunakan q = mcDeltaT dan menukar haba kepada nilai per mol.'
        ),
        section(
          'Contoh kerja',
          'Jika 50 cm3 asid dan 50 cm3 alkali bertindak balas lalu suhu meningkat 6.8 C, anggap jisim larutan 100 g dan c = 4.2 J g-1 C-1. Haba dibebaskan kepada larutan ialah q = 100 x 4.2 x 6.8 = 2856 J. Jika 0.050 mol air terbentuk, haba peneutralan ialah -2856/0.050 = -57120 J mol-1, atau -57.1 kJ mol-1.'
        ),
        section(
          'Awas salah faham',
          'Haba yang dikira daripada larutan ialah haba yang diterima oleh persekitaran; haba tindak balas mempunyai tanda bertentangan. Untuk pembakaran, pembakaran tidak lengkap atau kehilangan haba ke udara menyebabkan nilai eksperimen kurang eksotermik daripada nilai teori. Unit mesti konsisten sebelum menukar J kepada kJ mol-1.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Haba pembakaran | Haba apabila satu mol bahan terbakar lengkap dalam oksigen berlebihan |
| Haba peneutralan | Haba apabila satu mol air terbentuk daripada asid dan alkali |
| Pembakaran lengkap | Pembakaran yang menghasilkan karbon dioksida dan air bagi hidrokarbon |
| Kalorimeter | Radas ringkas untuk menganggarkan perubahan haba |
| kJ mol-1 | Unit perubahan haba bagi setiap mol bahan |`
        ),
        section(
          'Cara ingat',
          'Kira dalam tiga langkah: haba larutan q, mol bahan utama, kemudian bahagi q dengan mol dan tukar kepada kJ mol-1. Letakkan tanda negatif jika tindak balas membebaskan haba.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud haba pembakaran bagi etanol?',
          options: [
            'Haba apabila satu mol etanol terbakar lengkap dalam oksigen berlebihan',
            'Haba apabila satu gram air menyejat',
            'Haba apabila etanol melarut dalam air',
            'Haba apabila satu mol oksigen terbentuk',
          ],
          correct: { optionIndex: 0 },
          explanation: 'Haba pembakaran ditakrifkan bagi pembakaran lengkap satu mol bahan.',
        },
        {
          type: 'multiple_choice',
          text: 'Mengapakah haba peneutralan asid kuat dengan alkali kuat hampir sama nilainya?',
          options: [
            'Semua asid kuat mengandungi karbon',
            'Ion bersih utama sentiasa H+ + OH- -> H2O',
            'Semua tindak balas berlaku tanpa haba',
            'Garam yang terbentuk sentiasa tidak larut',
          ],
          correct: { optionIndex: 1 },
          explanation: 'Asid kuat dan alkali kuat terion lengkap, maka tindak balas bersihnya ialah pembentukan air daripada H+ dan OH-.',
        },
        {
          type: 'true_false',
          text: 'Dalam pengiraan termokimia eksotermik, haba tindak balas mempunyai tanda negatif walaupun suhu larutan meningkat.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Larutan menerima haba, tetapi sistem tindak balas membebaskan haba.',
        },
        {
          type: 'numeric',
          text: '50 cm3 HCl 1.0 mol dm-3 dineutralkan oleh 50 cm3 NaOH 1.0 mol dm-3. Suhu meningkat 6.8 C. Anggap jisim larutan 100 g dan c = 4.2 J g-1 C-1. Berapakah haba peneutralan dalam kJ mol-1?',
          options: [],
          correct: { value: -57.1, tolerance: 0.5, unit: 'kJ mol-1' },
          explanation: 'q = 100 x 4.2 x 6.8 = 2856 J. Mol air = 0.050 mol. Delta H = -2.856/0.050 = -57.1 kJ mol-1.',
          points: 3,
        },
        {
          type: 'step_order',
          text: 'Susun langkah mengira haba pembakaran bahan api daripada data eksperimen.',
          options: [
            'Bahagikan haba dengan bilangan mol bahan api yang terbakar',
            'Kira haba yang diserap air menggunakan q = mcDeltaT',
            'Tentukan perubahan suhu air',
            'Tentukan mol bahan api daripada perubahan jisim dan jisim molar',
          ],
          correct: [
            'Tentukan perubahan suhu air',
            'Kira haba yang diserap air menggunakan q = mcDeltaT',
            'Tentukan mol bahan api daripada perubahan jisim dan jisim molar',
            'Bahagikan haba dengan bilangan mol bahan api yang terbakar',
          ],
          explanation: 'Data suhu memberi q, manakala perubahan jisim bahan api memberi mol untuk nilai per mol.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid mengira haba peneutralan sebagai +57 kJ mol-1 kerana suhu larutan meningkat. Apakah ralatnya?',
          options: [],
          correct: 'Kenaikan suhu larutan menunjukkan tindak balas membebaskan haba, jadi haba tindak balas peneutralan perlu bertanda negatif.',
          explanation: 'Tanda bagi sistem tindak balas adalah bertentangan dengan haba yang diterima larutan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Chemicals in Industry',
      subtopic: 'Haber process & Contact process',
      title: 'Kimia Industri: Proses Haber dan Proses Sentuh',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Proses Haber menghasilkan ammonia melalui tindak balas boleh balik N2 + 3H2 <-> 2NH3. Keadaan industri lazim menggunakan mangkin besi, suhu kira-kira 450 C dan tekanan tinggi sekitar 200 atm sebagai kompromi antara kadar tindak balas, hasil dan kos. Proses Sentuh menghasilkan asid sulfurik melalui pengoksidaan sulfur dioksida kepada sulfur trioksida dengan mangkin vanadium(V) oksida. Kedua-dua proses memerlukan pemilihan keadaan optimum, bukan sekadar hasil maksimum teori.'
        ),
        section(
          'Contoh kerja',
          'Dalam Proses Haber, suhu rendah menggalakkan hasil ammonia kerana tindak balas ke hadapan adalah eksotermik, tetapi suhu terlalu rendah menjadikan kadar terlalu perlahan. Tekanan tinggi menggalakkan pembentukan ammonia kerana bilangan mol gas berkurang daripada 4 mol kepada 2 mol. Oleh itu industri memilih suhu sederhana tinggi dan tekanan tinggi yang masih ekonomik.'
        ),
        section(
          'Awas salah faham',
          'Mangkin tidak mengubah kedudukan keseimbangan; mangkin hanya mempercepat pencapaian keseimbangan. Dalam Proses Sentuh, sulfur trioksida tidak dilarutkan terus dalam air secara industri kerana tindak balas terlalu hebat dan menghasilkan kabus asid. Sebaliknya SO3 diserap dalam asid sulfurik pekat untuk membentuk oleum sebelum dicairkan.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Proses Haber | Proses industri menghasilkan ammonia daripada nitrogen dan hidrogen |
| Proses Sentuh | Proses industri menghasilkan asid sulfurik |
| Keseimbangan dinamik | Keadaan apabila kadar tindak balas ke hadapan dan songsang adalah sama |
| Keadaan optimum | Keadaan yang mengimbangkan hasil, kadar, kos dan keselamatan |
| Oleum | Larutan sulfur trioksida dalam asid sulfurik pekat |`
        ),
        section(
          'Cara ingat',
          'Haber buat ammonia untuk baja; Sentuh buat asid sulfurik. Haber ingat Fe, 450 C, tekanan tinggi. Sentuh ingat V2O5 dan SO2 menjadi SO3.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah hasil utama Proses Haber?',
          options: ['Ammonia', 'Asid sulfurik', 'Etena', 'Klorin'],
          correct: { optionIndex: 0 },
          explanation: 'Proses Haber digunakan untuk menghasilkan ammonia, NH3.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah mangkin yang digunakan dalam Proses Sentuh untuk menukarkan SO2 kepada SO3?',
          options: ['Besi', 'Vanadium(V) oksida', 'Nikel', 'Mangan(IV) oksida'],
          correct: { optionIndex: 1 },
          explanation: 'Vanadium(V) oksida, V2O5, ialah mangkin dalam peringkat pengoksidaan SO2 kepada SO3.',
        },
        {
          type: 'true_false',
          text: 'Mangkin dalam Proses Haber meningkatkan kadar pencapaian keseimbangan tetapi tidak mengubah hasil keseimbangan maksimum.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Mangkin mempercepat tindak balas ke hadapan dan songsang secara sama, jadi kedudukan keseimbangan tidak berubah.',
        },
        {
          type: 'representation_match',
          text: 'Padankan proses industri dengan maklumat yang betul.',
          options: [
            { prompt: 'Proses Haber', answer: 'N2 + 3H2 <-> 2NH3' },
            { prompt: 'Proses Sentuh', answer: 'SO2 dioksidakan kepada SO3' },
            { prompt: 'Oleum', answer: 'SO3 diserap dalam H2SO4 pekat' },
          ],
          correct: {
            'Proses Haber': 'N2 + 3H2 <-> 2NH3',
            'Proses Sentuh': 'SO2 dioksidakan kepada SO3',
            Oleum: 'SO3 diserap dalam H2SO4 pekat',
          },
          explanation: 'Setiap proses mempunyai bahan mentah, mangkin dan peringkat utama yang berbeza.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun peringkat utama penghasilan asid sulfurik dalam Proses Sentuh.',
          options: [
            'SO3 diserap dalam asid sulfurik pekat untuk membentuk oleum',
            'Sulfur atau sulfida dibakar untuk menghasilkan SO2',
            'Oleum dicairkan dengan air untuk menghasilkan asid sulfurik',
            'SO2 dioksidakan kepada SO3 dengan mangkin V2O5',
          ],
          correct: [
            'Sulfur atau sulfida dibakar untuk menghasilkan SO2',
            'SO2 dioksidakan kepada SO3 dengan mangkin V2O5',
            'SO3 diserap dalam asid sulfurik pekat untuk membentuk oleum',
            'Oleum dicairkan dengan air untuk menghasilkan asid sulfurik',
          ],
          explanation: 'Proses Sentuh menghasilkan SO2, kemudian SO3, kemudian oleum sebelum dicairkan kepada H2SO4.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid mencadangkan Proses Haber dijalankan pada suhu serendah mungkin kerana hasil ammonia lebih tinggi. Apakah ralatnya?',
          options: [],
          correct: 'Suhu terlalu rendah memberi kadar tindak balas yang sangat perlahan; industri memilih suhu kompromi supaya kadar, hasil dan kos sesuai.',
          explanation: 'Keadaan industri mesti mengimbangkan hasil keseimbangan dengan kadar tindak balas dan kos operasi.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Chemicals in Industry',
      subtopic: 'Alloys & synthetic polymers',
      title: 'Kimia Industri: Aloi dan Polimer Sintetik',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Aloi ialah campuran dua atau lebih unsur dengan sekurang-kurangnya satu unsur ialah logam. Atom unsur tambahan yang berlainan saiz mengganggu susunan lapisan atom logam tulen, menyebabkan lapisan atom lebih sukar menggelongsor. Oleh itu aloi biasanya lebih keras, lebih kuat atau lebih tahan kakisan berbanding logam tulen. Polimer sintetik pula ialah bahan berantai panjang buatan industri seperti poli(etena), PVC, nilon dan perspeks.'
        ),
        section(
          'Contoh kerja',
          'Keluli ialah aloi besi dengan karbon dan kadang-kadang unsur lain untuk meningkatkan kekuatan. Loyang ialah aloi kuprum dan zink, manakala gangsa ialah aloi kuprum dan timah. Keluli tahan karat mengandungi kromium yang membentuk lapisan oksida pelindung, menjadikannya lebih tahan kakisan untuk peralatan dapur dan alat perubatan.'
        ),
        section(
          'Awas salah faham',
          'Aloi bukan sebatian dengan formula tetap seperti NaCl; komposisinya boleh berubah mengikut kegunaan. Logam tulen tidak semestinya lebih baik kerana lapisan atomnya mudah menggelongsor dan logam menjadi lebih lembut. Polimer sintetik berguna tetapi perlu diurus melalui pengurangan penggunaan, guna semula, kitar semula dan pelupusan terkawal.'
        ),
        section(
          'Istilah penting',
          `| Istilah | Maksud |
|---|---|
| Aloi | Campuran unsur yang mengandungi sekurang-kurangnya satu logam |
| Keluli | Aloi berasaskan besi yang mengandungi karbon |
| Keluli tahan karat | Aloi besi dengan kromium dan unsur lain yang tahan kakisan |
| Polimer sintetik | Polimer buatan manusia melalui proses industri |
| Kitar semula | Pemprosesan semula bahan buangan menjadi bahan berguna |`
        ),
        section(
          'Cara ingat',
          'Aloi kuat kerana atom berlainan saiz mengunci lapisan. Polimer sintetik berguna kerana ringan dan tahan, tetapi perlu diurus supaya tidak mencemarkan alam.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Mengapakah aloi biasanya lebih keras daripada logam tulen?',
          options: [
            'Atom berlainan saiz mengganggu lapisan atom daripada menggelongsor',
            'Aloi sentiasa mempunyai takat lebur sifar',
            'Aloi tidak mengandungi elektron',
            'Aloi sentiasa berubah menjadi gas',
          ],
          correct: { optionIndex: 0 },
          explanation: 'Susunan atom yang terganggu menyukarkan gelongsoran lapisan atom, lalu meningkatkan kekerasan.',
        },
        {
          type: 'multiple_choice',
          text: 'Aloi manakah sesuai dikaitkan dengan kuprum dan zink?',
          options: ['Keluli', 'Loyang', 'Gangsa', 'Duralumin'],
          correct: { optionIndex: 1 },
          explanation: 'Loyang ialah aloi kuprum dan zink.',
        },
        {
          type: 'true_false',
          text: 'Aloi mempunyai komposisi yang boleh dilaraskan mengikut sifat yang dikehendaki, tidak seperti sebatian tulen yang mempunyai formula tetap.',
          options: trueFalseOptions,
          correct: 'true',
          explanation: 'Komposisi aloi boleh diubah untuk mendapatkan kekuatan, kekerasan atau ketahanan kakisan yang sesuai.',
        },
        {
          type: 'representation_match',
          text: 'Padankan bahan industri dengan kegunaan atau komposisi umum yang betul.',
          options: [
            { prompt: 'Keluli tahan karat', answer: 'Aloi besi dengan kromium untuk rintangan kakisan' },
            { prompt: 'PVC', answer: 'Polimer sintetik untuk paip dan penebat kabel' },
            { prompt: 'Gangsa', answer: 'Aloi kuprum dan timah' },
          ],
          correct: {
            'Keluli tahan karat': 'Aloi besi dengan kromium untuk rintangan kakisan',
            PVC: 'Polimer sintetik untuk paip dan penebat kabel',
            Gangsa: 'Aloi kuprum dan timah',
          },
          explanation: 'Aloi dan polimer sintetik dipilih berdasarkan sifat seperti kekuatan, ketahanan kakisan dan penebatan.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun pertimbangan memilih bahan untuk membuat sinki dapur tahan lama.',
          options: [
            'Pilih bahan yang tahan kakisan seperti keluli tahan karat',
            'Kenal pasti keadaan penggunaan yang melibatkan air dan detergen',
            'Bandingkan sifat logam tulen dengan aloi',
            'Nilai kos, kebersihan dan ketahanan bahan',
          ],
          correct: [
            'Kenal pasti keadaan penggunaan yang melibatkan air dan detergen',
            'Bandingkan sifat logam tulen dengan aloi',
            'Pilih bahan yang tahan kakisan seperti keluli tahan karat',
            'Nilai kos, kebersihan dan ketahanan bahan',
          ],
          explanation: 'Pemilihan bahan industri bermula daripada keperluan penggunaan, kemudian sifat bahan dan pertimbangan praktikal.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata besi tulen paling sesuai untuk jambatan kerana bahan tulen sentiasa lebih kuat daripada campuran. Apakah ralatnya?',
          options: [],
          correct: 'Besi tulen lebih lembut dan mudah berkarat; aloi seperti keluli lebih kuat kerana susunan atomnya terganggu dan boleh direka supaya lebih tahan.',
          explanation: 'Aloi sering digunakan dalam struktur kerana sifat mekanik dan ketahanan boleh dipertingkatkan.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.text,
        question.options,
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm5Physics(client) {
  const subject = 'Fizik';
  const formLevel = 5;
  const lessons = [
    {
      topic: 'Magnetism',
      subtopic: 'Magnetic fields & flux density',
      title: 'Kemagnetan: Medan Magnet dan Ketumpatan Fluks',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Medan magnet ialah kawasan di sekeliling magnet atau konduktor berarus yang boleh mengenakan daya magnet. Garisan medan magnet menunjukkan arah daya pada kutub utara kecil; di luar magnet bar, arahnya dari kutub utara ke kutub selatan. Garisan medan yang lebih rapat menunjukkan medan lebih kuat. Ketumpatan fluks magnet, B, mengukur kekuatan medan magnet dan ditakrifkan melalui daya pada konduktor berarus yang tegak lurus kepada medan: F = BIL.'
        ),
        section(
          'Contoh kerja',
          'Satu dawai sepanjang 0.30 m membawa arus 2.0 A dan berada tegak lurus dalam medan magnet. Jika daya magnet pada dawai ialah 0.12 N, ketumpatan fluks magnet ialah B = F / IL = 0.12 / (2.0 x 0.30) = 0.20 T. Unit tesla bermaksud satu newton daya per ampere per meter apabila arus tegak lurus kepada medan.'
        ),
        section(
          'Kekeliruan lazim',
          'Garisan medan magnet tidak pernah bersilang kerana medan pada satu titik hanya mempunyai satu arah. Medan magnet bukan hanya wujud pada tempat yang dilukis garisan; garisan itu ialah model untuk menunjukkan arah dan kekuatan relatif. Formula F = BIL hanya terus digunakan apabila konduktor tegak lurus kepada medan magnet.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Medan magnet | Kawasan yang boleh mengenakan daya magnet. |\n| Garisan medan | Garisan model yang menunjukkan arah medan magnet. |\n| Ketumpatan fluks magnet | Ukuran kekuatan medan magnet, simbol B. |\n| Tesla | Unit SI bagi ketumpatan fluks magnet. |\n| Konduktor berarus | Wayar atau bahan pengalir yang membawa arus elektrik. |'
        ),
        section(
          'Petua ingatan',
          'Ingat "rapat kuat, jauh lemah" untuk garisan medan. Untuk F = BIL, sebut "B-il" dan pastikan I, L dan arah medan saling tegak lurus sebelum menggantikan nilai.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah arah garisan medan magnet di luar magnet bar?',
          options: ['Dari kutub selatan ke kutub utara', 'Dari kutub utara ke kutub selatan', 'Dalam bulatan tertutup di satu kutub sahaja', 'Sentiasa dari kiri ke kanan'],
          correct: { optionIndex: 1 },
          explanation: 'Di luar magnet, garisan medan keluar dari kutub utara dan masuk ke kutub selatan.',
        },
        {
          type: 'multiple_choice',
          question: 'Unit SI bagi ketumpatan fluks magnet ialah',
          options: ['newton', 'ampere', 'tesla', 'joule'],
          correct: { optionIndex: 2 },
          explanation: 'Ketumpatan fluks magnet, B, diukur dalam tesla, T.',
        },
        {
          type: 'true_false',
          question: 'Garisan medan magnet yang lebih rapat menunjukkan medan magnet yang lebih kuat.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Kepadatan garisan medan menunjukkan kekuatan relatif medan magnet.',
        },
        {
          type: 'numeric',
          question: 'Satu konduktor sepanjang 0.40 m membawa arus 3.0 A secara tegak lurus dalam medan magnet. Jika daya magnet ialah 0.24 N, hitung B.',
          options: [],
          correct: { value: 0.2, tolerance: 0.001, unit: 'T' },
          explanation: 'B = F / IL = 0.24 / (3.0 x 0.40) = 0.20 T.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menentukan ketumpatan fluks magnet daripada daya pada konduktor.',
          options: ['Gantikan nilai dalam B = F / IL', 'Pastikan konduktor tegak lurus kepada medan', 'Kenal pasti F, I dan L', 'Tulis jawapan dengan unit tesla'],
          correct: ['Pastikan konduktor tegak lurus kepada medan', 'Kenal pasti F, I dan L', 'Gantikan nilai dalam B = F / IL', 'Tulis jawapan dengan unit tesla'],
          explanation: 'Syarat tegak lurus perlu disemak sebelum menggunakan formula F = BIL.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata dua garisan medan magnet boleh bersilang kerana dua daya magnet boleh wujud pada titik yang sama. Apakah ralatnya?',
          options: [],
          correct: 'Garisan medan tidak boleh bersilang kerana arah medan magnet pada satu titik adalah tunggal.',
          explanation: 'Jika garisan bersilang, satu titik akan mempunyai dua arah medan, yang tidak konsisten dengan definisi medan magnet.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Electromagnetism',
      subtopic: "Faraday's law & induction",
      title: 'Keelektromagnetan: Hukum Faraday dan Aruhan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Aruhan elektromagnet berlaku apabila perubahan fluks magnet memotong konduktor atau gegelung lalu menghasilkan daya gerak elektrik teraruh. Hukum Faraday menyatakan magnitud d.g.e. teraruh bertambah apabila kadar perubahan fluks magnet bertambah. Hukum Lenz pula menyatakan arah arus teraruh sentiasa menentang perubahan yang menghasilkannya. Aruhan boleh diperkuatkan dengan menggerakkan magnet lebih laju, menggunakan magnet lebih kuat atau menambah bilangan lilitan gegelung.'
        ),
        section(
          'Contoh kerja',
          'Apabila kutub utara magnet ditolak masuk ke dalam gegelung, penunjuk galvanometer terpesong kerana fluks magnet melalui gegelung berubah. Jika magnet dihentikan di dalam gegelung, pesongan menjadi sifar kerana fluks tidak lagi berubah. Apabila magnet ditarik keluar, pesongan berlaku pada arah bertentangan kerana arus teraruh menentang perubahan fluks yang baharu.'
        ),
        section(
          'Kekeliruan lazim',
          'Kehadiran medan magnet sahaja tidak mencukupi untuk menghasilkan arus teraruh; mesti ada perubahan fluks atau pemotongan garisan medan. Arus teraruh tidak sentiasa searah dengan pergerakan magnet. Arahnya ditentukan oleh Hukum Lenz, iaitu menentang perubahan, bukan menentang gerakan secara umum tanpa mengambil kira kutub dan arah fluks.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Aruhan elektromagnet | Penghasilan d.g.e. akibat perubahan fluks magnet. |\n| Fluks magnet | Bilangan relatif garisan medan yang menembusi kawasan. |\n| D.g.e. teraruh | Voltan yang terhasil melalui aruhan elektromagnet. |\n| Hukum Faraday | D.g.e. teraruh berkadar dengan kadar perubahan fluks. |\n| Hukum Lenz | Arus teraruh menentang perubahan yang menghasilkannya. |'
        ),
        section(
          'Petua ingatan',
          'Untuk aruhan, tanya "adakah fluks berubah?" Jika ya, d.g.e. teraruh wujud. Untuk arah arus, gunakan idea "menentang perubahan", kemudian semak dengan petua tangan kanan Fleming jika konduktor memotong medan.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah syarat utama untuk menghasilkan d.g.e. teraruh dalam gegelung?',
          options: ['Gegelung mesti panas', 'Fluks magnet melalui gegelung mesti berubah', 'Gegelung mesti dibuat daripada plastik', 'Magnet mesti berada pegun di tengah gegelung'],
          correct: { optionIndex: 1 },
          explanation: 'Aruhan elektromagnet memerlukan perubahan fluks magnet atau pemotongan garisan medan.',
        },
        {
          type: 'multiple_choice',
          question: 'Hukum Lenz menerangkan',
          options: ['magnitud cas proton', 'arah arus teraruh yang menentang perubahan fluks', 'rintangan dawai pemanas', 'hubungan antara suhu dan isipadu gas'],
          correct: { optionIndex: 1 },
          explanation: 'Hukum Lenz menentukan arah arus teraruh supaya kesannya menentang perubahan yang menghasilkannya.',
        },
        {
          type: 'true_false',
          question: 'Magnet yang pegun di dalam gegelung tertutup menghasilkan arus teraruh berterusan.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Apabila magnet pegun, fluks magnet melalui gegelung tidak berubah, maka tiada arus teraruh berterusan.',
        },
        {
          type: 'representation_match',
          question: 'Padankan perubahan eksperimen dengan kesan pada d.g.e. teraruh.',
          options: [
            { prompt: 'A: Magnet digerakkan lebih laju', answer: 'D.g.e. teraruh bertambah' },
            { prompt: 'B: Bilangan lilitan gegelung ditambah', answer: 'D.g.e. teraruh bertambah' },
            { prompt: 'C: Magnet dihentikan dalam gegelung', answer: 'D.g.e. teraruh menjadi sifar' },
          ],
          correct: {
            'A: Magnet digerakkan lebih laju': 'D.g.e. teraruh bertambah',
            'B: Bilangan lilitan gegelung ditambah': 'D.g.e. teraruh bertambah',
            'C: Magnet dihentikan dalam gegelung': 'D.g.e. teraruh menjadi sifar',
          },
          explanation: 'Magnitud d.g.e. teraruh bergantung pada kadar perubahan fluks dan bilangan lilitan.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah meramal arus teraruh apabila magnet ditolak masuk ke dalam gegelung.',
          options: ['Gunakan Hukum Lenz untuk menentukan arah tentangan', 'Kenal pasti arah perubahan fluks dalam gegelung', 'Tentukan kutub teraruh pada muka gegelung', 'Semak arah arus yang menghasilkan kutub tersebut'],
          correct: ['Kenal pasti arah perubahan fluks dalam gegelung', 'Gunakan Hukum Lenz untuk menentukan arah tentangan', 'Tentukan kutub teraruh pada muka gegelung', 'Semak arah arus yang menghasilkan kutub tersebut'],
          explanation: 'Arah arus ditentukan selepas arah perubahan fluks dan kesan tentangan dikenal pasti.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata d.g.e. teraruh hanya bergantung pada kekuatan magnet, bukan pada kelajuan gerakan. Apakah ralatnya?',
          options: [],
          correct: 'D.g.e. teraruh bergantung pada kadar perubahan fluks; gerakan lebih laju meningkatkan kadar perubahan fluks.',
          explanation: 'Magnet yang sama boleh menghasilkan d.g.e. lebih besar jika digerakkan lebih laju melalui gegelung.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Electromagnetism',
      subtopic: 'Transformers & AC/DC',
      title: 'Keelektromagnetan: Transformer dan AC/DC',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Transformer menggunakan aruhan elektromagnet untuk menaikkan atau menurunkan voltan arus ulang-alik. Gegelung primer dan sekunder dililit pada teras besi lembut berlamina supaya fluks magnet berubah dapat dipindahkan dengan cekap. Bagi transformer unggul, Vs / Vp = Ns / Np dan kuasa primer hampir sama dengan kuasa sekunder, iaitu VpIp = VsIs. Transformer tidak berfungsi dengan arus terus yang mantap kerana arus terus tidak menghasilkan fluks magnet yang berubah secara berterusan.'
        ),
        section(
          'Contoh kerja',
          'Sebuah transformer mempunyai 1000 lilitan primer dan 50 lilitan sekunder. Jika voltan primer ialah 240 V, maka Vs = Vp x Ns / Np = 240 x 50 / 1000 = 12 V. Transformer ini ialah transformer injak turun kerana lilitan sekunder lebih sedikit dan voltan sekunder lebih rendah. Jika outputnya 24 W, arus sekunder ialah I = P / V = 24 / 12 = 2.0 A.'
        ),
        section(
          'Kekeliruan lazim',
          'Transformer tidak mencipta tenaga. Apabila voltan dinaikkan, arus sekunder menurun supaya kuasa hampir terpelihara, kecuali kehilangan tenaga. Teras besi berlamina mengurangkan arus pusar, bukannya menghentikan aruhan. Arus terus boleh menyebabkan kesan seketika ketika suis ditutup atau dibuka, tetapi tidak menghasilkan aruhan berterusan dalam transformer biasa.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Transformer injak naik | Transformer dengan voltan sekunder lebih tinggi daripada voltan primer. |\n| Transformer injak turun | Transformer dengan voltan sekunder lebih rendah daripada voltan primer. |\n| Gegelung primer | Gegelung yang disambung kepada bekalan input. |\n| Gegelung sekunder | Gegelung yang membekalkan output. |\n| Teras berlamina | Teras besi lembut berlapis untuk mengurangkan arus pusar. |'
        ),
        section(
          'Petua ingatan',
          'Bandingkan lilitan dahulu: Ns lebih besar daripada Np menaikkan voltan, Ns lebih kecil menurunkan voltan. Untuk kuasa, ingat "V naik, I turun" bagi transformer unggul.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Mengapa transformer biasa memerlukan arus ulang-alik?',
          options: ['Arus ulang-alik mempunyai rintangan sifar', 'Arus ulang-alik menghasilkan fluks magnet yang berubah', 'Arus ulang-alik tidak menghasilkan haba', 'Arus ulang-alik sentiasa berfrekuensi sifar'],
          correct: { optionIndex: 1 },
          explanation: 'Aruhan dalam gegelung sekunder memerlukan fluks magnet yang berubah, yang dibekalkan oleh arus ulang-alik.',
        },
        {
          type: 'multiple_choice',
          question: 'Sebuah transformer injak naik mempunyai',
          options: ['Ns lebih besar daripada Np', 'Ns lebih kecil daripada Np', 'tiada teras besi', 'arus terus pada gegelung primer'],
          correct: { optionIndex: 0 },
          explanation: 'Untuk menaikkan voltan, bilangan lilitan sekunder mesti lebih besar daripada lilitan primer.',
        },
        {
          type: 'true_false',
          question: 'Dalam transformer unggul, kuasa output boleh melebihi kuasa input tanpa sumber tenaga tambahan.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Transformer memindahkan tenaga; kuasa output tidak boleh melebihi kuasa input dalam model unggul.',
        },
        {
          type: 'numeric',
          question: 'Transformer mempunyai 1200 lilitan primer dan 60 lilitan sekunder. Jika Vp = 240 V, hitung voltan sekunder.',
          options: [],
          correct: { value: 12, tolerance: 0.01, unit: 'V' },
          explanation: 'Vs / 240 = 60 / 1200, maka Vs = 240 x 0.05 = 12 V.',
          points: 2,
        },
        {
          type: 'numeric',
          question: 'Sebuah transformer unggul menukarkan 240 V kepada 12 V. Jika arus primer ialah 0.50 A, hitung arus sekunder.',
          options: [],
          correct: { value: 10, tolerance: 0.01, unit: 'A' },
          explanation: 'VpIp = VsIs, jadi Is = 240 x 0.50 / 12 = 10 A.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menyelesaikan masalah transformer unggul.',
          options: ['Gunakan nisbah Vs / Vp = Ns / Np', 'Kenal pasti kuantiti primer dan sekunder', 'Jika perlu, gunakan VpIp = VsIs untuk arus', 'Tentukan sama ada transformer injak naik atau injak turun'],
          correct: ['Kenal pasti kuantiti primer dan sekunder', 'Gunakan nisbah Vs / Vp = Ns / Np', 'Tentukan sama ada transformer injak naik atau injak turun', 'Jika perlu, gunakan VpIp = VsIs untuk arus'],
          explanation: 'Nisbah lilitan memberi voltan, kemudian hubungan kuasa digunakan untuk arus.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Electronics',
      subtopic: 'Semiconductor diodes & rectification',
      title: 'Elektronik: Diod Semikonduktor dan Rektifikasi',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Diod semikonduktor ialah simpang p-n yang membenarkan arus mengalir dengan mudah dalam pincang hadapan dan menghalang arus dalam pincang songsang. Sifat satu arah ini digunakan untuk rektifikasi, iaitu menukar arus ulang-alik kepada arus terus berdenyut. Rektifier setengah gelombang menggunakan satu diod, manakala rektifier gelombang penuh atau jambatan menggunakan beberapa diod supaya kedua-dua separuh kitaran AC menyumbang kepada output DC.'
        ),
        section(
          'Contoh kerja',
          'Dalam bekalan kuasa ringkas, transformer menurunkan voltan AC utama, diod jambatan merektifikasikan AC kepada DC berdenyut, dan kapasitor pelicin dicas semasa puncak voltan lalu menyahcas antara puncak. Ini mengurangkan riak pada output. Diod pemancar cahaya, LED, pula memancarkan cahaya apabila dipincang hadapan dan mesti disambung dengan perintang had arus.'
        ),
        section(
          'Kekeliruan lazim',
          'Diod tidak "menyimpan" arus; ia mengawal arah arus. Output selepas satu diod bukan DC licin sepenuhnya, tetapi DC berdenyut yang masih mempunyai riak. Kapasitor pelicin mengurangkan riak tetapi tidak menjadikan bekalan sempurna jika beban terlalu besar atau kapasitans terlalu kecil.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Semikonduktor | Bahan dengan kekonduksian antara konduktor dan penebat. |\n| Diod | Komponen p-n yang membenarkan arus terutamanya sehala. |\n| Pincang hadapan | Sambungan yang membolehkan diod mengalirkan arus. |\n| Pincang songsang | Sambungan yang menghalang arus melalui diod biasa. |\n| Rektifikasi | Penukaran AC kepada DC berdenyut. |'
        ),
        section(
          'Petua ingatan',
          'Ingat "diod satu arah". Untuk bekalan DC lebih rata, urutannya ialah turun voltan, rektifikasi, kemudian pelicinan dengan kapasitor.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Fungsi utama diod dalam litar rektifier ialah',
          options: ['menyimpan tenaga magnet', 'membenarkan arus mengalir terutamanya satu arah', 'menukar DC kepada AC', 'mengukur suhu'],
          correct: { optionIndex: 1 },
          explanation: 'Diod membenarkan arus mengalir dalam pincang hadapan dan menghalang arus dalam pincang songsang.',
        },
        {
          type: 'multiple_choice',
          question: 'Komponen manakah biasanya digunakan untuk mengurangkan riak selepas rektifikasi?',
          options: ['Kapasitor pelicin', 'Suis mekanikal', 'Fius sahaja', 'Galvanometer'],
          correct: { optionIndex: 0 },
          explanation: 'Kapasitor dicas dan menyahcas untuk meratakan output DC berdenyut.',
        },
        {
          type: 'true_false',
          question: 'Rektifier setengah gelombang menggunakan satu diod untuk membenarkan hanya satu separuh kitaran AC melalui beban.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Satu diod menghasilkan output setengah gelombang kerana separuh kitaran songsang dihalang.',
        },
        {
          type: 'scenario',
          question: 'Sebuah radio kecil memerlukan bekalan DC daripada adapter AC. Litar mempunyai transformer, empat diod dan kapasitor. Terangkan peranan empat diod itu.',
          options: [],
          correct: 'Empat diod membentuk rektifier jambatan yang menukar kedua-dua separuh kitaran AC kepada DC berdenyut pada arah yang sama melalui beban.',
          explanation: 'Rektifier jambatan menggunakan empat diod untuk menghasilkan rektifikasi gelombang penuh.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun urutan fungsi dalam bekalan kuasa DC ringkas.',
          options: ['Kapasitor mengurangkan riak', 'Transformer menurunkan voltan AC', 'Diod merektifikasikan AC kepada DC berdenyut', 'Beban menerima voltan DC yang lebih licin'],
          correct: ['Transformer menurunkan voltan AC', 'Diod merektifikasikan AC kepada DC berdenyut', 'Kapasitor mengurangkan riak', 'Beban menerima voltan DC yang lebih licin'],
          explanation: 'Bekalan DC biasa menurunkan voltan dahulu, kemudian merektifikasikan dan melicinkan output.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata output rektifier satu diod ialah DC licin sepenuhnya. Apakah ralatnya?',
          options: [],
          correct: 'Output satu diod ialah DC berdenyut setengah gelombang; kapasitor atau penapis diperlukan untuk mengurangkan riak.',
          explanation: 'Rektifikasi sahaja menukar arah arus tetapi tidak semestinya menghapuskan variasi voltan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Electronics',
      subtopic: 'Transistor as a switch & amplifier',
      title: 'Elektronik: Transistor sebagai Suis dan Penguat',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Transistor bipolar seperti NPN mempunyai tiga terminal: pemancar, tapak dan pengumpul. Arus tapak yang kecil boleh mengawal arus pengumpul yang lebih besar. Sebagai suis, transistor berada dalam keadaan potong apabila arus tapak terlalu kecil dan keadaan tepu apabila arus tapak mencukupi, membolehkan beban seperti LED atau geganti dihidupkan. Sebagai penguat, perubahan kecil pada isyarat tapak menghasilkan perubahan lebih besar pada arus atau voltan output.'
        ),
        section(
          'Contoh kerja',
          'Dalam litar lampu automatik, LDR dan perintang boleh membentuk pembahagi voltan yang memberi voltan tapak kepada transistor. Apabila keadaan gelap, rintangan LDR meningkat dalam susunan tertentu lalu voltan tapak menjadi cukup tinggi untuk menghidupkan transistor NPN. Arus pengumpul mengalir melalui geganti atau LED, dan beban dihidupkan. Diod perlindungan dipasang merentasi geganti untuk menyerap d.g.e. balik apabila geganti dimatikan.'
        ),
        section(
          'Kekeliruan lazim',
          'Transistor bukan sekadar dua diod yang disambung untuk semua kegunaan; tindakan transistor memerlukan struktur dan pincangan yang betul. Beban yang besar tidak patut disambung terus kepada sensor kerana sensor biasanya tidak dapat membekalkan arus tinggi. Perintang tapak penting untuk mengehadkan arus tapak dan melindungi transistor.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Transistor | Komponen semikonduktor yang boleh mengawal atau menguatkan arus. |\n| Tapak | Terminal kawalan transistor bipolar. |\n| Pengumpul | Terminal laluan arus utama bagi transistor bipolar. |\n| Pemancar | Terminal rujukan laluan arus utama. |\n| Keadaan tepu | Keadaan transistor hidup penuh seperti suis tertutup. |'
        ),
        section(
          'Petua ingatan',
          'Ingat "tapak kecil kawal arus besar". Untuk suis NPN, tapak cukup positif berbanding pemancar menghidupkan transistor; tapak terlalu rendah mematikannya.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Dalam transistor NPN, terminal manakah biasanya menerima isyarat kawalan kecil?',
          options: ['Tapak', 'Pengumpul', 'Pemancar', 'Teras'],
          correct: { optionIndex: 0 },
          explanation: 'Arus atau voltan pada tapak mengawal arus antara pengumpul dan pemancar.',
        },
        {
          type: 'multiple_choice',
          question: 'Keadaan tepu transistor sebagai suis bermaksud',
          options: ['transistor hidup penuh dan membenarkan arus beban mengalir', 'transistor rosak kerana terlalu sejuk', 'tiada arus tapak langsung', 'transistor menukar AC kepada DC'],
          correct: { optionIndex: 0 },
          explanation: 'Dalam keadaan tepu, transistor bertindak hampir seperti suis tertutup.',
        },
        {
          type: 'true_false',
          question: 'Perintang tapak membantu mengehadkan arus ke tapak transistor.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Perintang tapak mengelakkan arus tapak berlebihan yang boleh merosakkan transistor.',
        },
        {
          type: 'scenario',
          question: 'Sistem kipas automatik menggunakan termistor. Apabila suhu bilik tinggi, kipas perlu hidup walaupun termistor hanya membekalkan arus kecil. Mengapa transistor sesuai digunakan?',
          options: [],
          correct: 'Transistor sesuai kerana arus tapak kecil daripada litar termistor boleh mengawal arus pengumpul yang lebih besar untuk menghidupkan kipas atau geganti.',
          explanation: 'Transistor bertindak sebagai suis elektronik yang memadankan sensor arus kecil dengan beban arus lebih besar.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun urutan operasi transistor NPN sebagai suis untuk menghidupkan LED.',
          options: ['Arus pengumpul mengalir melalui LED', 'Voltan tapak menjadi cukup tinggi', 'Transistor masuk keadaan tepu', 'LED menyala'],
          correct: ['Voltan tapak menjadi cukup tinggi', 'Transistor masuk keadaan tepu', 'Arus pengumpul mengalir melalui LED', 'LED menyala'],
          explanation: 'Isyarat tapak menghidupkan transistor dahulu, kemudian arus beban mengalir.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid menyambung motor terus kepada LDR tanpa transistor dan mendapati motor tidak berputar. Apakah ralat reka bentuknya?',
          options: [],
          correct: 'LDR ialah sensor dan tidak sesuai membekalkan arus motor yang besar; transistor atau geganti perlu digunakan untuk mengawal beban.',
          explanation: 'Sensor menghasilkan perubahan isyarat, manakala transistor membolehkan isyarat kecil mengawal arus beban.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Nuclear Physics',
      subtopic: 'Radioactive decay & half-life',
      title: 'Fizik Nuklear: Pereputan Radioaktif dan Separuh Hayat',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Pereputan radioaktif ialah proses rawak apabila nukleus tidak stabil memancarkan sinaran alfa, beta atau gama untuk menjadi lebih stabil. Aktiviti radioaktif ialah bilangan pereputan sesaat dan diukur dalam becquerel. Separuh hayat ialah masa yang diambil untuk bilangan nukleus tidak reput atau aktiviti sampel berkurang kepada separuh nilai asal. Separuh hayat tidak berubah oleh suhu, tekanan, keadaan kimia atau jisim sampel.'
        ),
        section(
          'Contoh kerja',
          'Sampel radioaktif mempunyai jisim 80 g dan separuh hayat 5 hari. Selepas 15 hari, bilangan separuh hayat ialah 15 / 5 = 3. Baki sampel tidak reput ialah 80 x (1/2)^3 = 80 / 8 = 10 g. Jika aktiviti awal 1600 Bq, aktiviti selepas tiga separuh hayat ialah 200 Bq.'
        ),
        section(
          'Kekeliruan lazim',
          'Selepas satu separuh hayat, sampel tidak hilang sepenuhnya; hanya separuh nukleus tidak stabil telah mereput. Pereputan satu nukleus tidak boleh diramal dengan tepat, tetapi pereputan banyak nukleus menghasilkan corak statistik yang boleh diukur. Sinaran alfa, beta dan gama mempunyai kuasa penembusan dan pengionan yang berbeza.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Radioisotop | Isotop tidak stabil yang mengalami pereputan radioaktif. |\n| Aktiviti | Bilangan pereputan sesaat, unit Bq. |\n| Separuh hayat | Masa untuk aktiviti atau bilangan nukleus tidak reput menjadi separuh. |\n| Sinar alfa | Nukleus helium yang bercas positif. |\n| Sinar beta | Elektron berkelajuan tinggi daripada pereputan nuklear. |'
        ),
        section(
          'Petua ingatan',
          'Untuk separuh hayat, bina rantai "asal, separuh, suku, satu perlapan". Bahagikan masa berlalu dengan separuh hayat untuk mendapatkan bilangan kali sampel dibahagi dua.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah maksud separuh hayat bahan radioaktif?',
          options: ['Masa untuk semua nukleus hilang', 'Masa untuk aktiviti atau bilangan nukleus tidak reput menjadi separuh', 'Masa untuk suhu sampel menjadi separuh', 'Masa untuk jisim atom menjadi dua kali ganda'],
          correct: { optionIndex: 1 },
          explanation: 'Separuh hayat menerangkan pengurangan kepada separuh bagi aktiviti atau bilangan nukleus tidak reput.',
        },
        {
          type: 'multiple_choice',
          question: 'Unit aktiviti radioaktif ialah',
          options: ['tesla', 'becquerel', 'volt', 'pascal'],
          correct: { optionIndex: 1 },
          explanation: 'Aktiviti diukur dalam becquerel, iaitu pereputan sesaat.',
        },
        {
          type: 'true_false',
          question: 'Separuh hayat radioisotop boleh dipendekkan dengan memanaskan sampel dalam makmal sekolah.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Separuh hayat ialah sifat nuklear dan tidak berubah oleh suhu atau keadaan kimia biasa.',
        },
        {
          type: 'numeric',
          question: 'Sampel 80 g mempunyai separuh hayat 5 hari. Berapakah jisim tidak reput selepas 15 hari?',
          options: [],
          correct: { value: 10, tolerance: 0.01, unit: 'g' },
          explanation: '15 hari bersamaan 3 separuh hayat. Baki = 80 / 2^3 = 10 g.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mengira aktiviti selepas beberapa separuh hayat.',
          options: ['Bahagikan aktiviti awal dengan 2^n', 'Tentukan separuh hayat bahan', 'Cari n = masa berlalu / separuh hayat', 'Tulis aktiviti baki dengan unit Bq'],
          correct: ['Tentukan separuh hayat bahan', 'Cari n = masa berlalu / separuh hayat', 'Bahagikan aktiviti awal dengan 2^n', 'Tulis aktiviti baki dengan unit Bq'],
          explanation: 'Bilangan separuh hayat menentukan berapa kali aktiviti dibahagi dua.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata selepas dua separuh hayat, aktiviti sampel menjadi sifar. Apakah ralatnya?',
          options: [],
          correct: 'Selepas dua separuh hayat, aktiviti menjadi satu perempat nilai asal, bukan sifar.',
          explanation: 'Pereputan radioaktif berkurang secara eksponen dan tidak menjadi sifar selepas bilangan separuh hayat yang kecil.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Nuclear Physics',
      subtopic: 'Fission, fusion & nuclear energy',
      title: 'Fizik Nuklear: Pembelahan, Pelakuran dan Tenaga Nuklear',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Pembelahan nuklear berlaku apabila nukleus berat seperti uranium-235 menyerap neutron dan berpecah kepada nukleus lebih ringan serta beberapa neutron baharu. Neutron baharu boleh mencetuskan tindak balas berantai. Pelakuran nuklear pula berlaku apabila nukleus ringan seperti isotop hidrogen bergabung membentuk nukleus lebih berat, membebaskan tenaga yang besar. Pelakuran memerlukan suhu dan tekanan sangat tinggi kerana nukleus bercas positif saling menolak.'
        ),
        section(
          'Contoh kerja',
          'Dalam reaktor nuklear, bahan api uranium mengalami pembelahan terkawal. Moderator memperlahankan neutron supaya pembelahan seterusnya lebih berkesan, rod kawalan menyerap neutron berlebihan untuk mengawal kadar tindak balas, dan penyejuk memindahkan tenaga haba untuk menghasilkan stim. Tenaga nuklear datang daripada kecacatan jisim, iaitu sebahagian jisim ditukar kepada tenaga mengikut E = mc^2.'
        ),
        section(
          'Kekeliruan lazim',
          'Reaktor nuklear bukan bom nuklear jika tindak balas berantai dikawal oleh rod kawalan dan reka bentuk keselamatan. Tenaga nuklear semasa operasi tidak membakar bahan api fosil, tetapi masih menghasilkan sisa radioaktif yang perlu diurus dengan teliti. Pelakuran di Matahari bukan tindak balas kimia; ia ialah tindak balas nuklear dalam keadaan suhu dan tekanan sangat tinggi.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pembelahan nuklear | Nukleus berat berpecah kepada nukleus lebih ringan. |\n| Pelakuran nuklear | Nukleus ringan bergabung menjadi nukleus lebih berat. |\n| Tindak balas berantai | Neutron daripada satu pembelahan mencetuskan pembelahan lain. |\n| Moderator | Bahan yang memperlahankan neutron dalam reaktor. |\n| Rod kawalan | Bahan penyerap neutron untuk mengawal kadar pembelahan. |'
        ),
        section(
          'Petua ingatan',
          'Ingat "fission splits, fusion fuses": pembelahan memecahkan nukleus berat, pelakuran menggabungkan nukleus ringan. Dalam reaktor, moderator melambatkan, rod kawalan mengawal.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah fungsi rod kawalan dalam reaktor nuklear?',
          options: ['Menyerap neutron berlebihan', 'Menukar AC kepada DC', 'Menyejukkan wap di turbin', 'Menghasilkan medan magnet B'],
          correct: { optionIndex: 0 },
          explanation: 'Rod kawalan menyerap neutron untuk mengawal kadar tindak balas berantai.',
        },
        {
          type: 'multiple_choice',
          question: 'Pelakuran nuklear ialah proses',
          options: ['nukleus ringan bergabung membentuk nukleus lebih berat', 'nukleus berat berpecah kerana menyerap neutron', 'elektron berpindah antara atom', 'air menyejat menjadi stim'],
          correct: { optionIndex: 0 },
          explanation: 'Pelakuran menggabungkan nukleus ringan dan membebaskan tenaga pada suhu sangat tinggi.',
        },
        {
          type: 'true_false',
          question: 'Moderator dalam reaktor nuklear digunakan untuk memperlahankan neutron.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Neutron perlahan lebih berkesan mencetuskan pembelahan U-235.',
        },
        {
          type: 'representation_match',
          question: 'Padankan komponen reaktor nuklear dengan fungsinya.',
          options: [
            { prompt: 'A: Bahan api', answer: 'Mengalami pembelahan nuklear' },
            { prompt: 'B: Moderator', answer: 'Memperlahankan neutron' },
            { prompt: 'C: Rod kawalan', answer: 'Menyerap neutron berlebihan' },
            { prompt: 'D: Penyejuk', answer: 'Memindahkan tenaga haba' },
          ],
          correct: {
            'A: Bahan api': 'Mengalami pembelahan nuklear',
            'B: Moderator': 'Memperlahankan neutron',
            'C: Rod kawalan': 'Menyerap neutron berlebihan',
            'D: Penyejuk': 'Memindahkan tenaga haba',
          },
          explanation: 'Setiap komponen menyokong pembelahan terkawal dan pemindahan tenaga dalam reaktor.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun urutan asas tindak balas berantai pembelahan U-235.',
          options: ['Nukleus berpecah dan membebaskan tenaga', 'Neutron perlahan diserap oleh U-235', 'Neutron baharu dibebaskan', 'Neutron baharu mencetuskan pembelahan lain'],
          correct: ['Neutron perlahan diserap oleh U-235', 'Nukleus berpecah dan membebaskan tenaga', 'Neutron baharu dibebaskan', 'Neutron baharu mencetuskan pembelahan lain'],
          explanation: 'Tindak balas berantai berlaku apabila neutron daripada satu pembelahan mencetuskan pembelahan seterusnya.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata tenaga Matahari terhasil daripada pembakaran hidrogen seperti pembakaran gas. Apakah ralatnya?',
          options: [],
          correct: 'Tenaga Matahari terhasil daripada pelakuran nuklear hidrogen, bukan pembakaran kimia dengan oksigen.',
          explanation: 'Pelakuran menukar sebahagian jisim nuklear kepada tenaga dan memerlukan keadaan suhu serta tekanan sangat tinggi.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Thermodynamics',
      subtopic: 'Gas laws (Boyle, Charles, Gay-Lussac)',
      title: 'Termodinamik: Hukum Gas',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Hukum gas menghubungkan tekanan, isipadu dan suhu bagi jisim gas tetap. Hukum Boyle menyatakan tekanan berkadar songsang dengan isipadu pada suhu tetap: P1V1 = P2V2. Hukum Charles menyatakan isipadu berkadar terus dengan suhu mutlak pada tekanan tetap: V1 / T1 = V2 / T2. Hukum Gay-Lussac atau hukum tekanan menyatakan tekanan berkadar terus dengan suhu mutlak pada isipadu tetap: P1 / T1 = P2 / T2. Suhu mesti dalam kelvin.'
        ),
        section(
          'Contoh kerja',
          'Gas mempunyai tekanan 100 kPa dan isipadu 3.0 dm3 pada suhu tetap. Jika isipadu dimampatkan kepada 1.5 dm3, P2 = P1V1 / V2 = 100 x 3.0 / 1.5 = 200 kPa. Untuk hukum Charles, 27 deg C mesti ditukar kepada 300 K sebelum digunakan. Jika suhu menjadi 600 K pada tekanan tetap, isipadu menjadi dua kali ganda.'
        ),
        section(
          'Kekeliruan lazim',
          'Jangan gunakan suhu dalam darjah Celsius terus dalam hukum gas kerana hubungan berkadar terus hanya sah untuk suhu mutlak. Hukum Boyle hanya sah apabila suhu tetap, manakala Hukum Charles hanya sah apabila tekanan tetap. Tekanan gas berpunca daripada perlanggaran molekul gas dengan dinding bekas.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Tekanan gas | Daya per unit luas akibat perlanggaran molekul gas. |\n| Suhu mutlak | Suhu dalam kelvin, K. |\n| Hukum Boyle | P berkadar songsang dengan V pada suhu tetap. |\n| Hukum Charles | V berkadar terus dengan T pada tekanan tetap. |\n| Hukum Gay-Lussac | P berkadar terus dengan T pada isipadu tetap. |'
        ),
        section(
          'Petua ingatan',
          'Sebelum guna hukum gas, bulatkan kuantiti yang tetap: T tetap guna Boyle, P tetap guna Charles, V tetap guna Gay-Lussac. Tukar deg C kepada K dengan menambah 273.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Hukum Boyle menyatakan bahawa bagi jisim gas tetap pada suhu tetap, tekanan berkadar',
          options: ['terus dengan isipadu', 'songsang dengan isipadu', 'terus dengan jisim', 'songsang dengan suhu mutlak'],
          correct: { optionIndex: 1 },
          explanation: 'Pada suhu tetap, P meningkat apabila V menurun, maka P berkadar songsang dengan V.',
        },
        {
          type: 'multiple_choice',
          question: 'Suhu manakah yang betul untuk digunakan dalam hukum gas?',
          options: ['Suhu dalam kelvin', 'Suhu dalam darjah Celsius tanpa penukaran', 'Suhu dalam peratus', 'Suhu dalam joule'],
          correct: { optionIndex: 0 },
          explanation: 'Hukum gas menggunakan suhu mutlak dalam unit kelvin.',
        },
        {
          type: 'true_false',
          question: 'Dalam Hukum Charles, isipadu gas berkadar terus dengan suhu mutlak jika tekanan tetap.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Hukum Charles ialah V / T = pemalar untuk tekanan tetap.',
        },
        {
          type: 'numeric',
          question: 'Gas pada 80 kPa mempunyai isipadu 5.0 dm3. Pada suhu tetap, isipadunya dimampatkan kepada 2.0 dm3. Hitung tekanan baharu.',
          options: [],
          correct: { value: 200, tolerance: 0.1, unit: 'kPa' },
          explanation: 'P2 = P1V1 / V2 = 80 x 5.0 / 2.0 = 200 kPa.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menyelesaikan masalah Hukum Charles.',
          options: ['Gunakan V1 / T1 = V2 / T2', 'Tukar suhu kepada kelvin', 'Kenal pasti tekanan adalah tetap', 'Selesaikan kuantiti yang tidak diketahui'],
          correct: ['Kenal pasti tekanan adalah tetap', 'Tukar suhu kepada kelvin', 'Gunakan V1 / T1 = V2 / T2', 'Selesaikan kuantiti yang tidak diketahui'],
          explanation: 'Hukum Charles hanya sesuai pada tekanan tetap dan memerlukan suhu kelvin.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid menggunakan 27 dan 54 sebagai suhu dalam Hukum Charles lalu menyimpulkan isipadu berganda. Apakah ralatnya?',
          options: [],
          correct: 'Suhu mesti ditukar kepada kelvin; 27 deg C = 300 K dan 54 deg C = 327 K, jadi isipadu tidak berganda.',
          explanation: 'Hubungan berkadar terus antara isipadu dan suhu hanya sah untuk suhu mutlak.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Waves',
      subtopic: 'Sound waves & interference',
      title: 'Gelombang: Bunyi dan Interferens',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Bunyi ialah gelombang mekanik membujur yang memerlukan medium untuk merambat. Zarah medium bergetar selari dengan arah perambatan, menghasilkan mampatan dan regangan. Laju gelombang bunyi memenuhi v = f lambda, dengan f sebagai frekuensi dan lambda sebagai panjang gelombang. Interferens berlaku apabila dua gelombang bertindih; interferens membina menghasilkan amplitud lebih besar, manakala interferens memusnah menghasilkan amplitud lebih kecil.'
        ),
        section(
          'Contoh kerja',
          'Jika bunyi berfrekuensi 680 Hz merambat di udara dengan laju 340 m s-1, panjang gelombangnya ialah lambda = v / f = 340 / 680 = 0.50 m. Dua pembesar suara yang memancarkan bunyi koheren boleh menghasilkan kawasan kuat dan lemah kerana beza lintasan gelombang. Beza lintasan n lambda memberi interferens membina, manakala beza lintasan (n + 1/2) lambda memberi interferens memusnah.'
        ),
        section(
          'Kekeliruan lazim',
          'Bunyi tidak boleh merambat melalui vakum kerana tiada zarah medium untuk bergetar. Bunyi lebih kuat bermaksud amplitud lebih besar, bukan frekuensi lebih tinggi. Frekuensi berkaitan dengan kenyaringan nada atau pitch. Interferens bukan kehilangan tenaga secara misteri; ia ialah hasil superposisi sesaran gelombang pada titik tertentu.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Gelombang membujur | Gelombang dengan getaran zarah selari arah perambatan. |\n| Mampatan | Kawasan zarah medium lebih rapat. |\n| Regangan | Kawasan zarah medium lebih renggang. |\n| Interferens membina | Pertindihan gelombang yang menambah amplitud. |\n| Interferens memusnah | Pertindihan gelombang yang mengurangkan amplitud. |'
        ),
        section(
          'Petua ingatan',
          'Untuk bunyi, ingat "medium mesti ada". Untuk v = f lambda, tutup kuantiti yang dicari: lambda = v / f dan f = v / lambda.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Bunyi dalam udara ialah gelombang',
          options: ['elektromagnet melintang', 'mekanik membujur', 'radioaktif', 'statik tanpa medium'],
          correct: { optionIndex: 1 },
          explanation: 'Bunyi memerlukan medium dan zarah bergetar selari dengan arah rambatan.',
        },
        {
          type: 'multiple_choice',
          question: 'Apakah yang meningkat apabila bunyi didengar lebih kuat?',
          options: ['Amplitud', 'Separuh hayat', 'Rintangan elektrik', 'Ketumpatan fluks magnet'],
          correct: { optionIndex: 0 },
          explanation: 'Kekuatan bunyi berkait dengan amplitud gelombang.',
        },
        {
          type: 'true_false',
          question: 'Bunyi boleh merambat melalui vakum dengan laju yang sama seperti cahaya.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'Bunyi memerlukan medium, manakala cahaya boleh merambat melalui vakum.',
        },
        {
          type: 'numeric',
          question: 'Bunyi berfrekuensi 680 Hz bergerak dengan laju 340 m s-1. Hitung panjang gelombang bunyi itu.',
          options: [],
          correct: { value: 0.5, tolerance: 0.001, unit: 'm' },
          explanation: 'lambda = v / f = 340 / 680 = 0.50 m.',
          points: 2,
        },
        {
          type: 'representation_match',
          question: 'Padankan istilah gelombang bunyi dengan maksudnya.',
          options: [
            { prompt: 'A: Mampatan', answer: 'Zarah medium lebih rapat' },
            { prompt: 'B: Regangan', answer: 'Zarah medium lebih renggang' },
            { prompt: 'C: Interferens membina', answer: 'Amplitud paduan lebih besar' },
            { prompt: 'D: Interferens memusnah', answer: 'Amplitud paduan lebih kecil' },
          ],
          correct: {
            'A: Mampatan': 'Zarah medium lebih rapat',
            'B: Regangan': 'Zarah medium lebih renggang',
            'C: Interferens membina': 'Amplitud paduan lebih besar',
            'D: Interferens memusnah': 'Amplitud paduan lebih kecil',
          },
          explanation: 'Istilah ini menerangkan struktur gelombang bunyi dan kesan superposisi.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata siren bernada tinggi semestinya lebih kuat kerana frekuensinya lebih tinggi. Apakah ralatnya?',
          options: [],
          correct: 'Nada tinggi berkaitan frekuensi tinggi, manakala kuat atau perlahan berkaitan amplitud.',
          explanation: 'Frekuensi dan amplitud menerangkan ciri bunyi yang berbeza.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Optics',
      subtopic: 'Lenses & optical instruments',
      title: 'Optik: Kanta dan Alat Optik',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Kanta cembung ialah kanta penumpu yang menumpukan sinar selari ke fokus utama. Kanta cekung ialah kanta pencapah yang menyebabkan sinar selari mencapah seolah-olah datang dari fokus. Bagi kanta nipis, hubungan antara jarak objek u, jarak imej v dan panjang fokus f diberi oleh 1/f = 1/u + 1/v. Pembesaran linear ialah m = v/u, dengan tanda dan orientasi imej ditentukan melalui rajah sinar.'
        ),
        section(
          'Contoh kerja',
          'Objek diletakkan 24 cm di hadapan kanta cembung dengan panjang fokus 12 cm. Guna 1/f = 1/u + 1/v: 1/12 = 1/24 + 1/v, maka 1/v = 1/24 dan v = 24 cm. Imej terbentuk pada jarak 24 cm di sebelah bertentangan kanta, nyata, songsang dan sama saiz kerana objek berada pada 2f.'
        ),
        section(
          'Kekeliruan lazim',
          'Kanta cembung tidak sentiasa menghasilkan imej nyata. Jika objek berada antara fokus dan kanta, imej yang terbentuk adalah maya, tegak dan diperbesar, seperti dalam kanta pembesar. Kanta cekung biasa menghasilkan imej maya, tegak dan diperkecil untuk objek nyata. Dalam kamera, imej nyata terbentuk pada sensor atau filem.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Kanta cembung | Kanta penumpu yang lebih tebal di tengah. |\n| Kanta cekung | Kanta pencapah yang lebih nipis di tengah. |\n| Fokus utama | Titik tempat sinar selari bertumpu atau kelihatan mencapah. |\n| Panjang fokus | Jarak antara pusat optik kanta dan fokus utama. |\n| Pembesaran | Nisbah saiz imej kepada saiz objek, m = v/u. |'
        ),
        section(
          'Petua ingatan',
          'Untuk kanta cembung, lukis tiga sinar utama: selari kemudian melalui fokus, melalui pusat optik terus, dan melalui fokus kemudian keluar selari. Kedudukan persilangan sinar menentukan lokasi imej.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Kanta cembung dikenali sebagai kanta penumpu kerana',
          options: ['ia menyerap semua cahaya', 'ia menumpukan sinar selari ke fokus', 'ia hanya berfungsi dalam gelap', 'ia tidak mempunyai panjang fokus'],
          correct: { optionIndex: 1 },
          explanation: 'Kanta cembung membiaskan sinar selari supaya bertumpu pada fokus utama.',
        },
        {
          type: 'multiple_choice',
          question: 'Apabila objek berada antara fokus dan kanta cembung, imej yang dilihat melalui kanta ialah',
          options: ['nyata, songsang dan diperkecil', 'maya, tegak dan diperbesar', 'nyata, tegak dan sama saiz', 'tiada imej langsung'],
          correct: { optionIndex: 1 },
          explanation: 'Keadaan ini digunakan dalam kanta pembesar untuk menghasilkan imej maya, tegak dan diperbesar.',
        },
        {
          type: 'true_false',
          question: 'Kanta cekung biasa mencapahkan sinar cahaya selari.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Kanta cekung ialah kanta pencapah.',
        },
        {
          type: 'numeric',
          question: 'Objek berada 24 cm dari kanta cembung dengan panjang fokus 12 cm. Hitung jarak imej.',
          options: [],
          correct: { value: 24, tolerance: 0.1, unit: 'cm' },
          explanation: '1/12 = 1/24 + 1/v, maka 1/v = 1/24 dan v = 24 cm.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah melukis rajah sinar untuk kanta cembung.',
          options: ['Lukis sinar melalui pusat optik tanpa sisihan', 'Tandakan fokus pada kedua-dua sisi kanta', 'Lukis sinar selari paksi utama lalu melalui fokus selepas kanta', 'Cari persilangan sinar untuk menentukan imej'],
          correct: ['Tandakan fokus pada kedua-dua sisi kanta', 'Lukis sinar selari paksi utama lalu melalui fokus selepas kanta', 'Lukis sinar melalui pusat optik tanpa sisihan', 'Cari persilangan sinar untuk menentukan imej'],
          explanation: 'Fokus perlu ditanda dahulu supaya sinar terbias boleh dilukis dengan betul.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata kanta cembung sentiasa menghasilkan imej nyata dan songsang. Apakah ralatnya?',
          options: [],
          correct: 'Jika objek berada dalam jarak fokus kanta cembung, imej yang terhasil adalah maya, tegak dan diperbesar.',
          explanation: 'Sifat imej kanta cembung bergantung pada kedudukan objek relatif kepada panjang fokus.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.question,
        question.options,
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm5Maths(client) {
  const subject = 'Matematik';
  const formLevel = 5;

  const mc = (text, options, optionIndex, explanation, points = 1) => ({
    type: 'multiple_choice',
    text,
    options,
    correct: { optionIndex },
    explanation,
    points,
  });
  const tf = (text, answer, explanation, points = 1) => ({
    type: 'true_false',
    text,
    options: ['Benar', 'Palsu'],
    correct: answer ? 'true' : 'false',
    explanation,
    points,
  });
  const numeric = (text, value, tolerance, unit, explanation, points = 2) => ({
    type: 'numeric',
    text,
    options: [],
    correct: { value, tolerance, unit },
    explanation,
    points,
  });
  const stepOrder = (text, steps, explanation, points = 2) => ({
    type: 'step_order',
    text,
    options: steps,
    correct: steps,
    explanation,
    points,
  });
  const errorDiagnosis = (text, correct, explanation, points = 2) => ({
    type: 'error_diagnosis',
    text,
    options: [],
    correct,
    explanation,
    points,
  });
  const scenario = (text, correct, explanation, points = 2) => ({
    type: 'scenario',
    text,
    options: [],
    correct,
    explanation,
    points,
  });

  const lessons = [
    {
      topic: 'Circular Measure',
      subtopic: 'Radian & arc length',
      difficulty: 'medium',
      title: 'Sukatan Membulat: Radian dan Panjang Lengkok',
      blocks: [
        section(
          'Konsep',
          'Radian ialah unit sudut yang menghubungkan sudut pusat dengan panjang lengkok pada bulatan. Satu radian terbentuk apabila panjang lengkok sama dengan jejari bulatan. Untuk menggunakan rumus panjang lengkok, sudut mesti dinyatakan dalam radian. Hubungan asas ialah s = r theta, dengan s sebagai panjang lengkok, r sebagai jejari dan theta sebagai sudut pusat dalam radian.'
        ),
        section(
          'Contoh Penyelesaian',
          `Sebuah bulatan mempunyai jejari 12 cm dan sudut pusat 150 darjah.
Tukar sudut kepada radian:
theta = 150 x pi / 180
theta = 5pi / 6

Cari panjang lengkok:
s = r theta
s = 12(5pi / 6)
s = 10pi cm

Jika pi = 3.142, maka s lebih kurang 31.42 cm.`
        ),
        section(
          'Kesilapan Lazim',
          'Kesilapan paling biasa ialah memasukkan sudut dalam darjah terus ke dalam rumus s = r theta. Rumus itu hanya sah apabila theta dalam radian. Murid juga sering tertukar antara panjang lengkok dengan luas sektor; panjang lengkok menggunakan r theta, manakala luas sektor menggunakan 1/2 r^2 theta. Pastikan jejari dan panjang lengkok menggunakan unit panjang yang sama.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Radian | Sudut pusat apabila panjang lengkok sama dengan jejari |\n| Panjang lengkok | Jarak sepanjang sebahagian lilitan bulatan |\n| Sudut pusat | Sudut yang terbentuk di pusat bulatan |\n| Jejari | Jarak dari pusat bulatan ke lilitan |\n| Pi | Nisbah lilitan bulatan kepada diameternya |'
        ),
        section(
          'Petua Ingatan',
          'Ingat susunan "tukar, rumus, ganti": tukar darjah kepada radian, tulis s = r theta, kemudian gantikan nilai. Jika jawapan panjang lengkok lebih besar daripada lilitan penuh, semak semula sudut kerana sudut mungkin tertukar.'
        ),
      ],
      questions: [
        mc(
          'Apakah nilai 180 darjah dalam radian?',
          ['pi / 2 radian', 'pi radian', '2pi radian', '180pi radian'],
          1,
          'Separuh pusingan bersamaan 180 darjah dan juga pi radian.'
        ),
        mc(
          'Rumus yang betul untuk panjang lengkok apabila theta dalam radian ialah',
          ['s = r + theta', 's = r theta', 's = theta / r', 's = 1/2 r^2 theta'],
          1,
          'Panjang lengkok berkadar terus dengan jejari dan sudut pusat dalam radian.'
        ),
        tf(
          'Rumus s = r theta boleh digunakan terus walaupun theta diberi dalam darjah.',
          false,
          'Theta mesti ditukar kepada radian sebelum rumus panjang lengkok digunakan.'
        ),
        numeric(
          'Cari panjang lengkok bagi jejari 7 cm dan sudut pusat pi / 3 radian. Beri jawapan perpuluhan kepada 2 tempat perpuluhan.',
          7.33,
          0.01,
          'cm',
          's = r theta = 7(pi / 3) = 7.33 cm jika pi = 3.142.'
        ),
        stepOrder(
          'Susun langkah mencari panjang lengkok bagi jejari 8 cm dan sudut pusat 135 darjah.',
          [
            'Tukar 135 darjah kepada radian: 135 x pi / 180 = 3pi / 4',
            'Tulis rumus panjang lengkok s = r theta',
            'Gantikan r = 8 dan theta = 3pi / 4',
            'Ringkaskan s = 8(3pi / 4) = 6pi cm',
          ],
          'Sudut perlu ditukar kepada radian sebelum digantikan ke dalam rumus.'
        ),
        errorDiagnosis(
          'Ali mengira panjang lengkok dengan jejari 10 cm dan sudut 60 darjah sebagai s = 10(60) = 600 cm. Apakah ralatnya?',
          'Ali menggunakan sudut dalam darjah secara terus; 60 darjah perlu ditukar kepada pi / 3 radian sebelum menggunakan s = r theta.',
          'Rumus panjang lengkok memerlukan sudut dalam radian, bukan darjah.'
        ),
      ],
    },
    {
      topic: 'Trigonometry',
      subtopic: 'Sine, cosine, tangent rules',
      difficulty: 'medium',
      title: 'Trigonometri: Peraturan Sinus, Kosinus dan Tangen',
      blocks: [
        section(
          'Konsep',
          'Dalam segi tiga bersudut tegak, nisbah trigonometri menghubungkan sudut tirus dengan sisi segi tiga. sin theta ialah sisi bertentangan dibahagi hipotenus, cos theta ialah sisi bersebelahan dibahagi hipotenus, dan tan theta ialah sisi bertentangan dibahagi sisi bersebelahan. Untuk segi tiga bukan bersudut tegak, petua sinus dan petua kosinus membantu mencari sisi atau sudut yang tidak diketahui. Pemilihan petua bergantung kepada maklumat yang diberi.'
        ),
        section(
          'Contoh Penyelesaian',
          `Segi tiga bersudut tegak mempunyai sisi bertentangan 9 cm dan sisi bersebelahan 12 cm bagi sudut theta.
Hipotenus = sqrt(9^2 + 12^2)
Hipotenus = sqrt(81 + 144)
Hipotenus = 15 cm

sin theta = 9 / 15 = 0.6
cos theta = 12 / 15 = 0.8
tan theta = 9 / 12 = 0.75`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan pilih sisi bertentangan dan bersebelahan tanpa merujuk kepada sudut yang sedang dikaji. Sisi bertentangan berubah apabila sudut rujukan berubah. Untuk petua sinus, pasangan sudut dan sisi bertentangan mesti sepadan. Untuk petua kosinus, tanda tolak dalam a^2 = b^2 + c^2 - 2bc cos A tidak boleh tertinggal.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Hipotenus | Sisi terpanjang yang bertentangan dengan sudut tegak |\n| Sisi bertentangan | Sisi yang bertentangan dengan sudut rujukan |\n| Sisi bersebelahan | Sisi yang menyentuh sudut rujukan selain hipotenus |\n| Petua sinus | Hubungan a / sin A = b / sin B = c / sin C |\n| Petua kosinus | Hubungan satu sisi dengan dua sisi lain dan sudut terkepung |'
        ),
        section(
          'Petua Ingatan',
          'Gunakan SOH-CAH-TOA untuk segi tiga bersudut tegak. Jika diberi dua sudut dan satu sisi, fikir petua sinus. Jika diberi dua sisi dan sudut terkepung atau tiga sisi, fikir petua kosinus.'
        ),
      ],
      questions: [
        mc(
          'Dalam segi tiga bersudut tegak, tan theta bersamaan',
          ['sisi bersebelahan / hipotenus', 'sisi bertentangan / sisi bersebelahan', 'hipotenus / sisi bertentangan', 'sisi bertentangan / hipotenus'],
          1,
          'Tangen ialah nisbah sisi bertentangan kepada sisi bersebelahan.'
        ),
        mc(
          'Keadaan manakah paling sesuai menggunakan petua kosinus?',
          ['Dua sudut dan satu sisi diberi', 'Dua sisi dan sudut terkepung diberi', 'Satu sudut tegak sahaja diberi', 'Hanya satu sisi diberi'],
          1,
          'Petua kosinus sesuai apabila dua sisi dan sudut terkepung diketahui, atau apabila tiga sisi diketahui.'
        ),
        tf(
          'Nilai sin theta dan cos theta sentiasa sama bagi semua sudut tirus.',
          false,
          'Nilai sin theta dan cos theta hanya sama pada sudut tertentu seperti 45 darjah.'
        ),
        numeric(
          'Dalam segi tiga bersudut tegak, sisi bertentangan sudut theta ialah 6 cm dan hipotenus ialah 10 cm. Cari sin theta.',
          0.6,
          0,
          '',
          'sin theta = sisi bertentangan / hipotenus = 6 / 10 = 0.6.'
        ),
        stepOrder(
          'Susun langkah mencari sisi c apabila a = 7 cm, b = 5 cm dan sudut terkepung C = 60 darjah menggunakan petua kosinus.',
          [
            'Tulis c^2 = a^2 + b^2 - 2ab cos C',
            'Gantikan nilai: c^2 = 7^2 + 5^2 - 2(7)(5)cos 60 darjah',
            'Kira c^2 = 49 + 25 - 35 = 39',
            'Ambil punca kuasa dua: c = sqrt(39) lebih kurang 6.24 cm',
          ],
          'Petua kosinus digunakan kerana dua sisi dan sudut terkepung diberi.'
        ),
        errorDiagnosis(
          'Seorang murid menulis sin A / a = sin B / b tetapi memasangkan sudut A dengan sisi yang bukan bertentangan dengannya. Apakah ralatnya?',
          'Dalam petua sinus, setiap sudut mesti dipasangkan dengan sisi yang bertentangan dengannya.',
          'Pasangan sudut-sisi yang salah akan menghasilkan nisbah yang salah walaupun rumus kelihatan betul.'
        ),
      ],
    },
    {
      topic: 'Permutations & Combinations',
      subtopic: 'Counting principles',
      difficulty: 'medium',
      title: 'Permutasi dan Gabungan: Prinsip Membilang',
      blocks: [
        section(
          'Konsep',
          'Prinsip pendaraban digunakan apabila satu proses berlaku melalui beberapa peringkat berturutan. Prinsip penambahan digunakan apabila pilihan adalah saling eksklusif, iaitu hanya satu kategori pilihan diambil. Permutasi digunakan apabila susunan penting, manakala gabungan digunakan apabila susunan tidak penting. Faktorial n!, permutasi nPr dan gabungan nCr memudahkan pengiraan apabila bilangan pilihan bertambah.'
        ),
        section(
          'Contoh Penyelesaian',
          `Sebuah kelab ingin memilih pengerusi dan setiausaha daripada 6 orang ahli.
Susunan jawatan penting kerana pengerusi dan setiausaha ialah peranan berbeza.
Bilangan cara = 6P2
6P2 = 6! / (6 - 2)!
6P2 = 6 x 5
6P2 = 30 cara

Jika hanya memilih 2 wakil tanpa jawatan, gunakan 6C2 = 15 cara.`
        ),
        section(
          'Kesilapan Lazim',
          'Kesilapan utama ialah menggunakan permutasi untuk situasi yang susunannya tidak penting. Contohnya memilih 3 murid sebagai wakil kelas tidak bergantung kepada urutan nama, jadi gabungan digunakan. Murid juga kadang-kadang menambah bilangan pilihan apabila sepatutnya mendarab, terutama bagi proses berturutan seperti memilih baju dan seluar. Baca perkataan seperti "susun", "kod", "jawatan" dan "urutan" sebagai petunjuk permutasi.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Prinsip pendaraban | Mendarab bilangan pilihan bagi peringkat berturutan |\n| Prinsip penambahan | Menambah bilangan pilihan bagi kes yang saling eksklusif |\n| Faktorial | Hasil darab integer positif hingga 1, contohnya 5! = 120 |\n| Permutasi | Pilihan objek apabila susunan penting |\n| Gabungan | Pilihan objek apabila susunan tidak penting |'
        ),
        section(
          'Petua Ingatan',
          'Tanya soalan ini dahulu: jika nama yang sama ditukar susunan, adakah hasilnya dianggap berbeza? Jika ya, gunakan permutasi. Jika tidak, gunakan gabungan.'
        ),
      ],
      questions: [
        mc(
          'Situasi manakah memerlukan permutasi?',
          ['Memilih 3 buah buku untuk didermakan', 'Memilih 2 murid sebagai wakil tanpa jawatan', 'Menyusun 4 murid dalam satu barisan', 'Memilih 5 soalan daripada 10 soalan'],
          2,
          'Permutasi digunakan kerana kedudukan dalam barisan menjadikan susunan berbeza.'
        ),
        mc(
          'Apakah rumus gabungan nCr?',
          ['n! / (n - r)!', 'n! / (r!(n - r)!)', 'r! / n!', '(n - r)! / n!'],
          1,
          'Gabungan membahagi permutasi dengan r! kerana susunan dalam kumpulan tidak dikira.'
        ),
        tf(
          'Memilih tiga ahli jawatankuasa tanpa jawatan khusus ialah contoh gabungan.',
          true,
          'Susunan nama tidak mengubah kumpulan ahli jawatankuasa yang dipilih.'
        ),
        numeric(
          'Cari nilai 5P2.',
          20,
          0,
          '',
          '5P2 = 5! / 3! = 5 x 4 = 20.'
        ),
        stepOrder(
          'Susun langkah mengira 7C3.',
          [
            'Tulis rumus 7C3 = 7! / (3!4!)',
            'Kembangkan bahagian perlu: 7 x 6 x 5 / (3 x 2 x 1)',
            'Ringkaskan 210 / 6',
            'Dapatkan jawapan 35',
          ],
          'Gabungan digunakan kerana hanya memilih 3 objek daripada 7 objek tanpa susunan.'
        ),
        errorDiagnosis(
          'Untuk memilih 2 wakil daripada 8 murid tanpa jawatan, seorang murid mengira 8P2 = 56. Apakah ralatnya?',
          'Dia menggunakan permutasi walaupun susunan wakil tidak penting; pengiraan betul ialah 8C2 = 28.',
          'Apabila peranan wakil sama, pasangan A-B dan B-A ialah pilihan yang sama.'
        ),
      ],
    },
    {
      topic: 'Probability',
      subtopic: 'Probability distributions',
      difficulty: 'hard',
      title: 'Kebarangkalian: Taburan Kebarangkalian',
      blocks: [
        section(
          'Konsep',
          'Taburan kebarangkalian bagi pemboleh ubah rawak diskret menyenaraikan semua nilai yang mungkin bersama kebarangkalian masing-masing. Jumlah semua kebarangkalian mesti sama dengan 1. Nilai jangkaan E(X) memberi purata jangka panjang bagi pemboleh ubah rawak dan dikira dengan jumlah xP(X = x). Untuk taburan binomial, percubaan mesti mempunyai bilangan ulangan tetap, dua hasil sahaja, kebarangkalian kejayaan tetap dan percubaan yang bebas.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi X dengan nilai 0, 1 dan 2.
P(X = 0) = 0.2, P(X = 1) = 0.5, P(X = 2) = 0.3.
Semakan jumlah kebarangkalian:
0.2 + 0.5 + 0.3 = 1

Nilai jangkaan:
E(X) = 0(0.2) + 1(0.5) + 2(0.3)
E(X) = 0 + 0.5 + 0.6
E(X) = 1.1`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan bina taburan yang jumlah kebarangkaliannya kurang atau lebih daripada 1. Dalam nilai jangkaan, setiap nilai x perlu didarab dengan kebarangkaliannya sendiri, bukan dengan jumlah kebarangkalian. Untuk taburan binomial, jangan gunakan rumus binomial jika kebarangkalian kejayaan berubah antara percubaan atau percubaan tidak bebas. Jawapan kebarangkalian mesti berada antara 0 dan 1.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Pemboleh ubah rawak | Kuantiti yang nilainya bergantung kepada hasil rawak |\n| Diskret | Nilai yang boleh disenaraikan satu demi satu |\n| Taburan kebarangkalian | Senarai nilai dan kebarangkalian masing-masing |\n| Nilai jangkaan | Purata teori bagi taburan kebarangkalian |\n| Taburan binomial | Taburan bagi bilangan kejayaan dalam percubaan bebas yang sama |'
        ),
        section(
          'Petua Ingatan',
          'Sebelum mengira nilai jangkaan, semak jumlah kebarangkalian dahulu. Untuk binomial, ingat empat syarat: bilangan tetap, dua hasil, kebarangkalian tetap dan bebas.'
        ),
      ],
      questions: [
        mc(
          'Syarat manakah mesti dipenuhi oleh taburan kebarangkalian diskret?',
          ['Semua kebarangkalian berjumlah 0', 'Semua kebarangkalian berjumlah 1', 'Semua nilai X mesti negatif', 'Setiap kebarangkalian mesti lebih daripada 1'],
          1,
          'Jumlah kebarangkalian bagi semua hasil yang mungkin mesti sama dengan 1.'
        ),
        mc(
          'Rumus nilai jangkaan bagi pemboleh ubah rawak diskret X ialah',
          ['E(X) = jumlah xP(X = x)', 'E(X) = jumlah x + P(X = x)', 'E(X) = jumlah P(X = x) / x', 'E(X) = nilai terbesar X sahaja'],
          0,
          'Nilai jangkaan ialah jumlah hasil darab setiap nilai dengan kebarangkaliannya.'
        ),
        tf(
          'Jika jumlah kebarangkalian dalam satu taburan ialah 1.2, taburan itu sah.',
          false,
          'Jumlah kebarangkalian tidak boleh melebihi 1.'
        ),
        numeric(
          'Diberi P(X = 0) = 0.2, P(X = 1) = 0.5 dan P(X = 2) = 0.3. Cari E(X).',
          1.1,
          0,
          '',
          'E(X) = 0(0.2) + 1(0.5) + 2(0.3) = 1.1.'
        ),
        stepOrder(
          'Susun langkah mencari P(X = 2) apabila X ialah bilangan kepala dalam 3 lambungan syiling adil.',
          [
            'Kenal pasti n = 3, r = 2 dan p = 0.5',
            'Tulis rumus binomial P(X = r) = nCr p^r(1 - p)^(n - r)',
            'Gantikan nilai: P(X = 2) = 3C2(0.5)^2(0.5)^1',
            'Kira jawapan 3(0.125) = 0.375',
          ],
          'Terdapat 3 susunan yang mempunyai tepat 2 kepala daripada 3 lambungan.'
        ),
        errorDiagnosis(
          'Seorang murid mengira E(X) bagi nilai 1, 2, 3 dengan kebarangkalian 0.2, 0.3, 0.5 sebagai (1 + 2 + 3) / 3 = 2. Apakah ralatnya?',
          'Dia mengira min biasa dan mengabaikan pemberat kebarangkalian; nilai jangkaan sepatutnya 1(0.2) + 2(0.3) + 3(0.5) = 2.3.',
          'Nilai yang lebih mungkin berlaku perlu memberi sumbangan lebih besar kepada nilai jangkaan.'
        ),
      ],
    },
    {
      topic: 'Matrices',
      subtopic: 'Matrix operations & inverse',
      difficulty: 'medium',
      title: 'Matriks: Operasi Matriks dan Songsang',
      blocks: [
        section(
          'Konsep',
          'Matriks ialah susunan nombor dalam baris dan lajur. Tertib matriks ditulis sebagai bilangan baris x bilangan lajur. Penambahan dan penolakan matriks hanya boleh dibuat untuk matriks yang sama tertib. Pendaraban matriks AB hanya tertakrif jika bilangan lajur A sama dengan bilangan baris B, dan songsang matriks 2 x 2 wujud apabila penentunya bukan sifar.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi A = [[2, 1], [5, 3]].
Penentu A:
det(A) = 2(3) - 1(5)
det(A) = 6 - 5
det(A) = 1

Songsang A:
A^-1 = 1 / det(A) [[3, -1], [-5, 2]]
A^-1 = [[3, -1], [-5, 2]]

Semakan ringkas: A didarab A^-1 menghasilkan matriks identiti.`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan tambah matriks berlainan tertib kerana kedudukan unsur tidak sepadan. Pendaraban matriks bukan pendaraban unsur sepadan semata-mata; setiap unsur hasil diperoleh melalui jumlah hasil darab baris dengan lajur. Songsang matriks tidak wujud jika penentu ialah sifar. Pendaraban matriks juga tidak semestinya komutatif, jadi AB biasanya tidak sama dengan BA.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Matriks | Susunan nombor dalam baris dan lajur |\n| Tertib | Saiz matriks, ditulis baris x lajur |\n| Penentu | Nilai ad - bc bagi matriks [[a, b], [c, d]] |\n| Matriks identiti | Matriks yang bertindak seperti 1 dalam pendaraban matriks |\n| Matriks songsang | Matriks A^-1 yang memenuhi AA^-1 = I |'
        ),
        section(
          'Petua Ingatan',
          'Untuk songsang matriks 2 x 2, ingat "tukar, tanda, bahagi": tukar kedudukan a dan d, tukar tanda b dan c, kemudian bahagi dengan penentu ad - bc.'
        ),
      ],
      questions: [
        mc(
          'Apakah tertib matriks yang mempunyai 3 baris dan 2 lajur?',
          ['2 x 3', '3 x 2', '5 x 1', '1 x 6'],
          1,
          'Tertib matriks ditulis sebagai bilangan baris diikuti bilangan lajur.'
        ),
        mc(
          'Dua matriks boleh ditambah jika',
          ['mempunyai penentu yang sama', 'mempunyai tertib yang sama', 'kedua-duanya matriks identiti', 'kedua-duanya mempunyai unsur positif sahaja'],
          1,
          'Penambahan matriks dilakukan unsur demi unsur pada kedudukan yang sepadan.'
        ),
        tf(
          'Secara umum, AB sentiasa sama dengan BA bagi pendaraban matriks.',
          false,
          'Pendaraban matriks tidak semestinya komutatif.'
        ),
        numeric(
          'Cari penentu matriks [[2, 3], [1, 4]].',
          5,
          0,
          '',
          'det = 2(4) - 3(1) = 8 - 3 = 5.'
        ),
        stepOrder(
          'Susun langkah mencari songsang bagi A = [[2, 1], [5, 3]].',
          [
            'Kira penentu: det(A) = 2(3) - 1(5) = 1',
            'Tukar kedudukan 2 dan 3 untuk bahagian pepenjuru utama',
            'Tukar tanda unsur 1 dan 5 menjadi -1 dan -5',
            'Bahagi semua unsur dengan det(A), maka A^-1 = [[3, -1], [-5, 2]]',
          ],
          'Langkah ini menggunakan rumus songsang matriks 2 x 2.'
        ),
        errorDiagnosis(
          'Seorang murid mendarab [[1, 2], [3, 4]] dengan [[5, 6], [7, 8]] secara unsur sepadan lalu mendapat [[5, 12], [21, 32]]. Apakah ralatnya?',
          'Dia melakukan pendaraban unsur sepadan, sedangkan pendaraban matriks perlu menggunakan hasil darab baris dengan lajur.',
          'Unsur pada hasil darab matriks diperoleh dengan menjumlahkan hasil darab unsur dalam satu baris dan satu lajur.'
        ),
      ],
    },
    {
      topic: 'Vectors',
      subtopic: 'Vector operations in 2D',
      difficulty: 'medium',
      title: 'Vektor: Operasi Vektor dalam 2D',
      blocks: [
        section(
          'Konsep',
          'Vektor mempunyai magnitud dan arah. Dalam satah Cartes, vektor 2D boleh ditulis sebagai pasangan komponen seperti (x, y). Penambahan dan penolakan vektor dilakukan mengikut komponen, manakala pendaraban skalar mengubah magnitud dan mungkin arah jika skalar negatif. Vektor dari titik A ke titik B boleh dicari dengan menolak vektor kedudukan A daripada vektor kedudukan B.'
        ),
        section(
          'Contoh Penyelesaian',
          `Diberi A(2, -1) dan B(5, 3).
Vektor AB = OB - OA
AB = (5, 3) - (2, -1)
AB = (5 - 2, 3 - (-1))
AB = (3, 4)

Magnitud AB = sqrt(3^2 + 4^2)
Magnitud AB = sqrt(25)
Magnitud AB = 5 unit`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan tertukar arah vektor AB dengan BA; AB = B - A tetapi BA = A - B. Apabila menolak komponen negatif, gunakan kurungan supaya tanda tidak tersalah. Magnitud vektor bukan jumlah mudah komponen, sebaliknya menggunakan teorem Pythagoras. Pendaraban skalar negatif menghasilkan vektor yang berlawanan arah.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Vektor | Kuantiti yang mempunyai magnitud dan arah |\n| Komponen | Nilai x dan y yang mewakili gerakan mendatar dan menegak |\n| Vektor kedudukan | Vektor dari asalan ke sesuatu titik |\n| Magnitud | Panjang atau saiz vektor |\n| Skalar | Nombor yang mendarab vektor dan mengubah magnitudnya |'
        ),
        section(
          'Petua Ingatan',
          'Untuk vektor AB, ingat "akhir tolak awal". Titik akhir ialah B dan titik awal ialah A, maka AB = B - A.'
        ),
      ],
      questions: [
        mc(
          'Jika u = (2, -3) dan v = (4, 5), apakah u + v?',
          ['(6, 2)', '(6, -8)', '(-2, 8)', '(8, 15)'],
          0,
          'Tambah komponen sepadan: (2 + 4, -3 + 5) = (6, 2).'
        ),
        mc(
          'Magnitud vektor (a, b) dikira dengan',
          ['a + b', 'a - b', 'sqrt(a^2 + b^2)', 'a^2 - b^2'],
          2,
          'Magnitud ialah panjang vektor dan dikira menggunakan teorem Pythagoras.'
        ),
        tf(
          'Vektor mempunyai magnitud dan arah.',
          true,
          'Dua ciri utama vektor ialah saiz dan arah.'
        ),
        numeric(
          'Cari magnitud vektor (3, 4).',
          5,
          0,
          'unit',
          'Magnitud = sqrt(3^2 + 4^2) = sqrt(25) = 5 unit.'
        ),
        stepOrder(
          'Susun langkah mencari vektor AB bagi A(2, -1) dan B(5, 3).',
          [
            'Tulis formula AB = OB - OA',
            'Gantikan koordinat: AB = (5, 3) - (2, -1)',
            'Tolak komponen sepadan: (5 - 2, 3 - (-1))',
            'Dapatkan AB = (3, 4)',
          ],
          'Vektor dari A ke B diperoleh dengan titik akhir tolak titik awal.'
        ),
        errorDiagnosis(
          'Untuk A(1, 2) dan B(4, 6), seorang murid mencari AB sebagai A - B = (-3, -4). Apakah ralatnya?',
          'Dia menolak dalam arah terbalik; AB sepatutnya B - A = (3, 4).',
          'Arah vektor penting kerana AB dan BA mempunyai magnitud sama tetapi arah bertentangan.'
        ),
      ],
    },
    {
      topic: 'Linear Programming',
      subtopic: 'Formulating & solving LP problems',
      difficulty: 'hard',
      title: 'Pengaturcaraan Linear: Membina dan Menyelesaikan Masalah',
      blocks: [
        section(
          'Konsep',
          'Pengaturcaraan linear digunakan untuk memaksimumkan atau meminimumkan fungsi objektif tertakluk kepada beberapa kekangan linear. Pemboleh ubah keputusan biasanya mewakili kuantiti yang hendak ditentukan, seperti bilangan produk. Kekangan ditulis sebagai ketaksamaan linear dan dilukis untuk membentuk rantau tersaur. Nilai optimum bagi fungsi objektif berlaku pada salah satu bucu rantau tersaur.'
        ),
        section(
          'Contoh Penyelesaian',
          `Sebuah bengkel menghasilkan x meja dan y kerusi.
Kekangan masa dan bahan ialah:
x + y <= 10
2x + y <= 14
x >= 0, y >= 0
Keuntungan ialah P = 40x + 30y.

Bucu rantau tersaur:
(0,0), (7,0), (4,6), (0,10)

Nilai P:
P(0,0) = 0
P(7,0) = 280
P(4,6) = 340
P(0,10) = 300

Keuntungan maksimum ialah RM340 apabila x = 4 dan y = 6.`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan terus memilih titik persilangan dua garis tanpa menyemak sama ada titik itu berada dalam rantau tersaur. Kekangan x >= 0 dan y >= 0 tidak boleh diabaikan kerana bilangan barang tidak boleh negatif. Apabila menentukan rantau, uji satu titik seperti (0,0) jika garis tidak melalui asalan. Untuk mencari optimum, nilai fungsi objektif perlu diuji pada semua bucu rantau tersaur.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Pemboleh ubah keputusan | Kuantiti yang hendak ditentukan dalam masalah |\n| Fungsi objektif | Ungkapan yang hendak dimaksimumkan atau diminimumkan |\n| Kekangan | Syarat dalam bentuk persamaan atau ketaksamaan linear |\n| Rantau tersaur | Kawasan yang memenuhi semua kekangan serentak |\n| Bucu optimum | Bucu rantau tersaur yang memberi nilai terbaik fungsi objektif |'
        ),
        section(
          'Petua Ingatan',
          'Gunakan urutan "ubah, kekang, lukis, bucu, nilai": takrif pemboleh ubah, bina kekangan, lukis rantau, cari bucu dan uji fungsi objektif.'
        ),
      ],
      questions: [
        mc(
          'Dalam pengaturcaraan linear, fungsi objektif ialah',
          ['garis paksi-x sahaja', 'ungkapan yang hendak dimaksimumkan atau diminimumkan', 'senarai semua titik dalam graf', 'jadual nilai rawak'],
          1,
          'Fungsi objektif mewakili sasaran seperti keuntungan maksimum atau kos minimum.'
        ),
        mc(
          'Nilai optimum bagi masalah pengaturcaraan linear dua pemboleh ubah berlaku pada',
          ['mana-mana titik di luar rantau tersaur', 'salah satu bucu rantau tersaur', 'titik tengah paksi-y sahaja', 'semua titik pada graf'],
          1,
          'Kaedah bucu menyatakan nilai optimum berlaku pada bucu rantau tersaur.'
        ),
        tf(
          'Kekangan x >= 0 dan y >= 0 penting apabila x dan y mewakili bilangan barang.',
          true,
          'Bilangan barang tidak boleh negatif, jadi kekangan bukan negatif perlu dimasukkan.'
        ),
        numeric(
          'Untuk P = 40x + 30y, cari P apabila x = 4 dan y = 6.',
          340,
          0,
          'RM',
          'P = 40(4) + 30(6) = 160 + 180 = 340.'
        ),
        stepOrder(
          'Susun langkah menyelesaikan masalah maksimum pengaturcaraan linear secara kaedah bucu.',
          [
            'Takrifkan pemboleh ubah keputusan',
            'Tulis fungsi objektif dan semua kekangan linear',
            'Lukis garis kekangan dan lorek rantau tersaur',
            'Cari semua bucu rantau tersaur dan nilai fungsi objektif pada setiap bucu',
            'Pilih bucu yang memberi nilai maksimum atau minimum mengikut soalan',
          ],
          'Kaedah bucu menguji calon optimum selepas rantau tersaur dikenal pasti.'
        ),
        errorDiagnosis(
          'Seorang murid mendapat titik persilangan (8, -2) dan terus memilihnya sebagai jawapan optimum bagi bilangan produk. Apakah ralatnya?',
          'Titik itu tidak sah jika y mewakili bilangan produk kerana y negatif; titik optimum mesti berada dalam rantau tersaur dan memenuhi semua kekangan.',
          'Setiap calon optimum perlu disemak terhadap semua kekangan termasuk kekangan bukan negatif.'
        ),
        scenario(
          'Sebuah bengkel menghasilkan x meja dan y kerusi. Kekangan ialah x + y <= 10, 2x + y <= 14, x >= 0, y >= 0. Keuntungan P = 40x + 30y. Apakah bilangan meja dan kerusi yang memberi keuntungan maksimum, dan berapakah keuntungan itu?',
          'Hasilkan 4 meja dan 6 kerusi untuk keuntungan maksimum RM340.',
          'Bucu rantau tersaur ialah (0,0), (7,0), (4,6) dan (0,10). Nilai P tertinggi ialah 340 pada (4,6).',
          3
        ),
      ],
    },
    {
      topic: 'Networks (Graphs)',
      subtopic: 'Graph theory basics',
      difficulty: 'medium',
      title: 'Rangkaian: Asas Teori Graf',
      blocks: [
        section(
          'Konsep',
          'Graf atau rangkaian terdiri daripada bucu dan tepi. Bucu mewakili objek seperti bandar, komputer atau stesen, manakala tepi mewakili hubungan antara objek tersebut. Darjah sesuatu bucu ialah bilangan tepi yang bersambung dengannya. Graf boleh digunakan untuk memodelkan laluan, rangkaian komunikasi, jadual tugas dan sambungan minimum antara lokasi.'
        ),
        section(
          'Contoh Penyelesaian',
          `Satu graf mempunyai 5 bucu dengan darjah 3, 2, 2, 1 dan 2.
Jumlah darjah = 3 + 2 + 2 + 1 + 2
Jumlah darjah = 10

Dalam mana-mana graf tak berarah:
jumlah darjah = 2 x bilangan tepi
Bilangan tepi = 10 / 2
Bilangan tepi = 5`
        ),
        section(
          'Kesilapan Lazim',
          'Jangan kira setiap tepi dua kali apabila melukis secara manual, tetapi ingat bahawa jumlah darjah memang mengira setiap tepi pada dua hujungnya. Laluan dan kitaran bukan perkara yang sama; kitaran bermula dan berakhir pada bucu yang sama. Pokok ialah graf bersambung tanpa kitaran, jadi pokok dengan n bucu mempunyai n - 1 tepi. Dalam masalah rangkaian, maksud tepi perlu jelas sama ada mewakili jarak, kos atau sambungan.'
        ),
        section(
          'Istilah Utama',
          '| Istilah | Maksud |\n|---|---|\n| Bucu | Titik dalam graf yang mewakili objek atau lokasi |\n| Tepi | Sambungan antara dua bucu |\n| Darjah | Bilangan tepi yang bersambung kepada satu bucu |\n| Laluan | Urutan bucu yang dihubungkan oleh tepi |\n| Pokok | Graf bersambung yang tidak mempunyai kitaran |'
        ),
        section(
          'Petua Ingatan',
          'Untuk graf tak berarah, gunakan semakan pantas: jumlah semua darjah mesti nombor genap kerana setiap tepi menyumbang 2 kepada jumlah darjah.'
        ),
      ],
      questions: [
        mc(
          'Dalam teori graf, tepi mewakili',
          ['titik data sahaja', 'sambungan antara dua bucu', 'nilai purata graf', 'paksi koordinat'],
          1,
          'Tepi menunjukkan hubungan atau sambungan antara bucu.'
        ),
        mc(
          'Graf lengkap K4 mempunyai berapa tepi?',
          ['4', '5', '6', '8'],
          2,
          'K4 mempunyai 4 bucu dan setiap pasangan bucu disambungkan, jadi bilangan tepi ialah 4C2 = 6.'
        ),
        tf(
          'Pokok dengan n bucu mempunyai n tepi.',
          false,
          'Pokok dengan n bucu mempunyai n - 1 tepi.'
        ),
        numeric(
          'Satu graf tak berarah mempunyai darjah bucu 3, 2, 2, 1 dan 2. Cari bilangan tepi.',
          5,
          0,
          '',
          'Jumlah darjah = 10. Bilangan tepi = 10 / 2 = 5.'
        ),
        stepOrder(
          'Susun langkah menentukan bilangan tepi daripada senarai darjah 4, 3, 3, 2, 2.',
          [
            'Jumlahkan semua darjah: 4 + 3 + 3 + 2 + 2 = 14',
            'Gunakan hubungan jumlah darjah = 2 x bilangan tepi',
            'Bahagi jumlah darjah dengan 2',
            'Dapatkan bilangan tepi = 7',
          ],
          'Dalam graf tak berarah, setiap tepi menyumbang kepada darjah dua bucu.'
        ),
        errorDiagnosis(
          'Seorang murid menyatakan graf bersambung dengan 6 bucu dan 6 tepi pasti pokok. Apakah ralatnya?',
          'Pokok dengan 6 bucu mesti mempunyai 5 tepi; 6 tepi menunjukkan sekurang-kurangnya satu kitaran jika graf itu bersambung.',
          'Syarat pokok ialah bersambung dan tiada kitaran, dengan bilangan tepi n - 1.'
        ),
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.text,
        question.options || [],
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function seedForm5AddMaths(client) {
  const subject = 'Matematik Tambahan';
  const formLevel = 5;
  const lessons = [
    {
      topic: 'Circular Measure',
      subtopic: 'Sector area & arc length',
      title: 'Sukatan Membulat: Luas Sektor dan Panjang Lengkok',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Sukatan membulat menggunakan radian untuk menghubungkan sudut pusat dengan panjang lengkok dan luas sektor. Jika jejari ialah r dan sudut pusat ialah theta radian, panjang lengkok ialah s = r theta. Luas sektor ialah A = 1/2 r^2 theta. Formula ini hanya terus sah apabila theta diberi dalam radian; sudut dalam darjah mesti ditukar dahulu kepada radian.'
        ),
        section(
          'Contoh kerja',
          'Sebuah sektor mempunyai jejari 7 cm dan sudut pusat 1.2 radian. Panjang lengkok ialah s = 7(1.2) = 8.4 cm. Luas sektor ialah A = 1/2(7^2)(1.2) = 29.4 cm^2. Jika perimeter sektor diperlukan, tambahkan dua jejari kepada panjang lengkok, iaitu 7 + 7 + 8.4 = 22.4 cm.'
        ),
        section(
          'Salah faham biasa',
          'Kesilapan paling lazim ialah menggunakan sudut dalam darjah terus dalam formula s = r theta atau A = 1/2 r^2 theta. Sudut 60 darjah bukan 60 radian; nilainya ialah pi/3 radian. Panjang lengkok bukan perimeter sektor kerana perimeter sektor juga mengandungi dua jejari. Untuk sektor major, pastikan sudut yang digunakan ialah sudut major, bukan sudut minor.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Radian | Sukatan sudut apabila panjang lengkok sama dengan jejari memberi sudut 1 radian. |\n| Panjang lengkok | Panjang bahagian lilitan yang dibatasi oleh sudut pusat. |\n| Sektor | Rantau bulatan yang dibatasi dua jejari dan satu lengkok. |\n| Sudut pusat | Sudut pada pusat bulatan yang membentuk sektor. |'
        ),
        section(
          'Petua ingatan',
          'Untuk radian, ingat dua formula pasangan: lengkok guna satu r, iaitu s = r theta; luas sektor guna r kuasa dua, iaitu A = 1/2 r^2 theta. Jika nampak darjah, tukar kepada radian sebelum mengira.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah formula luas sektor apabila sudut pusat theta diberi dalam radian?',
          options: ['A = 1/2 r^2 theta', 'A = r theta', 'A = 2 pi r theta', 'A = pi r^2 theta'],
          correct: { optionIndex: 0 },
          explanation: 'Luas sektor dalam radian ialah separuh hasil darab r^2 dengan theta.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Sudut 90 darjah bersamaan dengan',
          options: ['pi/2 radian', 'pi radian', '2pi radian', 'pi/4 radian'],
          correct: { optionIndex: 0 },
          explanation: '90 darjah ialah satu perempat pusingan, jadi nilainya ialah 2pi/4 = pi/2 radian.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Formula s = r theta boleh digunakan terus walaupun theta diberi dalam darjah.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Theta mesti berada dalam radian sebelum formula panjang lengkok digunakan.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari luas sektor berjari-jari 8 cm dengan sudut pusat 0.75 radian.',
          options: [],
          correct: { value: 24, tolerance: 0.01, unit: 'cm^2' },
          explanation: 'A = 1/2(8^2)(0.75) = 24 cm^2.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mencari panjang lengkok bagi sektor berjari-jari 6 cm dan sudut pusat 120 darjah.',
          options: ['Tukar 120 darjah kepada 2pi/3 radian.', 'Kenal pasti r = 6 dan theta = 2pi/3.', 'Gunakan formula s = r theta.', 'Kira s = 6(2pi/3).', 'Ringkaskan panjang lengkok kepada 4pi cm.'],
          correct: ['Tukar 120 darjah kepada 2pi/3 radian.', 'Kenal pasti r = 6 dan theta = 2pi/3.', 'Gunakan formula s = r theta.', 'Kira s = 6(2pi/3).', 'Ringkaskan panjang lengkok kepada 4pi cm.'],
          explanation: 'Sudut perlu ditukar kepada radian sebelum panjang lengkok dikira.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid mengira panjang lengkok sektor 60 darjah berjari-jari 5 cm sebagai 5(60) = 300 cm. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menggunakan 60 darjah sebagai 60 radian; sudut perlu ditukar kepada pi/3 radian dahulu.',
          explanation: 'Jawapan yang betul ialah s = 5(pi/3) = 5pi/3 cm.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Differentiation',
      subtopic: 'Chain, product & quotient rules',
      title: 'Pembezaan: Petua Rantai, Hasil Darab dan Hasil Bahagi',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Petua rantai digunakan apabila satu fungsi berada di dalam fungsi lain, contohnya y = (3x + 1)^5. Jika y = f(u) dan u = g(x), maka dy/dx = dy/du darab du/dx. Petua hasil darab menyatakan d(uv)/dx = u(dv/dx) + v(du/dx). Petua hasil bahagi menyatakan d(u/v)/dx = (v(du/dx) - u(dv/dx))/v^2, dengan v tidak sifar.'
        ),
        section(
          'Contoh kerja',
          'Jika y = (3x^2 + 1)^4, ambil u = 3x^2 + 1. Maka dy/du = 4u^3 dan du/dx = 6x, jadi dy/dx = 24x(3x^2 + 1)^3. Untuk y = (x^2 + 1)(3x - 2), gunakan hasil darab: dy/dx = (x^2 + 1)(3) + (3x - 2)(2x). Kedua-dua petua menjaga struktur ungkapan supaya faktor dalaman tidak tertinggal.'
        ),
        section(
          'Salah faham biasa',
          'Dalam petua rantai, ramai murid membezakan fungsi luar tetapi lupa mendarab terbitan fungsi dalam. Dalam petua hasil darab, terbitan uv bukan sekadar hasil darab dua terbitan. Dalam petua hasil bahagi, susunan pembilang penting: v(du/dx) ditolak u(dv/dx), bukan sebaliknya.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Petua rantai | Kaedah membezakan fungsi bergubah seperti f(g(x)). |\n| Petua hasil darab | Kaedah membezakan hasil darab dua fungsi. |\n| Petua hasil bahagi | Kaedah membezakan nisbah dua fungsi. |\n| Fungsi dalam | Ungkapan dalaman yang turut perlu dibezakan dalam petua rantai. |'
        ),
        section(
          'Petua ingatan',
          'Rantai bermaksud beza luar dahulu, kemudian darab beza dalam. Hasil darab ada dua bahagian yang ditambah. Hasil bahagi pula ingat susunan: bawah darab beza atas, tolak atas darab beza bawah, semuanya bahagi bawah kuasa dua.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah terbitan bagi y = (2x + 1)^5?',
          options: ['10(2x + 1)^4', '5(2x + 1)^4', '2(2x + 1)^5', '(2x + 1)^4'],
          correct: { optionIndex: 0 },
          explanation: 'Gunakan petua rantai: 5(2x + 1)^4 darab 2 = 10(2x + 1)^4.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika y = x^2(x + 3), apakah dy/dx?',
          options: ['3x^2 + 6x', '2x(x + 3)', 'x^2 + 2x', '3x^2 + 3'],
          correct: { optionIndex: 0 },
          explanation: 'Kembangkan dahulu y = x^3 + 3x^2, maka dy/dx = 3x^2 + 6x.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Dalam petua hasil bahagi, pembilang terbitan ialah u(dv/dx) - v(du/dx).',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Susunan yang betul ialah v(du/dx) - u(dv/dx).',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Jika y = (x^2 + 1)^3, cari dy/dx pada x = 2.',
          options: [],
          correct: { value: 300, tolerance: 0, unit: '' },
          explanation: 'dy/dx = 3(x^2 + 1)^2(2x). Pada x = 2, dy/dx = 3(5^2)(4) = 300.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah membezakan y = (x^2 + 1)(x - 4).',
          options: ['Ambil u = x^2 + 1 dan v = x - 4.', 'Cari du/dx = 2x dan dv/dx = 1.', 'Gunakan d(uv)/dx = u(dv/dx) + v(du/dx).', 'Gantikan menjadi (x^2 + 1)(1) + (x - 4)(2x).', 'Ringkaskan jika diperlukan.'],
          correct: ['Ambil u = x^2 + 1 dan v = x - 4.', 'Cari du/dx = 2x dan dv/dx = 1.', 'Gunakan d(uv)/dx = u(dv/dx) + v(du/dx).', 'Gantikan menjadi (x^2 + 1)(1) + (x - 4)(2x).', 'Ringkaskan jika diperlukan.'],
          explanation: 'Petua hasil darab memerlukan dua sebutan, satu untuk setiap fungsi yang dibezakan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid membezakan y = (3x - 1)^4 sebagai 4(3x - 1)^3. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tertinggal faktor terbitan fungsi dalam, iaitu d(3x - 1)/dx = 3.',
          explanation: 'Terbitan yang betul ialah 12(3x - 1)^3.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Integration',
      subtopic: 'Area under curve & between curves',
      title: 'Pengamiran: Luas di Bawah dan di Antara Lengkung',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Kamiran tentu boleh digunakan untuk mencari luas rantau di bawah lengkung atau di antara dua lengkung. Jika graf y = f(x) berada di atas paksi-x pada selang a <= x <= b, luas ialah integral dari a ke b bagi f(x) dx. Untuk luas di antara dua lengkung, gunakan integral fungsi atas tolak fungsi bawah. Jika graf memotong paksi-x atau dua lengkung bertukar kedudukan, selang perlu dipecahkan.'
        ),
        section(
          'Contoh kerja',
          'Luas di bawah y = 2x + 1 dari x = 0 hingga x = 3 ialah integral (2x + 1) dx = [x^2 + x] dari 0 ke 3 = 12 unit^2. Luas antara y = x + 4 dan y = x^2 dari x = 0 hingga x = 2 ialah integral (x + 4 - x^2) dx. Nilainya ialah [x^2/2 + 4x - x^3/3] dari 0 ke 2 = 22/3 unit^2.'
        ),
        section(
          'Salah faham biasa',
          'Nilai kamiran tentu boleh menjadi negatif, tetapi luas geometri tidak negatif. Untuk luas di antara dua lengkung, jangan tolak secara rawak; kenal pasti graf atas dan graf bawah pada selang tersebut. Jika sempadan x belum diberi, titik persilangan perlu dicari dahulu dengan menyamakan dua fungsi.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Kamiran tentu | Kamiran dengan had bawah dan had atas. |\n| Fungsi atas | Graf yang mempunyai nilai y lebih besar pada selang tertentu. |\n| Fungsi bawah | Graf yang mempunyai nilai y lebih kecil pada selang tertentu. |\n| Luas bertanda | Nilai kamiran yang mengambil kira tanda di atas atau bawah paksi-x. |'
        ),
        section(
          'Petua ingatan',
          'Untuk luas antara dua graf, fikir secara menegak: tinggi jalur kecil ialah atas tolak bawah. Kamiran menambah semua jalur kecil itu sepanjang selang.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Untuk mencari luas antara dua lengkung pada satu selang, integrand yang betul ialah',
          options: ['fungsi atas - fungsi bawah', 'fungsi bawah - fungsi atas', 'fungsi atas + fungsi bawah', 'hasil darab dua fungsi'],
          correct: { optionIndex: 0 },
          explanation: 'Luas jalur menegak ialah nilai y atas ditolak nilai y bawah.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Apakah nilai integral dari 0 ke 2 bagi 3x^2 dx?',
          options: ['8', '6', '12', '4'],
          correct: { optionIndex: 0 },
          explanation: 'Antiterbitan 3x^2 ialah x^3, maka [x^3] dari 0 ke 2 = 8.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Nilai kamiran tentu yang negatif boleh terus dilaporkan sebagai luas negatif.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Luas geometri tidak negatif; jika graf berada di bawah paksi-x, ambil nilai positif bagi rantau tersebut.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari luas di bawah lengkung y = 4x - x^2 dari x = 0 hingga x = 4.',
          options: [],
          correct: { value: 10.6667, tolerance: 0.01, unit: 'unit^2' },
          explanation: 'Luas = integral (4x - x^2) dx = [2x^2 - x^3/3] dari 0 ke 4 = 32 - 64/3 = 32/3.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mencari luas antara y = 6 - x dan y = x^2 dari x = 0 hingga x = 2.',
          options: ['Tentukan bahawa 6 - x berada di atas x^2 pada selang tersebut.', 'Tulis luas sebagai integral dari 0 ke 2 bagi (6 - x - x^2) dx.', 'Cari antiterbitan 6x - x^2/2 - x^3/3.', 'Gantikan had atas x = 2 dan had bawah x = 0.', 'Tolak nilai had bawah daripada nilai had atas.'],
          correct: ['Tentukan bahawa 6 - x berada di atas x^2 pada selang tersebut.', 'Tulis luas sebagai integral dari 0 ke 2 bagi (6 - x - x^2) dx.', 'Cari antiterbitan 6x - x^2/2 - x^3/3.', 'Gantikan had atas x = 2 dan had bawah x = 0.', 'Tolak nilai had bawah daripada nilai had atas.'],
          explanation: 'Graf garis berada di atas graf kuadratik pada 0 <= x <= 2.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid mencari luas antara y = x + 4 dan y = x^2 dari 0 hingga 2 dengan mengamir x^2 - (x + 4). Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menolak fungsi atas daripada fungsi bawah; pada selang itu fungsi atas ialah x + 4.',
          explanation: 'Integrand luas yang betul ialah (x + 4) - x^2.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Kinematics',
      subtopic: 'Displacement, velocity, acceleration functions',
      title: 'Kinematik: Fungsi Sesaran, Halaju dan Pecutan',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Dalam gerakan linear, sesaran s ialah kedudukan relatif kepada titik rujukan dan boleh bernilai positif atau negatif. Halaju ialah kadar perubahan sesaran, jadi v = ds/dt. Pecutan ialah kadar perubahan halaju, jadi a = dv/dt = d^2s/dt^2. Jumlah jarak tidak semestinya sama dengan sesaran akhir kerana jarak mengambil kira semua gerakan pergi dan balik tanpa tanda arah.'
        ),
        section(
          'Contoh kerja',
          'Jika s(t) = t^3 - 6t^2 + 9t meter, maka v(t) = 3t^2 - 12t + 9 dan a(t) = 6t - 12. Pada t = 2, halaju ialah v(2) = 12 - 24 + 9 = -3 m/s. Tanda negatif menunjukkan zarah bergerak dalam arah bertentangan dengan arah positif yang dipilih.'
        ),
        section(
          'Salah faham biasa',
          'Halaju negatif bukan bermaksud objek perlahan; ia menunjukkan arah gerakan. Laju ialah magnitud halaju dan sentiasa tidak negatif. Apabila mencari jumlah jarak, pecahkan gerakan pada masa halaju sifar kerana arah boleh bertukar di situ. Jangan bezakan s dua kali jika soalan hanya meminta halaju.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Sesaran | Kedudukan bertanda daripada titik rujukan. |\n| Halaju | Kadar perubahan sesaran terhadap masa. |\n| Pecutan | Kadar perubahan halaju terhadap masa. |\n| Laju | Magnitud halaju tanpa arah. |'
        ),
        section(
          'Petua ingatan',
          'Turun satu tingkat dengan pembezaan: s kepada v, v kepada a. Naik semula dengan pengamiran: a kepada v, v kepada s, dengan pemalar jika keadaan awal diberi.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Jika s ialah sesaran, halaju v diberi oleh',
          options: ['ds/dt', 'dt/ds', 'd^2s/dt^2', 's/t^2 sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Halaju ialah kadar perubahan sesaran terhadap masa.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika v(t) negatif pada suatu ketika, tafsiran yang tepat ialah',
          options: ['zarah bergerak dalam arah negatif', 'zarah mesti berhenti', 'pecutan mesti negatif', 'jarak mesti berkurang'],
          correct: { optionIndex: 0 },
          explanation: 'Tanda halaju menunjukkan arah gerakan relatif kepada paksi yang dipilih.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Jumlah jarak yang dilalui sentiasa sama dengan sesaran akhir.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Jika objek berpatah balik, jumlah jarak lebih besar daripada magnitud sesaran akhir.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Diberi s(t) = t^3 - 6t^2 + 9t meter. Cari halaju pada t = 4 saat.',
          options: [],
          correct: { value: 9, tolerance: 0.01, unit: 'm/s' },
          explanation: 'v(t) = 3t^2 - 12t + 9. Maka v(4) = 48 - 48 + 9 = 9 m/s.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mencari masa apabila zarah dengan s(t) = t^3 - 6t^2 + 9t berhenti seketika.',
          options: ['Bezakan s(t) untuk mendapatkan v(t).', 'Tulis v(t) = 3t^2 - 12t + 9.', 'Setkan v(t) = 0.', 'Bahagi dengan 3 untuk mendapat t^2 - 4t + 3 = 0.', 'Selesaikan t = 1 atau t = 3.'],
          correct: ['Bezakan s(t) untuk mendapatkan v(t).', 'Tulis v(t) = 3t^2 - 12t + 9.', 'Setkan v(t) = 0.', 'Bahagi dengan 3 untuk mendapat t^2 - 4t + 3 = 0.', 'Selesaikan t = 1 atau t = 3.'],
          explanation: 'Zarah berhenti seketika apabila halajunya sifar.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid menggunakan s(4) - s(0) sebagai jumlah jarak tanpa memeriksa perubahan arah. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menganggap sesaran bersih sama dengan jumlah jarak; perlu semak masa apabila v = 0 dan jumlahkan magnitud setiap bahagian gerakan.',
          explanation: 'Jumlah jarak memerlukan setiap segmen gerakan diambil sebagai nilai positif.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Trigonometric Functions',
      subtopic: 'Graphs & transformations',
      title: 'Fungsi Trigonometri: Graf dan Transformasi',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Graf trigonometri seperti y = a sin bx + c dan y = a cos bx + c berubah mengikut nilai a, b dan c. Amplitud ialah |a|, iaitu jarak maksimum dari garis tengah ke puncak graf. Untuk sudut dalam darjah, tempoh bagi sin bx atau cos bx ialah 360/b darjah jika b positif. Nilai c mengalih graf secara menegak dan membentuk garis tengah y = c.'
        ),
        section(
          'Contoh kerja',
          'Bagi y = 2 sin 3x + 1, amplitud ialah 2, tempoh ialah 360/3 = 120 darjah, dan garis tengah ialah y = 1. Nilai maksimum graf ialah 1 + 2 = 3, manakala nilai minimum ialah 1 - 2 = -1. Ini menunjukkan transformasi boleh dibaca terus daripada pekali dan pemalar.'
        ),
        section(
          'Salah faham biasa',
          'Pekali a mengubah tinggi graf, bukan tempohnya. Pekali b mengubah tempoh graf, bukan amplitudnya. Penambahan c tidak menjadikan graf lebih curam; ia hanya mengalih graf ke atas atau ke bawah. Tanda negatif pada a memantulkan graf pada garis tengah tetapi amplitud masih positif.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Amplitud | Jarak dari garis tengah ke nilai maksimum atau minimum. |\n| Tempoh | Panjang satu kitaran lengkap graf. |\n| Garis tengah | Garis mendatar di tengah ayunan graf. |\n| Transformasi | Perubahan bentuk, kedudukan atau orientasi graf. |'
        ),
        section(
          'Petua ingatan',
          'Dalam y = a sin bx + c, a kawal atas-bawah dari tengah, b kawal lebar satu kitaran, dan c angkat atau turunkan graf. Baca graf dengan mencari garis tengah dahulu.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Apakah amplitud bagi y = -3 cos x?',
          options: ['3', '-3', '1', '360'],
          correct: { optionIndex: 0 },
          explanation: 'Amplitud ialah nilai mutlak pekali, iaitu |-3| = 3.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Apakah tempoh bagi y = sin 2x jika x diukur dalam darjah?',
          options: ['180 darjah', '360 darjah', '90 darjah', '720 darjah'],
          correct: { optionIndex: 0 },
          explanation: 'Tempoh ialah 360/2 = 180 darjah.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Graf y = sin x + 2 mempunyai amplitud 3.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Penambahan 2 hanya mengalih graf ke atas; amplitud masih 1.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari nilai maksimum bagi y = 4 sin x - 1.',
          options: [],
          correct: { value: 3, tolerance: 0, unit: '' },
          explanation: 'Nilai maksimum sin x ialah 1, maka nilai maksimum y ialah 4(1) - 1 = 3.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah melakar ciri utama graf y = 2 sin x + 1.',
          options: ['Kenal pasti garis tengah y = 1.', 'Kenal pasti amplitud 2.', 'Cari nilai maksimum 3 dan minimum -1.', 'Gunakan tempoh asas 360 darjah.', 'Lakarkan bentuk sinus melalui titik utama satu kitaran.'],
          correct: ['Kenal pasti garis tengah y = 1.', 'Kenal pasti amplitud 2.', 'Cari nilai maksimum 3 dan minimum -1.', 'Gunakan tempoh asas 360 darjah.', 'Lakarkan bentuk sinus melalui titik utama satu kitaran.'],
          explanation: 'Ciri utama graf sinus datang daripada garis tengah, amplitud dan tempoh.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata tempoh y = 3 sin 2x ialah 60 darjah kerana membahagi 180 dengan 3. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menggunakan amplitud untuk mencari tempoh; tempoh bergantung pada pekali x, iaitu 360/2 = 180 darjah.',
          explanation: 'Pekali 3 menentukan amplitud, bukan tempoh.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Permutations & Combinations',
      subtopic: 'Advanced counting',
      title: 'Pilih Atur dan Gabungan: Pengiraan Lanjutan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Pengiraan lanjutan memilih kaedah berdasarkan sama ada susunan penting, objek berulang wujud, atau syarat tertentu dikenakan. Pilih atur digunakan apabila kedudukan atau peranan berbeza, manakala gabungan digunakan apabila hanya pemilihan kumpulan penting. Jika ada objek serupa, jumlah susunan perlu dibahagi dengan faktorial bilangan objek serupa. Untuk syarat seperti sekurang-kurangnya satu, kaedah pelengkap sering lebih cepat.'
        ),
        section(
          'Contoh kerja',
          'Bilangan susunan huruf bagi KATA ialah 4!/2! = 12 kerana huruf A berulang dua kali. Jika Ali dan Bala mesti duduk bersebelahan bersama tiga murid lain dalam satu baris, anggap Ali-Bala sebagai satu blok. Terdapat 4! susunan blok dan murid lain, serta 2! susunan dalam blok, jadi jumlahnya 4! x 2 = 48.'
        ),
        section(
          'Salah faham biasa',
          'Jangan gunakan nPr apabila soalan hanya memilih kumpulan tanpa jawatan. Jangan lupa membahagi dengan faktorial bagi objek yang sama, seperti huruf berulang. Untuk sekurang-kurangnya satu, mengira semua kes satu demi satu boleh menyebabkan tertinggal kes; pelengkap biasanya lebih kemas. Perkataan bersebelahan biasanya menandakan kaedah blok.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pilih atur | Susunan objek apabila urutan atau kedudukan penting. |\n| Gabungan | Pemilihan objek apabila urutan tidak penting. |\n| Objek serupa | Objek yang tidak dapat dibezakan antara satu sama lain. |\n| Kaedah pelengkap | Mengira jumlah semua kes tolak kes yang tidak dikehendaki. |'
        ),
        section(
          'Petua ingatan',
          'Tanya tiga soalan sebelum mengira: adakah susunan penting, adakah objek berulang, dan adakah syarat khas? Jawapan kepada tiga soalan ini menentukan formula yang sesuai.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Berapakah bilangan susunan berbeza bagi huruf BOOK?',
          options: ['12', '24', '6', '8'],
          correct: { optionIndex: 0 },
          explanation: 'Terdapat 4 huruf dengan O berulang dua kali, jadi jumlah susunan ialah 4!/2! = 12.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Frasa "sekurang-kurangnya satu" sering boleh dikira dengan lebih cepat menggunakan',
          options: ['kaedah pelengkap', 'petua hasil bahagi', 'teorem Pythagoras', 'pemfaktoran kuadratik'],
          correct: { optionIndex: 0 },
          explanation: 'Kira jumlah semua kes dan tolak kes tiada satu pun yang dikehendaki.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Dalam gabungan, susunan objek yang dipilih adalah penting.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Gabungan hanya mengambil kira kumpulan yang dipilih, bukan susunan.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Lima murid termasuk Ali dan Bala disusun dalam satu baris. Berapa susunan jika Ali dan Bala mesti bersebelahan?',
          options: [],
          correct: { value: 48, tolerance: 0, unit: 'susunan' },
          explanation: 'Anggap Ali dan Bala sebagai satu blok. Empat objek boleh disusun 4! cara dan dalam blok ada 2! cara, jadi 4! x 2 = 48.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mengira bilangan cara memilih 2 bola daripada 4 bola merah dan 3 bola biru supaya sekurang-kurangnya satu bola merah dipilih.',
          options: ['Kira jumlah semua pilihan 2 bola daripada 7 bola sebagai 7C2.', 'Kenal pasti kes pelengkap iaitu tiada bola merah.', 'Kira kes pelengkap sebagai 3C2.', 'Tolak kes pelengkap daripada jumlah semua pilihan.', 'Dapatkan 7C2 - 3C2 = 18.'],
          correct: ['Kira jumlah semua pilihan 2 bola daripada 7 bola sebagai 7C2.', 'Kenal pasti kes pelengkap iaitu tiada bola merah.', 'Kira kes pelengkap sebagai 3C2.', 'Tolak kes pelengkap daripada jumlah semua pilihan.', 'Dapatkan 7C2 - 3C2 = 18.'],
          explanation: 'Sekurang-kurangnya satu merah bermaksud semua kes kecuali kedua-duanya biru.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Untuk memilih seorang pengerusi dan seorang setiausaha daripada 8 murid, seorang murid menggunakan 8C2. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menggunakan gabungan walaupun jawatan pengerusi dan setiausaha berbeza; susunan peranan penting, jadi gunakan 8P2.',
          explanation: 'Ali sebagai pengerusi dan Bala sebagai setiausaha berbeza daripada Bala sebagai pengerusi dan Ali sebagai setiausaha.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Probability Distributions',
      subtopic: 'Binomial & normal distributions',
      title: 'Taburan Kebarangkalian: Binomial dan Normal',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Taburan binomial digunakan untuk bilangan kejayaan dalam n percubaan bebas yang sama jenis, dengan kebarangkalian kejayaan p yang tetap. Jika X mengikut taburan B(n, p), maka P(X = r) = nCr p^r(1 - p)^(n - r), min ialah np dan varians ialah np(1 - p). Taburan normal pula ialah taburan selanjar berbentuk loceng yang ditentukan oleh min mu dan sisihan piawai sigma. Nilai normal dipiawaikan dengan z = (x - mu)/sigma sebelum kebarangkalian dibaca daripada jadual atau kalkulator.'
        ),
        section(
          'Contoh kerja',
          'Jika X mengikuti B(5, 0.4), kebarangkalian tepat 2 kejayaan ialah 5C2(0.4)^2(0.6)^3 = 0.3456. Jika Y mengikuti N(50, 10^2), maka P(Y < 60) ditukar kepada P(Z < (60 - 50)/10) = P(Z < 1). Daripada nilai piawai normal, kebarangkalian ini kira-kira 0.8413.'
        ),
        section(
          'Salah faham biasa',
          'Untuk binomial, percubaan mesti bebas dan nilai p mesti tetap; jika syarat ini gagal, formula binomial tidak sesuai. Jangan lupa faktor (1 - p)^(n - r) dalam formula P(X = r). Untuk normal, sigma ialah sisihan piawai, bukan varians. Jika varians diberi sebagai sigma^2, ambil punca kuasa dua untuk mendapatkan sigma.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Pemboleh ubah rawak | Kuantiti bernombor yang bergantung pada hasil rawak. |\n| Taburan binomial | Taburan bilangan kejayaan dalam percubaan bebas dengan p tetap. |\n| Taburan normal | Taburan selanjar berbentuk loceng yang simetri pada min. |\n| Skor-z | Nilai piawai yang menunjukkan jarak daripada min dalam unit sisihan piawai. |'
        ),
        section(
          'Petua ingatan',
          'Binomial bertanya "berapa kejayaan". Normal bertanya "di mana kedudukan nilai ini berbanding min". Untuk normal, tukar kepada z dahulu; untuk binomial, semak n, r, p dan q = 1 - p.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Antara syarat berikut, yang manakah perlu untuk menggunakan taburan binomial?',
          options: ['Percubaan bebas dengan kebarangkalian kejayaan tetap', 'Data mesti berbentuk graf garis lurus', 'Bilangan percubaan mesti tidak diketahui', 'Setiap percubaan mempunyai banyak nilai min'],
          correct: { optionIndex: 0 },
          explanation: 'Binomial memerlukan bilangan percubaan tetap, percubaan bebas, dua hasil utama dan p tetap.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika X mengikuti B(n, p), min taburan ialah',
          options: ['np', 'n/p', 'p/n', 'np(1 - p)'],
          correct: { optionIndex: 0 },
          explanation: 'Min atau nilai jangkaan taburan binomial ialah np.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Varians bagi taburan binomial B(n, p) ialah np, bukan np(1 - p).',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Varians binomial ialah npq dengan q = 1 - p.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Jika X mengikuti B(4, 0.5), cari P(X = 2).',
          options: [],
          correct: { value: 0.375, tolerance: 0.001, unit: '' },
          explanation: 'P(X = 2) = 4C2(0.5)^2(0.5)^2 = 6(0.5)^4 = 0.375.',
          points: 2,
        },
        {
          type: 'numeric',
          question: 'Jika Y mengikuti N(100, 15^2), cari skor-z bagi Y = 130.',
          options: [],
          correct: { value: 2, tolerance: 0.01, unit: '' },
          explanation: 'z = (130 - 100)/15 = 2.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mencari P(Y < 70) apabila Y mengikuti N(60, 5^2).',
          options: ['Kenal pasti mu = 60 dan sigma = 5.', 'Tulis z = (x - mu)/sigma.', 'Gantikan x = 70.', 'Kira z = (70 - 60)/5 = 2.', 'Cari P(Z < 2) daripada jadual atau kalkulator normal piawai.'],
          correct: ['Kenal pasti mu = 60 dan sigma = 5.', 'Tulis z = (x - mu)/sigma.', 'Gantikan x = 70.', 'Kira z = (70 - 60)/5 = 2.', 'Cari P(Z < 2) daripada jadual atau kalkulator normal piawai.'],
          explanation: 'Piawaian menukar nilai Y kepada nilai Z yang boleh dirujuk pada taburan normal piawai.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid mengira P(X = 3) bagi B(5, 0.4) sebagai 5C3(0.4)^3 sahaja. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tertinggal faktor kegagalan (1 - p)^(n - r), iaitu 0.6^2.',
          explanation: 'Formula lengkap ialah 5C3(0.4)^3(0.6)^2.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Vectors',
      subtopic: 'Dot product & applications',
      title: 'Vektor: Hasil Darab Skalar dan Aplikasi',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Hasil darab skalar atau dot product bagi dua vektor menghasilkan nombor, bukan vektor. Bagi a = (x1, y1) dan b = (x2, y2), a dot b = x1x2 + y1y2; dalam tiga dimensi tambah juga z1z2. Secara geometri, a dot b = |a||b| cos theta. Dua vektor bukan sifar adalah serenjang apabila hasil darab skalarnya sifar.'
        ),
        section(
          'Contoh kerja',
          'Jika a = (3, 4) dan b = (2, -1), maka a dot b = 3(2) + 4(-1) = 2. Magnitud a ialah 5 dan magnitud b ialah sqrt(5), jadi cos theta = 2/(5sqrt(5)). Dalam aplikasi kerja, jika daya F dan sesaran d diberi sebagai vektor, kerja W = F dot d.'
        ),
        section(
          'Salah faham biasa',
          'Hasil darab skalar bukan pendaraban komponen demi komponen yang menghasilkan vektor baharu. Jika dot product sifar, sudut antara vektor ialah 90 darjah, bukan semestinya salah satu vektor sifar. Dot product negatif menunjukkan sudut tumpul antara vektor, bukan nilai magnitud negatif.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Hasil darab skalar | Operasi a dot b yang menghasilkan satu nombor. |\n| Magnitud | Panjang sesuatu vektor. |\n| Vektor serenjang | Dua vektor yang bersudut 90 darjah. |\n| Unjuran skalar | Komponen satu vektor pada arah vektor lain. |'
        ),
        section(
          'Petua ingatan',
          'Dot product ialah darab sepadan kemudian tambah. Jika jawapan sifar, fikir sudut tepat. Jika soalan melibatkan sudut, gunakan bentuk |a||b| cos theta.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Bagi a = (x1, y1) dan b = (x2, y2), apakah a dot b?',
          options: ['x1x2 + y1y2', 'x1y1 + x2y2', '(x1 + x2, y1 + y2)', 'x1x2 - y1y2'],
          correct: { optionIndex: 0 },
          explanation: 'Dot product mendarab komponen sepadan dan menjumlahkannya.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Jika a dot b = 0 untuk dua vektor bukan sifar, maka vektor tersebut',
          options: ['serenjang', 'selari sehala', 'mempunyai magnitud sama', 'mestilah vektor unit'],
          correct: { optionIndex: 0 },
          explanation: 'Dot product sifar bermaksud cos theta = 0, jadi theta = 90 darjah.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Dua vektor yang sehala sentiasa mempunyai dot product negatif.',
          options: ['Benar', 'Palsu'],
          correct: 'false',
          explanation: 'Vektor sehala mempunyai sudut 0 darjah, maka dot product positif jika kedua-duanya bukan sifar.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari dot product bagi a = (2, -3) dan b = (4, 1).',
          options: [],
          correct: { value: 5, tolerance: 0, unit: '' },
          explanation: 'a dot b = 2(4) + (-3)(1) = 8 - 3 = 5.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mencari sudut antara a = (1, 2) dan b = (3, 4).',
          options: ['Kira a dot b = 1(3) + 2(4).', 'Kira magnitud |a| dan |b|.', 'Gunakan cos theta = (a dot b)/(|a||b|).', 'Gantikan nilai yang dikira ke dalam rumus.', 'Cari theta menggunakan kosinus songsang.'],
          correct: ['Kira a dot b = 1(3) + 2(4).', 'Kira magnitud |a| dan |b|.', 'Gunakan cos theta = (a dot b)/(|a||b|).', 'Gantikan nilai yang dikira ke dalam rumus.', 'Cari theta menggunakan kosinus songsang.'],
          explanation: 'Hubungan dot product dengan kosinus sudut digunakan untuk mencari sudut antara vektor.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid menjawab (2, 3) dot (4, 5) sebagai (8, 15). Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menghasilkan vektor komponen; dot product sepatutnya nombor 2(4) + 3(5) = 23.',
          explanation: 'Hasil darab skalar mesti dijumlahkan selepas komponen sepadan didarab.',
          points: 2,
        },
        {
          type: 'scenario',
          question: 'Daya F = (6, 8) N menggerakkan objek dengan sesaran d = (3, 0) m. Cari kerja yang dilakukan.',
          options: [],
          correct: 'Kerja ialah 18 J kerana F dot d = 6(3) + 8(0) = 18.',
          explanation: 'Kerja oleh daya malar dalam arah sesaran dikira dengan dot product.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Linear Programming',
      subtopic: 'Optimisation problems',
      title: 'Pengaturcaraan Linear: Masalah Pengoptimuman',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep',
          'Pengaturcaraan linear mencari nilai maksimum atau minimum bagi fungsi objektif tertakluk kepada kekangan linear. Pemboleh ubah keputusan seperti x dan y mewakili kuantiti yang perlu ditentukan. Kekangan ditulis sebagai ketaksamaan linear, termasuk x >= 0 dan y >= 0 jika kuantiti tidak boleh negatif. Nilai optimum bagi rantau boleh laksana berbentuk poligon berlaku pada bucu, atau sepanjang sisi jika beberapa bucu memberi nilai sama.'
        ),
        section(
          'Contoh kerja',
          'Maksimumkan P = 30x + 20y tertakluk kepada x + y <= 10, 2x + y <= 14, x >= 0 dan y >= 0. Bucu rantau boleh laksana ialah (0,0), (0,10), (4,6) dan (7,0). Nilai P masing-masing ialah 0, 200, 240 dan 210. Oleh itu nilai maksimum ialah 240 pada x = 4 dan y = 6.'
        ),
        section(
          'Salah faham biasa',
          'Jangan pilih titik yang tidak memenuhi semua kekangan walaupun fungsi objektifnya besar. Jangan lupa kekangan bukan negatif apabila pemboleh ubah mewakili bilangan item. Titik optimum tidak dicari dengan mencuba titik rawak di dalam rantau; cukup semak semua bucu rantau boleh laksana. Jika pemboleh ubah perlu integer, jawapan perpuluhan mesti ditafsir semula mengikut konteks.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Fungsi objektif | Ungkapan yang hendak dimaksimumkan atau diminimumkan. |\n| Kekangan | Syarat linear yang mengehadkan nilai pemboleh ubah. |\n| Rantau boleh laksana | Set titik yang memenuhi semua kekangan. |\n| Bucu | Titik sudut rantau boleh laksana yang perlu diuji. |'
        ),
        section(
          'Petua ingatan',
          'Model dahulu, graf kemudian, uji bucu terakhir. Fungsi objektif memberitahu apa yang terbaik; kekangan memberitahu apa yang dibenarkan.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Jika x dan y mewakili bilangan produk, kekangan asas yang perlu ada ialah',
          options: ['x >= 0 dan y >= 0', 'x < 0 dan y < 0', 'x + y = 0 sahaja', 'x = y sentiasa'],
          correct: { optionIndex: 0 },
          explanation: 'Bilangan produk tidak boleh bernilai negatif.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Dalam masalah memaksimumkan keuntungan P = 12x + 9y, ungkapan P = 12x + 9y ialah',
          options: ['fungsi objektif', 'paksi-x', 'syarat bukan negatif', 'titik persilangan'],
          correct: { optionIndex: 0 },
          explanation: 'Fungsi objektif ialah kuantiti yang hendak dimaksimumkan atau diminimumkan.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Untuk fungsi objektif linear pada rantau poligon, nilai optimum boleh dicari dengan menguji bucu rantau boleh laksana.',
          options: ['Benar', 'Palsu'],
          correct: 'true',
          explanation: 'Teorem pengaturcaraan linear menyatakan optimum berlaku pada bucu atau sepanjang sisi antara bucu optimum.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Cari nilai maksimum P = 5x + 4y jika bucu rantau boleh laksana ialah (0,0), (0,6), (4,3) dan (5,0).',
          options: [],
          correct: { value: 32, tolerance: 0, unit: '' },
          explanation: 'Nilai P pada bucu ialah 0, 24, 32 dan 25. Maka maksimum ialah 32.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah menyelesaikan masalah pengaturcaraan linear dua pemboleh ubah.',
          options: ['Takrifkan pemboleh ubah keputusan.', 'Tulis fungsi objektif.', 'Tulis semua kekangan linear termasuk syarat bukan negatif.', 'Tentukan rantau boleh laksana dan bucunya.', 'Uji fungsi objektif pada setiap bucu untuk memilih nilai optimum.'],
          correct: ['Takrifkan pemboleh ubah keputusan.', 'Tulis fungsi objektif.', 'Tulis semua kekangan linear termasuk syarat bukan negatif.', 'Tentukan rantau boleh laksana dan bucunya.', 'Uji fungsi objektif pada setiap bucu untuk memilih nilai optimum.'],
          explanation: 'Penyelesaian bermula dengan model algebra sebelum nilai optimum diuji pada bucu.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid hanya menguji pintasan-x dan pintasan-y lalu mengabaikan titik persilangan dua kekangan. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah tidak menguji semua bucu rantau boleh laksana; titik persilangan dua kekangan juga boleh menjadi bucu optimum.',
          explanation: 'Semua bucu yang memenuhi kekangan perlu diuji dalam fungsi objektif.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Motion Graphs',
      subtopic: 'Interpreting displacement-time graphs',
      title: 'Graf Gerakan: Mentafsir Graf Sesaran-Masa',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep',
          'Graf sesaran-masa menunjukkan kedudukan bertanda sesuatu objek pada setiap masa. Kecerunan graf sesaran-masa mewakili halaju. Garis mendatar bermaksud halaju sifar kerana sesaran tidak berubah. Kecerunan positif menunjukkan gerakan arah positif, manakala kecerunan negatif menunjukkan gerakan arah negatif.'
        ),
        section(
          'Contoh kerja',
          'Jika sesaran bertambah secara linear daripada 0 m kepada 8 m dalam 4 saat, halaju ialah kecerunan 8/4 = 2 m/s. Jika graf mendatar dari t = 4 hingga t = 6 pada sesaran 8 m, objek berada pegun selama 2 saat. Jika sesaran turun daripada 8 m kepada 0 m dari t = 6 hingga t = 10, halaju ialah (0 - 8)/(10 - 6) = -2 m/s.'
        ),
        section(
          'Salah faham biasa',
          'Titik graf yang lebih tinggi tidak semestinya bermaksud objek bergerak lebih laju; laju bergantung pada kecerunan. Kecerunan negatif bukan nilai laju negatif, tetapi halaju dalam arah negatif. Sesaran sifar pada akhir gerakan tidak bermaksud jarak yang dilalui sifar. Untuk graf melengkung, halaju berubah dan kecerunan tangen digunakan.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Graf sesaran-masa | Graf yang memplot sesaran melawan masa. |\n| Kecerunan | Perubahan sesaran dibahagi perubahan masa. |\n| Halaju seragam | Halaju malar yang ditunjukkan oleh garis lurus. |\n| Pegun | Keadaan apabila sesaran tidak berubah terhadap masa. |'
        ),
        section(
          'Petua ingatan',
          'Pada graf sesaran-masa, baca kelajuan daripada cerun, bukan daripada tinggi graf. Cerun menaik ialah halaju positif, cerun menurun ialah halaju negatif, dan cerun sifar ialah pegun.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          question: 'Kecerunan graf sesaran-masa mewakili',
          options: ['halaju', 'pecutan', 'daya', 'jisim'],
          correct: { optionIndex: 0 },
          explanation: 'Halaju ialah perubahan sesaran dibahagi perubahan masa.',
          points: 1,
        },
        {
          type: 'multiple_choice',
          question: 'Segmen mendatar pada graf sesaran-masa menunjukkan objek',
          options: ['pegun', 'memecut secara seragam', 'bergerak dengan halaju negatif', 'bertambah laju'],
          correct: { optionIndex: 0 },
          explanation: 'Sesaran tidak berubah, maka halaju ialah sifar.',
          points: 1,
        },
        {
          type: 'true_false',
          question: 'Kecerunan negatif pada graf sesaran-masa menunjukkan halaju negatif.',
          options: ['Benar', 'Palsu'],
          correct: 'true',
          explanation: 'Halaju mengambil tanda arah, jadi cerun menurun memberi halaju negatif.',
          points: 1,
        },
        {
          type: 'numeric',
          question: 'Sesaran berubah daripada 3 m pada t = 2 s kepada 15 m pada t = 8 s. Cari halaju purata.',
          options: [],
          correct: { value: 2, tolerance: 0, unit: 'm/s' },
          explanation: 'Halaju purata = (15 - 3)/(8 - 2) = 12/6 = 2 m/s.',
          points: 2,
        },
        {
          type: 'step_order',
          question: 'Susun langkah mentafsir graf sesaran-masa bersegmen lurus.',
          options: ['Bahagikan graf kepada segmen lurus.', 'Cari perubahan sesaran bagi setiap segmen.', 'Cari perubahan masa bagi setiap segmen.', 'Kira kecerunan sebagai perubahan sesaran dibahagi perubahan masa.', 'Tafsir tanda kecerunan sebagai arah halaju.'],
          correct: ['Bahagikan graf kepada segmen lurus.', 'Cari perubahan sesaran bagi setiap segmen.', 'Cari perubahan masa bagi setiap segmen.', 'Kira kecerunan sebagai perubahan sesaran dibahagi perubahan masa.', 'Tafsir tanda kecerunan sebagai arah halaju.'],
          explanation: 'Setiap segmen lurus mempunyai halaju malar yang sama dengan kecerunannya.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          question: 'Seorang murid berkata bahagian graf yang lebih tinggi sentiasa menunjukkan objek lebih laju. Apakah kesilapannya?',
          options: [],
          correct: 'Kesilapan ialah menilai laju daripada kedudukan graf; laju ditentukan oleh magnitud kecerunan graf sesaran-masa.',
          explanation: 'Graf tinggi hanya menunjukkan sesaran besar, bukan semestinya gerakan laju.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.question,
        question.options || [],
        question.correct,
        question.explanation,
        question.points || 2,
        questionIndex + 1
      );
    }
  }
}

async function seedForm5CompSci(client) {
  const subject = 'Sains Komputer';
  const formLevel = 5;

  const lessons = [
    {
      topic: 'Object-Oriented Programming',
      subtopic: 'Classes, objects, encapsulation',
      title: 'Pengaturcaraan Berorientasikan Objek: Kelas, Objek dan Pengkapsulan',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Pengaturcaraan berorientasikan objek menyusun program berdasarkan objek yang mempunyai atribut dan kaedah. Kelas ialah acuan yang menerangkan atribut serta kaedah, manakala objek ialah contoh sebenar yang dibina daripada kelas itu. Pengkapsulan menggabungkan data dengan kaedah yang mengurus data tersebut dalam satu unit. Akses kepada data dalaman biasanya dikawal melalui kaedah awam supaya nilai objek tidak diubah secara tidak sah.'
        ),
        section(
          'Contoh berprogram',
          `Kelas AkaunBank boleh mempunyai atribut nomborAkaun dan baki. Kaedah deposit menambah baki, kaedah keluar mengurangkan baki jika wang mencukupi, dan kaedah paparBaki mengembalikan nilai baki. Objek akaunAina dan akaunRavi boleh dibina daripada kelas yang sama tetapi menyimpan nilai baki yang berbeza. Dengan pengkapsulan, kod luar tidak terus menukar baki; kod luar perlu menggunakan kaedah yang telah ditentukan.`
        ),
        section(
          'Awas salah faham',
          'Kelas bukan objek; kelas ialah reka bentuk, objek ialah kejadian sebenar semasa program berjalan. Atribut menerangkan keadaan objek, manakala kaedah menerangkan tingkah laku objek. Pengkapsulan bukan sekadar menyembunyikan semua data, tetapi mengawal cara data dicapai dan diubah. Nilai atribut yang sensitif seperti baki akaun patut diubah melalui kaedah yang boleh membuat semakan.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Kelas | Acuan yang mentakrifkan atribut dan kaedah objek |\n| Objek | Contoh sebenar yang dibina daripada kelas |\n| Atribut | Data atau ciri yang disimpan oleh objek |\n| Kaedah | Fungsi atau prosedur yang dimiliki oleh objek |\n| Pengkapsulan | Penggabungan data dan kaedah dengan kawalan capaian |'
        ),
        section(
          'Cara ingat',
          'Ingat K-O-A-K: kelas buat objek, objek ada atribut, kaedah kawal tindakan.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud kelas dalam pengaturcaraan berorientasikan objek?',
          options: ['Acuan yang mentakrifkan atribut dan kaedah objek', 'Nilai nombor yang sentiasa berubah', 'Ralat sintaks dalam program', 'Fail sementara yang tidak boleh digunakan semula'],
          correct: { optionIndex: 0 },
          explanation: 'Kelas bertindak sebagai reka bentuk untuk membina objek yang mempunyai struktur dan tingkah laku tertentu.',
        },
        {
          type: 'multiple_choice',
          text: 'Manakah contoh atribut bagi objek Murid?',
          options: ['namaMurid', 'kiraPurata()', 'paparKeputusan()', 'ulang sehingga tamat'],
          correct: { optionIndex: 0 },
          explanation: 'namaMurid ialah data yang menerangkan keadaan objek Murid, maka ia ialah atribut.',
        },
        {
          type: 'true_false',
          text: 'Pengkapsulan membantu mengawal capaian kepada data dalaman objek.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Pengkapsulan membenarkan data diurus melalui kaedah yang sah, contohnya setter, getter atau kaedah domain seperti deposit.',
        },
        {
          type: 'code_trace',
          text: `Jejak pseudokod berorientasikan objek berikut. Apakah output akhir?

class Akaun
  private baki
  constructor(nilaiAwal)
    baki = nilaiAwal
  method deposit(amaun)
    baki = baki + amaun
  method paparBaki()
    return baki

akaun = Akaun(120)
akaun.deposit(30)
papar akaun.paparBaki()`,
          options: [],
          correct: '150',
          explanation: 'Objek akaun bermula dengan baki 120. Kaedah deposit menambah 30, jadi paparBaki mengembalikan 150.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah membina dan menggunakan objek daripada kelas.',
          options: [
            'Panggil kaedah objek untuk melaksanakan tindakan',
            'Tetapkan atribut dan kaedah dalam kelas',
            'Bina objek baharu daripada kelas',
            'Beri nilai awal kepada atribut melalui constructor',
          ],
          correct: [
            'Tetapkan atribut dan kaedah dalam kelas',
            'Bina objek baharu daripada kelas',
            'Beri nilai awal kepada atribut melalui constructor',
            'Panggil kaedah objek untuk melaksanakan tindakan',
          ],
          explanation: 'Kelas perlu ditakrifkan dahulu sebelum objek dicipta, diberi nilai awal dan digunakan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid membenarkan kod luar menetapkan baki akaun kepada -500 tanpa semakan. Apakah ralat reka bentuk OOP dalam situasi ini?',
          options: [],
          correct: 'Data baki tidak dikapsulkan dengan baik kerana kod luar boleh mengubah nilai sensitif tanpa melalui kaedah yang membuat semakan sah.',
          explanation: 'Atribut sensitif patut dikawal supaya peraturan seperti baki tidak negatif boleh dikuatkuasakan dalam kaedah kelas.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Object-Oriented Programming',
      subtopic: 'Inheritance & polymorphism',
      title: 'Pewarisan dan Polimorfisme',
      difficulty: 'hard',
      blocks: [
        section(
          'Konsep utama',
          'Pewarisan membolehkan kelas baharu mewarisi atribut dan kaedah daripada kelas sedia ada. Kelas induk menyimpan ciri umum, manakala kelas anak menambah atau mengubah tingkah laku yang lebih khusus. Polimorfisme berlaku apabila panggilan kaedah yang sama menghasilkan tingkah laku berbeza mengikut jenis objek sebenar. Konsep ini mengurangkan pengulangan kod dan membantu program berkembang secara lebih teratur.'
        ),
        section(
          'Contoh berprogram',
          `Kelas Haiwan boleh mempunyai kaedah bergerak. Kelas Burung dan Ikan mewarisi Haiwan, tetapi Burung boleh menulis semula kaedah bergerak supaya memaparkan "terbang" dan Ikan memaparkan "berenang". Apabila senarai objek Haiwan mengandungi Burung dan Ikan, program boleh memanggil bergerak pada setiap objek tanpa perlu tahu jenis khususnya terlebih dahulu. Kaedah yang sama dipanggil, tetapi hasilnya mengikut objek sebenar.`
        ),
        section(
          'Awas salah faham',
          'Pewarisan tidak bermaksud semua kelas patut diwariskan; gunakan pewarisan apabila hubungan "ialah sejenis" benar. Kelas Kereta ialah sejenis Kenderaan, tetapi Enjin bukan sejenis Kereta. Polimorfisme bukan sekadar mempunyai nama kaedah yang sama; objek berbeza perlu memberi pelaksanaan yang sesuai. Overriding berlaku apabila kelas anak menyediakan versi kaedah yang menggantikan versi kelas induk.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Kelas induk | Kelas umum yang mewariskan ciri kepada kelas lain |\n| Kelas anak | Kelas khusus yang mewarisi kelas induk |\n| Pewarisan | Mekanisme menggunakan semula atribut dan kaedah kelas induk |\n| Overriding | Kelas anak menulis semula kaedah kelas induk |\n| Polimorfisme | Kaedah sama memberi tingkah laku berbeza mengikut objek |'
        ),
        section(
          'Cara ingat',
          'Pewarisan jawab "siapa mewarisi siapa"; polimorfisme jawab "kaedah sama bertindak bagaimana".'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Hubungan manakah paling sesuai untuk pewarisan?',
          options: ['Kereta ialah sejenis Kenderaan', 'Tayar ialah sejenis Kereta', 'Kata laluan ialah sejenis Monitor', 'Fail ialah sejenis Pencetak'],
          correct: { optionIndex: 0 },
          explanation: 'Pewarisan sesuai apabila kelas anak ialah versi khusus bagi kelas induk.',
        },
        {
          type: 'multiple_choice',
          text: 'Apakah maksud polimorfisme dalam OOP?',
          options: ['Panggilan kaedah yang sama boleh memberi tingkah laku berbeza mengikut objek', 'Semua atribut mesti bernilai nombor', 'Program hanya boleh mempunyai satu kelas', 'Data tidak boleh disimpan dalam objek'],
          correct: { optionIndex: 0 },
          explanation: 'Polimorfisme membolehkan objek berbeza bertindak mengikut pelaksanaan kaedah masing-masing.',
        },
        {
          type: 'true_false',
          text: 'Overriding berlaku apabila kelas anak menyediakan pelaksanaan baharu untuk kaedah yang diwarisi.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Kelas anak boleh menyesuaikan tingkah laku kaedah kelas induk melalui overriding.',
        },
        {
          type: 'code_trace',
          text: `Jejak pseudokod berikut. Apakah output yang dipaparkan?

class Notifikasi
  method hantar()
    return "hantar umum"

class Emel extends Notifikasi
  method hantar()
    return "hantar emel"

class SMS extends Notifikasi
  method hantar()
    return "hantar sms"

senarai = [Emel(), SMS()]
untuk setiap item dalam senarai
  papar item.hantar()`,
          options: [],
          correct: 'hantar emel, hantar sms',
          explanation: 'Objek Emel dan SMS menulis semula kaedah hantar, jadi panggilan yang sama menghasilkan output khusus bagi setiap objek.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah mereka bentuk pewarisan bagi Kenderaan, Kereta dan Motosikal.',
          options: [
            'Letakkan ciri umum seperti jenama dalam kelas Kenderaan',
            'Kenal pasti bahawa Kereta dan Motosikal ialah sejenis Kenderaan',
            'Cipta kelas anak Kereta dan Motosikal yang mewarisi Kenderaan',
            'Tambah atau override kaedah khusus dalam kelas anak',
          ],
          correct: [
            'Kenal pasti bahawa Kereta dan Motosikal ialah sejenis Kenderaan',
            'Letakkan ciri umum seperti jenama dalam kelas Kenderaan',
            'Cipta kelas anak Kereta dan Motosikal yang mewarisi Kenderaan',
            'Tambah atau override kaedah khusus dalam kelas anak',
          ],
          explanation: 'Reka bentuk pewarisan bermula dengan hubungan kelas, kemudian ciri umum diletakkan dalam kelas induk.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid membuat kelas PapanKekunci mewarisi kelas Komputer kerana papan kekunci digunakan bersama komputer. Mengapa reka bentuk ini tidak tepat?',
          options: [],
          correct: 'PapanKekunci bukan sejenis Komputer; hubungannya lebih sesuai sebagai komponen atau penggunaan, bukan pewarisan.',
          explanation: 'Pewarisan perlu mewakili hubungan "ialah sejenis", bukan hubungan "mempunyai" atau "digunakan oleh".',
          points: 2,
        },
      ],
    },
    {
      topic: 'Algorithms',
      subtopic: 'Sorting algorithms (Bubble, Selection)',
      title: 'Algoritma Isihan: Bubble Sort dan Selection Sort',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Algoritma isihan menyusun data mengikut tertib seperti menaik atau menurun. Bubble sort membandingkan dua item berjiran dan menukar kedudukan jika tertibnya salah; selepas satu laluan lengkap, item terbesar biasanya berada di hujung bagi isihan menaik. Selection sort mencari item terkecil dalam bahagian belum terisih dan menukarnya ke kedudukan hadapan. Kedua-duanya mudah difahami tetapi tidak cekap untuk data yang sangat besar kerana perbandingan berulang.'
        ),
        section(
          'Contoh berprogram',
          `Untuk senarai [5, 2, 4], satu laluan bubble sort menaik bermula dengan membandingkan 5 dan 2 lalu menukar menjadi [2, 5, 4]. Seterusnya 5 dan 4 dibandingkan lalu ditukar menjadi [2, 4, 5]. Dalam selection sort pula, algoritma mencari nilai terkecil 2 dan menukarnya ke indeks pertama. Selepas setiap laluan, bahagian awal senarai selection sort menjadi semakin terisih.`
        ),
        section(
          'Awas salah faham',
          'Bubble sort tidak memilih nilai terkecil secara terus; ia menolak nilai besar ke hujung melalui pertukaran berjiran. Selection sort tidak menukar setiap pasangan berjiran; ia mencari calon minimum dahulu sebelum membuat pertukaran. Tertib menaik bermaksud nilai kecil ke besar, manakala tertib menurun bermaksud nilai besar ke kecil. Senarai mungkin memerlukan lebih daripada satu laluan sebelum lengkap terisih.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Isihan | Proses menyusun data mengikut tertib tertentu |\n| Bubble sort | Isihan yang membandingkan item berjiran dan menukar jika perlu |\n| Selection sort | Isihan yang memilih nilai minimum atau maksimum dari bahagian belum terisih |\n| Laluan | Satu pusingan semakan melalui senarai |\n| Pertukaran | Menukar kedudukan dua item dalam senarai |'
        ),
        section(
          'Cara ingat',
          'Bubble menolak nilai besar ke hujung; selection memilih nilai kecil untuk diletakkan di hadapan.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Dalam bubble sort menaik, apakah tindakan utama algoritma?',
          options: ['Membandingkan item berjiran dan menukar jika tertib salah', 'Mencari alamat IP pelayan', 'Membahagi senarai kepada dua secara rawak', 'Menukar semua nombor kepada teks'],
          correct: { optionIndex: 0 },
          explanation: 'Bubble sort bekerja melalui perbandingan pasangan berjiran secara berulang.',
        },
        {
          type: 'multiple_choice',
          text: 'Dalam selection sort menaik, apakah yang dipilih pada setiap laluan bahagian belum terisih?',
          options: ['Nilai terkecil', 'Nama pemboleh ubah terpanjang', 'Protokol rangkaian', 'Nilai Boolean sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Selection sort menaik memilih nilai minimum dan meletakkannya di kedudukan awal bahagian belum terisih.',
        },
        {
          type: 'true_false',
          text: 'Selection sort sentiasa mencari calon minimum atau maksimum sebelum membuat pertukaran kedudukan.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Itulah perbezaan utama selection sort berbanding bubble sort yang menukar pasangan berjiran.',
        },
        {
          type: 'step_order',
          text: 'Susun langkah satu laluan pertama bubble sort menaik untuk senarai [5, 2, 4].',
          options: [
            'Bandingkan 5 dan 2, kemudian tukar kepada [2, 5, 4]',
            'Mula dengan senarai [5, 2, 4]',
            'Bandingkan 5 dan 4, kemudian tukar kepada [2, 4, 5]',
            'Tamat laluan pertama dengan nilai terbesar berada di hujung',
          ],
          correct: [
            'Mula dengan senarai [5, 2, 4]',
            'Bandingkan 5 dan 2, kemudian tukar kepada [2, 5, 4]',
            'Bandingkan 5 dan 4, kemudian tukar kepada [2, 4, 5]',
            'Tamat laluan pertama dengan nilai terbesar berada di hujung',
          ],
          explanation: 'Bubble sort membandingkan pasangan berjiran dari kiri ke kanan dalam laluan pertama.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah selection sort menaik untuk meletakkan item pertama bagi senarai [7, 3, 5, 2].',
          options: [
            'Cari nilai terkecil dalam seluruh senarai, iaitu 2',
            'Tukar 2 dengan item pertama 7',
            'Mula dengan bahagian belum terisih [7, 3, 5, 2]',
            'Dapatkan senarai [2, 3, 5, 7] untuk kedudukan pertama yang betul',
          ],
          correct: [
            'Mula dengan bahagian belum terisih [7, 3, 5, 2]',
            'Cari nilai terkecil dalam seluruh senarai, iaitu 2',
            'Tukar 2 dengan item pertama 7',
            'Dapatkan senarai [2, 3, 5, 7] untuk kedudukan pertama yang betul',
          ],
          explanation: 'Selection sort memilih minimum dalam bahagian belum terisih dan menukarnya ke hadapan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid mengatakan bubble sort selesai selepas satu perbandingan pertama kerana dua nilai telah ditukar. Apakah kesilapannya?',
          options: [],
          correct: 'Satu pertukaran tidak semestinya mengisih seluruh senarai; bubble sort perlu meneruskan perbandingan berjiran dan mengulang beberapa laluan hingga senarai terisih.',
          explanation: 'Senarai dengan lebih daripada dua item biasanya memerlukan banyak perbandingan dan beberapa laluan.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Algorithms',
      subtopic: 'Searching algorithms',
      title: 'Algoritma Carian: Linear Search dan Binary Search',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Algoritma carian digunakan untuk mencari kedudukan sesuatu item dalam set data. Linear search menyemak item satu demi satu dari awal hingga sasaran dijumpai atau data habis disemak. Binary search hanya boleh digunakan pada data yang telah diisih; ia membandingkan sasaran dengan item tengah dan membuang separuh ruang carian pada setiap langkah. Binary search lebih cekap untuk senarai besar yang terisih, tetapi linear search lebih umum kerana tidak memerlukan data diisih.'
        ),
        section(
          'Contoh berprogram',
          `Untuk mencari 16 dalam [4, 8, 12, 16, 20] menggunakan binary search, item tengah pertama ialah 12. Oleh sebab 16 lebih besar daripada 12, carian diteruskan di sebelah kanan. Item tengah baharu ialah 16, maka sasaran dijumpai. Jika senarai tidak terisih, keputusan binary search boleh menjadi salah kerana andaian "kiri lebih kecil, kanan lebih besar" tidak sah.`
        ),
        section(
          'Awas salah faham',
          'Binary search bukan sekadar melompat ke tengah mana-mana senarai; senarai mesti diisih dahulu. Linear search tidak gagal hanya kerana data tidak terisih, tetapi ia mungkin mengambil masa lebih lama. Indeks sasaran dan nilai sasaran bukan perkara yang sama. Jika sasaran tidak wujud, algoritma perlu memulangkan mesej seperti "tidak dijumpai" atau nilai penanda seperti -1.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Carian linear | Semakan item satu demi satu secara berurutan |\n| Carian binari | Carian pada data terisih dengan membahagi ruang carian kepada dua |\n| Sasaran | Nilai yang ingin dicari |\n| Indeks | Kedudukan item dalam senarai atau tatasusunan |\n| Ruang carian | Bahagian data yang masih mungkin mengandungi sasaran |'
        ),
        section(
          'Cara ingat',
          'Linear semak satu-satu; binary belah dua-dua tetapi hanya jika data sudah terisih.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Algoritma manakah boleh digunakan walaupun senarai tidak diisih?',
          options: ['Linear search', 'Binary search sahaja', 'Selection sort sahaja', 'DNS lookup sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Linear search menyemak setiap item tanpa bergantung pada tertib senarai.',
        },
        {
          type: 'multiple_choice',
          text: 'Syarat penting sebelum menggunakan binary search ialah senarai perlu...',
          options: ['diisih', 'disulitkan', 'mengandungi teks sahaja', 'mempunyai satu item sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Binary search memerlukan susunan menaik atau menurun yang konsisten untuk menentukan arah carian.',
        },
        {
          type: 'true_false',
          text: 'Binary search mengecilkan ruang carian kira-kira separuh pada setiap perbandingan.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Selepas membandingkan sasaran dengan nilai tengah, separuh yang mustahil boleh diketepikan.',
        },
        {
          type: 'code_trace',
          text: `Jejak binary search pada senarai terisih [4, 8, 12, 16, 20] untuk sasaran 16. Jika indeks bermula 0, apakah indeks sasaran?

Tengah pertama indeks 2 bernilai 12.
Sasaran 16 lebih besar daripada 12, jadi cari di kanan.
Tengah baharu indeks 3 bernilai 16.`,
          options: [],
          correct: '3',
          explanation: 'Nilai 16 berada pada indeks 3 apabila indeks bermula daripada 0.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah binary search menaik untuk mencari sasaran.',
          options: [
            'Jika sasaran lebih kecil, teruskan carian di sebelah kiri',
            'Tentukan indeks kiri, kanan dan tengah',
            'Bandingkan sasaran dengan nilai tengah',
            'Jika sama, pulangkan indeks tengah',
            'Jika sasaran lebih besar, teruskan carian di sebelah kanan',
          ],
          correct: [
            'Tentukan indeks kiri, kanan dan tengah',
            'Bandingkan sasaran dengan nilai tengah',
            'Jika sama, pulangkan indeks tengah',
            'Jika sasaran lebih kecil, teruskan carian di sebelah kiri',
            'Jika sasaran lebih besar, teruskan carian di sebelah kanan',
          ],
          explanation: 'Binary search bermula dengan sempadan carian, kemudian menggunakan nilai tengah untuk menentukan keputusan.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid menggunakan binary search pada senarai [30, 10, 20, 40] tanpa mengisihnya terlebih dahulu. Mengapa jawapannya mungkin salah?',
          options: [],
          correct: 'Binary search menganggap data sudah terisih, jadi arah kiri atau kanan selepas perbandingan tengah tidak boleh dipercayai jika senarai tidak terisih.',
          explanation: 'Data perlu diisih dahulu atau gunakan linear search untuk senarai tidak terisih.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Networks',
      subtopic: 'Internet protocols & security',
      title: 'Protokol Internet dan Keselamatan Rangkaian',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Internet berfungsi melalui set protokol yang menetapkan cara data dihantar, dialamatkan dan diterima. IP mengurus alamat dan penghantaran paket antara rangkaian, manakala TCP menyediakan penghantaran yang lebih boleh dipercayai melalui penjujukan dan pengesahan penerimaan. UDP lebih ringkas dan laju tetapi tidak menjamin semua paket sampai. Pada lapisan aplikasi, DNS memetakan nama domain kepada alamat IP, HTTP memindahkan halaman web, dan HTTPS menggunakan TLS untuk menyulitkan komunikasi web.'
        ),
        section(
          'Contoh harian',
          'Apabila pengguna membuka laman web sekolah, pelayar meminta DNS mendapatkan alamat IP pelayan. Pelayar kemudian berhubung dengan pelayan menggunakan HTTP atau HTTPS. Jika HTTPS digunakan, TLS membantu mengesahkan pelayan dan menyulitkan data seperti token log masuk semasa bergerak melalui rangkaian. Firewall boleh menapis trafik tertentu berdasarkan peraturan keselamatan.'
        ),
        section(
          'Awas salah faham',
          'HTTPS melindungi data semasa penghantaran, tetapi ia tidak menjamin laman web itu sendiri bebas daripada penipuan atau ralat aplikasi. TCP dan UDP bukan protokol yang "baik" atau "buruk"; pilihan bergantung pada keperluan seperti kebolehpercayaan atau kelajuan. DNS bukan tempat menyimpan halaman web, sebaliknya ia membantu mencari alamat IP. Kata laluan kuat masih perlu walaupun sambungan menggunakan HTTPS.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| IP | Protokol pengalamatan dan penghantaran paket antara rangkaian |\n| TCP | Protokol pengangkutan yang menekankan kebolehpercayaan penghantaran |\n| UDP | Protokol pengangkutan yang ringan tetapi tidak menjamin penghantaran |\n| DNS | Sistem yang menukar nama domain kepada alamat IP |\n| HTTPS | HTTP yang dilindungi penyulitan TLS |\n| Firewall | Kawalan yang menapis trafik rangkaian mengikut peraturan |'
        ),
        section(
          'Cara ingat',
          'DNS cari alamat, IP hantar paket, TCP pastikan sampai, HTTPS sulitkan web.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah fungsi DNS dalam penggunaan Internet?',
          options: ['Memetakan nama domain kepada alamat IP', 'Menukar RAM kepada storan kekal', 'Menyusun nombor dengan bubble sort', 'Mencipta objek daripada kelas'],
          correct: { optionIndex: 0 },
          explanation: 'DNS membolehkan pengguna menggunakan nama domain yang mudah diingati berbanding alamat IP berangka.',
        },
        {
          type: 'multiple_choice',
          text: 'Protokol manakah biasanya digunakan untuk komunikasi web yang disulitkan?',
          options: ['HTTPS', 'FTP tanpa kawalan', 'UDP sahaja', 'ASCII'],
          correct: { optionIndex: 0 },
          explanation: 'HTTPS ialah HTTP yang menggunakan TLS untuk perlindungan komunikasi web.',
        },
        {
          type: 'true_false',
          text: 'UDP menjamin setiap paket sampai dalam susunan yang betul seperti TCP.',
          options: ['true', 'false'],
          correct: 'false',
          explanation: 'UDP tidak menyediakan jaminan penghantaran atau penjujukan seperti TCP.',
        },
        {
          type: 'representation_match',
          text: 'Padankan protokol atau kawalan rangkaian dengan peranannya.',
          options: [
            { prompt: 'TCP', answer: 'Penghantaran data yang boleh dipercayai' },
            { prompt: 'UDP', answer: 'Penghantaran ringan tanpa jaminan lengkap' },
            { prompt: 'DNS', answer: 'Nama domain kepada alamat IP' },
            { prompt: 'Firewall', answer: 'Menapis trafik berdasarkan peraturan' },
          ],
          correct: {
            TCP: 'Penghantaran data yang boleh dipercayai',
            UDP: 'Penghantaran ringan tanpa jaminan lengkap',
            DNS: 'Nama domain kepada alamat IP',
            Firewall: 'Menapis trafik berdasarkan peraturan',
          },
          explanation: 'Setiap protokol atau kawalan mempunyai peranan khusus dalam komunikasi dan keselamatan rangkaian.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun urutan ringkas apabila pengguna membuka laman web HTTPS menggunakan nama domain.',
          options: [
            'Pelayar memulakan sambungan selamat TLS dengan pelayan',
            'DNS mencari alamat IP bagi nama domain',
            'Pengguna menaip nama domain dalam pelayar',
            'Data halaman web dihantar melalui HTTPS',
          ],
          correct: [
            'Pengguna menaip nama domain dalam pelayar',
            'DNS mencari alamat IP bagi nama domain',
            'Pelayar memulakan sambungan selamat TLS dengan pelayan',
            'Data halaman web dihantar melalui HTTPS',
          ],
          explanation: 'Nama domain perlu diselesaikan sebelum sambungan selamat dan pemindahan data web berlaku.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata, "Jika laman menggunakan HTTPS, saya boleh berkongsi kata laluan dengan sesiapa kerana semua perkara sudah selamat." Apakah kesilapannya?',
          options: [],
          correct: 'HTTPS menyulitkan data semasa penghantaran tetapi tidak menggantikan amalan keselamatan seperti merahsiakan kata laluan dan mengesahkan penerima maklumat.',
          explanation: 'Keselamatan rangkaian perlu digabungkan dengan tingkah laku pengguna yang selamat.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Artificial Intelligence',
      subtopic: 'ML concepts & applications',
      title: 'Kecerdasan Buatan: Konsep Pembelajaran Mesin dan Aplikasi',
      difficulty: 'medium',
      blocks: [
        section(
          'Konsep utama',
          'Kecerdasan buatan ialah bidang yang membolehkan sistem komputer melaksanakan tugas yang biasanya memerlukan kecerdasan manusia, seperti mengecam corak, membuat ramalan atau memahami bahasa. Pembelajaran mesin ialah cabang kecerdasan buatan yang membina model daripada data latihan. Dalam pembelajaran terselia, data latihan mempunyai label jawapan; dalam pembelajaran tidak terselia, sistem mencari corak tanpa label. Model perlu diuji dengan data yang berasingan supaya prestasinya boleh dinilai secara adil.'
        ),
        section(
          'Contoh harian',
          'Sistem penapis spam boleh dilatih menggunakan e-mel yang dilabel sebagai spam atau bukan spam. Ciri seperti kata kunci, alamat pengirim dan corak pautan digunakan untuk membina model klasifikasi. Selepas latihan, model diuji dengan e-mel baharu untuk melihat sama ada ramalannya tepat. Jika data latihan berat sebelah atau terlalu sedikit, ramalan model boleh menjadi lemah.'
        ),
        section(
          'Awas salah faham',
          'Model pembelajaran mesin tidak benar-benar "faham" seperti manusia; ia mengenal corak statistik daripada data. Data latihan yang banyak tidak semestinya baik jika tidak tepat, tidak seimbang atau berat sebelah. Ketepatan tinggi pada data latihan sahaja tidak mencukupi kerana model mungkin overfit. Aplikasi AI masih memerlukan penilaian manusia, etika data dan perlindungan privasi.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Kecerdasan buatan | Sistem komputer yang melakukan tugas berciri pintar |\n| Pembelajaran mesin | Kaedah membina model daripada data |\n| Data latihan | Data yang digunakan untuk melatih model |\n| Label | Jawapan sebenar bagi contoh latihan terselia |\n| Model | Perwakilan corak yang digunakan untuk membuat ramalan |\n| Overfitting | Model terlalu menghafal data latihan hingga lemah pada data baharu |'
        ),
        section(
          'Cara ingat',
          'AI ialah matlamat luas; ML ialah cara belajar daripada data; model ialah hasil pembelajaran.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah maksud pembelajaran mesin?',
          options: ['Kaedah membina model daripada data untuk membuat ramalan atau keputusan', 'Proses menukar papan kekunci kepada monitor', 'Kaedah memadam semua data latihan', 'Protokol untuk mencari alamat IP sahaja'],
          correct: { optionIndex: 0 },
          explanation: 'Pembelajaran mesin menggunakan data untuk melatih model yang boleh mengenal corak atau membuat ramalan.',
        },
        {
          type: 'multiple_choice',
          text: 'Dalam pembelajaran terselia, apakah yang biasanya ada bersama data latihan?',
          options: ['Label jawapan', 'Alamat IP rawak', 'Hanya fail kosong', 'Kata laluan pengguna lain'],
          correct: { optionIndex: 0 },
          explanation: 'Data berlabel membolehkan model belajar hubungan antara ciri input dan jawapan sebenar.',
        },
        {
          type: 'true_false',
          text: 'Model yang tepat pada data latihan tetapi gagal pada data baharu mungkin mengalami overfitting.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Overfitting berlaku apabila model terlalu menyesuaikan diri dengan data latihan sehingga kurang umum.',
        },
        {
          type: 'representation_match',
          text: 'Padankan konsep pembelajaran mesin dengan penerangan yang betul.',
          options: [
            { prompt: 'Klasifikasi', answer: 'Meramal kategori seperti spam atau bukan spam' },
            { prompt: 'Regresi', answer: 'Meramal nilai berangka seperti harga atau suhu' },
            { prompt: 'Ciri', answer: 'Maklumat input yang digunakan oleh model' },
            { prompt: 'Data ujian', answer: 'Data berasingan untuk menilai prestasi model' },
          ],
          correct: {
            Klasifikasi: 'Meramal kategori seperti spam atau bukan spam',
            Regresi: 'Meramal nilai berangka seperti harga atau suhu',
            Ciri: 'Maklumat input yang digunakan oleh model',
            'Data ujian': 'Data berasingan untuk menilai prestasi model',
          },
          explanation: 'Konsep ini membantu menerangkan cara model dibina dan dinilai.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun langkah asas membina model pembelajaran mesin terselia.',
          options: [
            'Latih model menggunakan data latihan',
            'Kumpul data yang berkaitan dan sah',
            'Uji model dengan data berasingan',
            'Sediakan ciri input dan label jawapan',
            'Gunakan model untuk membuat ramalan baharu',
          ],
          correct: [
            'Kumpul data yang berkaitan dan sah',
            'Sediakan ciri input dan label jawapan',
            'Latih model menggunakan data latihan',
            'Uji model dengan data berasingan',
            'Gunakan model untuk membuat ramalan baharu',
          ],
          explanation: 'Data perlu disediakan sebelum latihan, dan model perlu diuji sebelum digunakan.',
          points: 2,
        },
        {
          type: 'scenario',
          text: 'Sebuah aplikasi mahu mengesan sama ada gambar daun menunjukkan penyakit atau tidak. Jenis tugas pembelajaran mesin manakah paling sesuai?',
          options: [],
          correct: 'klasifikasi',
          explanation: 'Masalah ini memilih kategori, contohnya daun sihat atau daun berpenyakit, maka ia ialah klasifikasi.',
          points: 2,
        },
      ],
    },
    {
      topic: 'Ethics in Computing',
      subtopic: 'Privacy, IP, cybercrime',
      title: 'Etika Pengkomputeran: Privasi, Harta Intelek dan Jenayah Siber',
      difficulty: 'easy',
      blocks: [
        section(
          'Konsep utama',
          'Etika pengkomputeran membimbing pengguna teknologi supaya bertindak bertanggungjawab, sah dan menghormati hak orang lain. Privasi berkaitan kawalan terhadap data peribadi seperti nama, nombor kad pengenalan, lokasi dan rekod kesihatan. Harta intelek melindungi hasil ciptaan seperti kod program, grafik, muzik, penulisan dan reka bentuk. Jenayah siber melibatkan perbuatan salah menggunakan komputer atau rangkaian, contohnya capaian tanpa kebenaran, pancingan data, perisian hasad dan pencurian identiti.'
        ),
        section(
          'Contoh harian',
          'Memuat turun perisian berbayar secara cetak rompak melanggar hak harta intelek pencipta perisian. Menghantar pautan palsu untuk mendapatkan kata laluan rakan ialah pancingan data dan termasuk salah laku siber. Dalam projek sekolah, murid patut menyatakan sumber bahan, menggunakan lesen yang sah dan tidak berkongsi data peribadi rakan tanpa kebenaran. Amalan etika melindungi pengguna, pencipta dan organisasi.'
        ),
        section(
          'Awas salah faham',
          'Maklumat yang mudah disalin tidak bermaksud bebas digunakan tanpa izin. Menyebut nama pencipta sahaja tidak selalu mencukupi jika lesen bahan tidak membenarkan penggunaan tertentu. Data peribadi patut dikumpul secara minimum dan digunakan untuk tujuan yang jelas. Perbuatan "mencuba masuk" akaun orang lain tanpa izin tetap salah walaupun tiada data dipadam.'
        ),
        section(
          'Istilah penting',
          '| Istilah | Maksud |\n|---|---|\n| Privasi | Hak mengawal pengumpulan, penggunaan dan perkongsian data peribadi |\n| Data peribadi | Maklumat yang boleh mengenal pasti seseorang individu |\n| Harta intelek | Hak terhadap hasil ciptaan atau idea yang dinyatakan dalam bentuk tertentu |\n| Hak cipta | Perlindungan undang-undang untuk karya seperti kod, teks, imej atau muzik |\n| Jenayah siber | Aktiviti haram yang menggunakan komputer, sistem atau rangkaian |'
        ),
        section(
          'Cara ingat',
          'Etika digital: minta izin, hormat ciptaan, lindungi data, jauhi salah guna.'
        ),
      ],
      questions: [
        {
          type: 'multiple_choice',
          text: 'Apakah contoh data peribadi?',
          options: ['Nombor kad pengenalan murid', 'Nama algoritma bubble sort', 'Simbol tambah', 'Warna latar laman kosong'],
          correct: { optionIndex: 0 },
          explanation: 'Nombor kad pengenalan boleh mengenal pasti individu dan perlu dilindungi.',
        },
        {
          type: 'multiple_choice',
          text: 'Tindakan manakah menghormati harta intelek?',
          options: ['Menggunakan bahan mengikut lesen yang sah dan menyatakan sumber apabila perlu', 'Menjual semula perisian cetak rompak', 'Menyalin tugasan rakan tanpa izin', 'Membuang nama pencipta daripada karya asal'],
          correct: { optionIndex: 0 },
          explanation: 'Penggunaan yang sah mematuhi lesen, kebenaran dan atribusi yang diperlukan.',
        },
        {
          type: 'true_false',
          text: 'Capaian tanpa kebenaran kepada akaun orang lain boleh dianggap salah laku atau jenayah siber.',
          options: ['true', 'false'],
          correct: 'true',
          explanation: 'Akaun digital dilindungi oleh kebenaran pengguna; masuk tanpa izin ialah pelanggaran etika dan boleh menyalahi undang-undang.',
        },
        {
          type: 'representation_match',
          text: 'Padankan isu etika dengan contoh yang tepat.',
          options: [
            { prompt: 'Privasi', answer: 'Berkongsi nombor telefon rakan tanpa izin' },
            { prompt: 'Hak cipta', answer: 'Menyalin grafik berlesen tanpa kebenaran' },
            { prompt: 'Pancingan data', answer: 'Menghantar pautan palsu untuk mencuri kata laluan' },
            { prompt: 'Plagiarisme', answer: 'Mengaku hasil kerja orang lain sebagai kerja sendiri' },
          ],
          correct: {
            Privasi: 'Berkongsi nombor telefon rakan tanpa izin',
            'Hak cipta': 'Menyalin grafik berlesen tanpa kebenaran',
            'Pancingan data': 'Menghantar pautan palsu untuk mencuri kata laluan',
            Plagiarisme: 'Mengaku hasil kerja orang lain sebagai kerja sendiri',
          },
          explanation: 'Setiap contoh menunjukkan jenis isu etika atau keselamatan digital yang berlainan.',
          points: 2,
        },
        {
          type: 'step_order',
          text: 'Susun tindakan etika sebelum menggunakan imej daripada Internet dalam projek sekolah.',
          options: [
            'Simpan bukti sumber atau atribusi yang diperlukan',
            'Semak lesen atau kebenaran penggunaan imej',
            'Cari imej yang berkaitan dengan projek',
            'Gunakan imej mengikut syarat lesen',
          ],
          correct: [
            'Cari imej yang berkaitan dengan projek',
            'Semak lesen atau kebenaran penggunaan imej',
            'Gunakan imej mengikut syarat lesen',
            'Simpan bukti sumber atau atribusi yang diperlukan',
          ],
          explanation: 'Imej perlu dipilih, disemak lesennya, digunakan mengikut syarat dan dicatat sumbernya.',
          points: 2,
        },
        {
          type: 'error_diagnosis',
          text: 'Seorang murid berkata, "Saya hanya meneka kata laluan akaun rakan untuk bergurau, jadi tiada masalah." Apakah kesilapan etika dalam pernyataan ini?',
          options: [],
          correct: 'Mencuba mengakses akaun orang lain tanpa kebenaran tetap melanggar privasi dan boleh menjadi salah laku siber walaupun diniatkan sebagai gurauan.',
          explanation: 'Kebenaran pemilik akaun ialah asas etika dan keselamatan digital.',
          points: 2,
        },
      ],
    },
  ];

  for (const [index, lesson] of lessons.entries()) {
    const syllabusId = await insertSyllabus(
      client,
      subject,
      formLevel,
      lesson.topic,
      lesson.subtopic,
      index + 1
    );
    const lessonId = await insertLesson(
      client,
      syllabusId,
      lesson.title,
      subject,
      formLevel,
      lesson.difficulty,
      estimatedMinutesForDifficulty(lesson.difficulty),
      lesson.blocks
    );

    for (const [questionIndex, question] of lesson.questions.entries()) {
      await insertQuestion(
        client,
        lessonId,
        question.type,
        question.text,
        question.options || [],
        question.correct,
        question.explanation,
        question.points || 1,
        questionIndex + 1
      );
    }
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  await client.connect();
  await client.query('BEGIN');

  try {
    console.log('Seeding Form 4 Biology...');
    await seedForm4Biology(client);
    console.log('Seeding Form 4 Chemistry...');
    await seedForm4Chemistry(client);
    console.log('Seeding Form 4 Physics...');
    await seedForm4Physics(client);
    console.log('Seeding Form 4 Mathematics...');
    await seedForm4Maths(client);
    console.log('Seeding Form 4 Additional Mathematics...');
    await seedForm4AddMaths(client);
    console.log('Seeding Form 4 Science...');
    await seedForm4Science(client);
    console.log('Seeding Form 4 Computer Science...');
    await seedForm4CompSci(client);
    console.log('Seeding Form 5 Biology...');
    await seedForm5Biology(client);
    console.log('Seeding Form 5 Chemistry...');
    await seedForm5Chemistry(client);
    console.log('Seeding Form 5 Physics...');
    await seedForm5Physics(client);
    console.log('Seeding Form 5 Mathematics...');
    await seedForm5Maths(client);
    console.log('Seeding Form 5 Additional Mathematics...');
    await seedForm5AddMaths(client);
    console.log('Seeding Form 5 Computer Science...');
    await seedForm5CompSci(client);

    const summary = await client.query('SELECT COUNT(*)::int AS lesson_count FROM lessons WHERE is_active = true');

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log(`[DRY RUN] Would insert ${seedStats.syllabus} syllabus items`);
      console.log(`[DRY RUN] Would insert ${seedStats.lessons} lessons`);
      console.log(`[DRY RUN] Would insert ${seedStats.questions} quiz questions`);
      console.log('[DRY RUN] Transaction rolled back — no changes made.');
    } else {
      await client.query('COMMIT');
      console.log(`STEM lesson count: ${summary.rows[0].lesson_count}`);
      console.log('STEM lesson seed complete.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('STEM lesson seed failed.');
  console.error(error);
  process.exit(1);
});

function databaseUrlFromParts() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DATABASE_URL or DB_PASSWORD must be set');
  }

  return `postgres://${process.env.DB_USER || 'eduuser'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduapp'}`;
}
