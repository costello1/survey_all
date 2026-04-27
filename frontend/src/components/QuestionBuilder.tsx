import type { DraftQuestion, QuestionType } from '../types';
import { createDraftQuestionRecord } from '../utils/survey';

interface QuestionBuilderProps {
  questions: DraftQuestion[];
  onChange: (questions: DraftQuestion[]) => void;
}

const QUESTION_TYPE_HELP: Record<QuestionType, string> = {
  open_text: 'Long answer',
  single_choice: 'One option',
  multiple_choice: 'Multiple options',
  single_word: 'Word cloud',
};

function makeQuestion(type: QuestionType): DraftQuestion {
  return createDraftQuestionRecord(type);
}

export function createDraftQuestion(type: QuestionType = 'open_text'): DraftQuestion {
  return makeQuestion(type);
}

export default function QuestionBuilder({ questions, onChange }: QuestionBuilderProps) {
  function updateQuestion(clientId: string, patch: Partial<DraftQuestion>) {
    onChange(questions.map((question) => (question.clientId === clientId ? { ...question, ...patch } : question)));
  }

  function updateQuestionType(clientId: string, type: QuestionType) {
    onChange(
      questions.map((question) =>
        question.clientId === clientId
          ? {
              ...question,
              type,
              options: type === 'single_choice' || type === 'multiple_choice' ? question.options.length ? question.options : ['Option 1', 'Option 2'] : [],
            }
          : question,
      ),
    );
  }

  function addQuestion(type: QuestionType) {
    onChange([...questions, makeQuestion(type)]);
  }

  function removeQuestion(clientId: string) {
    onChange(questions.filter((question) => question.clientId !== clientId));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= questions.length) {
      return;
    }

    const nextQuestions = [...questions];
    [nextQuestions[index], nextQuestions[nextIndex]] = [nextQuestions[nextIndex], nextQuestions[index]];
    onChange(nextQuestions);
  }

  function addOption(clientId: string) {
    onChange(
      questions.map((question) =>
        question.clientId === clientId
          ? { ...question, options: [...question.options, `Option ${question.options.length + 1}`] }
          : question,
      ),
    );
  }

  function updateOption(clientId: string, optionIndex: number, value: string) {
    onChange(
      questions.map((question) =>
        question.clientId === clientId
          ? {
              ...question,
              options: question.options.map((option, index) => (index === optionIndex ? value : option)),
            }
          : question,
      ),
    );
  }

  function removeOption(clientId: string, optionIndex: number) {
    onChange(
      questions.map((question) =>
        question.clientId === clientId
          ? { ...question, options: question.options.filter((_, index) => index !== optionIndex) }
          : question,
      ),
    );
  }

  return (
    <section className="panel-grid">
      {questions.map((question, index) => (
        <article className="glass-card builder-card premium-card" key={question.clientId}>
          <div className="builder-header">
            <div className="builder-title-block">
              <div className="builder-kicker-row">
                <p className="eyebrow">Question {index + 1}</p>
                <span className="response-pill">{question.required ? 'Required' : 'Optional'}</span>
              </div>
              <h3>{question.prompt.trim() || 'Untitled question'}</h3>
              <p className="muted-copy field-help">{QUESTION_TYPE_HELP[question.type]}</p>
            </div>
            <div className="builder-actions">
              <button className="ghost-button" onClick={() => moveQuestion(index, -1)} type="button">
                Up
              </button>
              <button className="ghost-button" onClick={() => moveQuestion(index, 1)} type="button">
                Down
              </button>
              <button className="ghost-button danger-button" onClick={() => removeQuestion(question.clientId)} type="button">
                Remove
              </button>
            </div>
          </div>

          <div className="editor-grid builder-fields">
            <label className="field">
              <span>Prompt</span>
              <input
                placeholder="Type the question here"
                type="text"
                value={question.prompt}
                onChange={(event) => updateQuestion(question.clientId, { prompt: event.target.value })}
              />
            </label>

            <div className="builder-side-panel">
              <label className="field">
                <span>Question type</span>
                <select
                  value={question.type}
                  onChange={(event) => updateQuestionType(question.clientId, event.target.value as QuestionType)}
                >
                  <option value="open_text">Open text</option>
                  <option value="single_choice">Single choice</option>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="single_word">Single word</option>
                </select>
              </label>

              <label className="checkbox-row checkbox-card">
                <input
                  checked={question.required}
                  type="checkbox"
                  onChange={(event) => updateQuestion(question.clientId, { required: event.target.checked })}
                />
                <span>Required question</span>
              </label>
            </div>
          </div>

          {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
            <div className="option-stack builder-section">
              <div className="builder-header">
                <div>
                  <p className="eyebrow">Options</p>
                  <h4>Answer choices</h4>
                </div>
                <button className="ghost-button" onClick={() => addOption(question.clientId)} type="button">
                  Add Option
                </button>
              </div>

              {question.options.map((option, optionIndex) => (
                <div className="option-row" key={`${question.clientId}-${optionIndex}`}>
                  <input
                    placeholder={`Option ${optionIndex + 1}`}
                    type="text"
                    value={option}
                    onChange={(event) => updateOption(question.clientId, optionIndex, event.target.value)}
                  />
                  <button
                    className="ghost-button danger-button"
                    disabled={question.options.length <= 2}
                    onClick={() => removeOption(question.clientId, optionIndex)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {question.type === 'single_word' ? (
            <div className="info-card">
              <p className="eyebrow">Word cloud</p>
              <p className="muted-copy">One word only.</p>
            </div>
          ) : null}
        </article>
      ))}

      <article className="glass-card add-card premium-card">
        <p className="eyebrow">Add a question</p>
        <h3>Question type</h3>
        <div className="action-grid">
          <button className="secondary-button" onClick={() => addQuestion('open_text')} type="button">
            Open text
          </button>
          <button className="secondary-button" onClick={() => addQuestion('single_choice')} type="button">
            Single choice
          </button>
          <button className="secondary-button" onClick={() => addQuestion('multiple_choice')} type="button">
            Multiple choice
          </button>
          <button className="secondary-button" onClick={() => addQuestion('single_word')} type="button">
            Single word
          </button>
        </div>
      </article>
    </section>
  );
}
