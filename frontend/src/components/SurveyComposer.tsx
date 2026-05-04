import { FormEvent } from 'react';
import type { DraftQuestion } from '../types';
import QuestionBuilder from './QuestionBuilder';

interface SurveyComposerProps {
  title: string;
  description: string;
  questions: DraftQuestion[];
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onQuestionsChange: (questions: DraftQuestion[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string;
  mode: 'create' | 'edit';
  questionEditingLocked?: boolean;
}

export default function SurveyComposer({
  title,
  description,
  questions,
  onTitleChange,
  onDescriptionChange,
  onQuestionsChange,
  onSubmit,
  loading,
  error,
  mode,
  questionEditingLocked = false,
}: SurveyComposerProps) {
  const choiceQuestionCount = questions.filter(
    (question) => question.type === 'single_choice' || question.type === 'multiple_choice',
  ).length;
  const wordCloudQuestionCount = questions.filter(
    (question) => question.type === 'single_word' || question.type === 'single_choice' || question.type === 'multiple_choice',
  ).length;

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <section className="glass-card editor-shell premium-card">
        <div className="editor-shell-top">
          <div>
            <p className="eyebrow">{mode === 'create' ? 'New survey' : 'Settings'}</p>
            <h2>{mode === 'create' ? 'Survey details' : 'Edit survey'}</h2>
          </div>
          <div className="editor-mode-pill">{mode === 'create' ? 'Draft mode' : 'Edit mode'}</div>
        </div>

        <div className="editor-summary-grid">
          <article className="mini-stat-card">
            <span className="eyebrow">Questions</span>
            <strong>{questions.length}</strong>
          </article>
          <article className="mini-stat-card">
            <span className="eyebrow">Choice</span>
            <strong>{choiceQuestionCount}</strong>
          </article>
          <article className="mini-stat-card">
            <span className="eyebrow">Cloud</span>
            <strong>{wordCloudQuestionCount}</strong>
          </article>
        </div>

        <div className="editor-grid">
          <label className="field">
            <span>Survey title</span>
            <input
              placeholder="For example: Product Launch Feedback"
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              placeholder="Give participants a short introduction"
              rows={4}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </label>
        </div>
      </section>

      {questionEditingLocked ? (
        <section className="glass-card premium-card info-card">
          <p className="eyebrow">Question set locked</p>
          <p className="muted-copy">Responses already exist. Only title and description can be edited.</p>
        </section>
      ) : (
        <QuestionBuilder questions={questions} onChange={onQuestionsChange} />
      )}

      <section className="glass-card action-footer premium-card">
        <div>
          <p className="eyebrow">{mode === 'create' ? 'Ready to publish' : 'Ready to save'}</p>
          <h3>{mode === 'create' ? 'Create survey' : 'Save changes'}</h3>
        </div>
        <div className="action-footer-controls">
          {error ? <p className="error-text">{error}</p> : null}
          <button className="primary-button" disabled={loading} type="submit">
            {loading
              ? mode === 'create'
                ? 'Publishing survey...'
                : 'Saving changes...'
              : mode === 'create'
                ? 'Create Survey'
                : 'Save Changes'}
          </button>
        </div>
      </section>
    </form>
  );
}
