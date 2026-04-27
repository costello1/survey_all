import type { DraftQuestion, Question, QuestionType } from '../types';

export function createDraftQuestionRecord(type: QuestionType = 'open_text'): DraftQuestion {
  return {
    clientId: crypto.randomUUID(),
    prompt: '',
    type,
    required: true,
    options: type === 'single_choice' || type === 'multiple_choice' ? ['Option 1', 'Option 2'] : [],
  };
}

export function mapQuestionToDraft(question: Question): DraftQuestion {
  return {
    clientId: crypto.randomUUID(),
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    options: [...question.options],
  };
}

export function validateDraftQuestions(questions: DraftQuestion[]): string | null {
  if (!questions.length) {
    return 'Add at least one question.';
  }

  for (const question of questions) {
    if (!question.prompt.trim()) {
      return 'Each question needs a prompt.';
    }
    if (
      (question.type === 'single_choice' || question.type === 'multiple_choice') &&
      question.options.filter((option) => option.trim()).length < 2
    ) {
      return 'Choice questions need at least two options.';
    }
  }

  return null;
}

export function sanitizeDraftQuestions(questions: DraftQuestion[]): DraftQuestion[] {
  return questions.map((question) => ({
    ...question,
    prompt: question.prompt.trim(),
    options: question.options.map((option) => option.trim()).filter(Boolean),
  }));
}
