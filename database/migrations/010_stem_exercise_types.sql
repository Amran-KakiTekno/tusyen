-- Add STEM-focused lesson exercise types while keeping live quiz decks unchanged.
ALTER TABLE quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;

ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_question_type_check
  CHECK (question_type IN (
    'multiple_choice',
    'true_false',
    'fill_blank',
    'matching',
    'representation_match',
    'missing_step',
    'step_order',
    'numeric',
    'diagram_label',
    'error_diagnosis',
    'prediction',
    'code_trace',
    'data_interpret',
    'scenario'
  ));
