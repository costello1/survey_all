import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PublicSurvey } from '../types';
import { getPublicSurvey, submitPublicSurvey } from '../utils/api';

type AnswerMap = Record<number, string | string[]>;

function hasValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value && value.trim());
}

export default function PublicSurveyPage() {
  const navigate = useNavigate();
  const { publicToken, surveySlug } = useParams();
  const surveyKey = publicToken ?? surveySlug ?? '';
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPublicSurvey(surveyKey)
      .then((response) => {
        if (active) {
          setSurvey(response);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load this survey.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [surveyKey]);

  function updateAnswer(questionId: number, value: string | string[]) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function toggleMultiChoice(questionId: number, option: string, checked: boolean) {
    const currentValues = Array.isArray(answers[questionId]) ? (answers[questionId] as string[]) : [];
    const nextValues = checked ? [...currentValues, option] : currentValues.filter((item) => item !== option);
    updateAnswer(questionId, nextValues);
  }

  const progress = useMemo(() => {
    if (!survey) {
      return { answered: 0, total: 0, required: 0, percent: 0 };
    }
    const answered = survey.questions.filter((question) => hasValue(answers[question.id])).length;
    const required = survey.questions.filter((question) => question.required).length;
    const percent = survey.questions.length ? Math.round((answered / survey.questions.length) * 100) : 0;
    return { answered, total: survey.questions.length, required, percent };
  }, [answers, survey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!survey) {
      return;
    }

    const missingRequired = survey.questions.find((question) => question.required && !hasValue(answers[question.id]));
    if (missingRequired) {
      setError(`Please answer the required question: ${missingRequired.prompt}`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = survey.questions
        .filter((question) => hasValue(answers[question.id]))
        .map((question) => ({
          question_id: question.id,
          value: answers[question.id],
        }));

      await submitPublicSurvey(surveyKey, payload);
      navigate('/thank-you');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to submit the survey.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="public-layout">
        <section className="glass-card centered-card">
          <h2>Loading survey...</h2>
        </section>
      </main>
    );
  }

  if (error && !survey) {
    return (
      <main className="public-layout">
        <section className="glass-card centered-card">
          <p className="error-text">{error}</p>
        </section>
      </main>
    );
  }

  if (!survey) {
    return null;
  }

  return (
    <main className="public-layout">
      <section className="public-frame public-frame-wide">
        <header className="public-header public-header-card glass-card">
          <div className="public-header-content">
            <div>
              <h1>{survey.title}</h1>
              {survey.description ? <p className="muted-copy">{survey.description}</p> : null}
            </div>

            <div className="progress-panel">
              <div className="progress-panel-head">
                <span>Completion</span>
                <strong>{progress.percent}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
              </div>
              <p className="muted-copy">
                {progress.answered} of {progress.total} questions answered
              </p>
            </div>
          </div>
        </header>

        <form className="form-stack" onSubmit={handleSubmit}>
          {survey.questions.map((question, index) => (
            <article className="glass-card public-question-card premium-card" key={question.id}>
              <div className="question-preview-top">
                <span className="status-pill">{question.type.replace('_', ' ')}</span>
                <span className="response-pill">{question.required ? 'Required' : 'Optional'}</span>
              </div>

              <h3>
                {index + 1}. {question.prompt}
              </h3>

              {question.type === 'open_text' && (
                <textarea
                  placeholder="Write your answer"
                  rows={5}
                  value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                />
              )}

              {question.type === 'single_word' && (
                <input
                  placeholder="Write one word"
                  type="text"
                  value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                />
              )}

              {question.type === 'single_choice' && (
                <div className="option-stack">
                  {question.options.map((option) => (
                    <label className="choice-card" key={option}>
                      <input
                        checked={answers[question.id] === option}
                        name={`single-${question.id}`}
                        type="radio"
                        value={option}
                        onChange={() => updateAnswer(question.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === 'multiple_choice' && (
                <div className="option-stack">
                  {question.options.map((option) => {
                    const currentValues = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
                    return (
                      <label className="choice-card" key={option}>
                        <input
                          checked={currentValues.includes(option)}
                          type="checkbox"
                          value={option}
                          onChange={(event) => toggleMultiChoice(question.id, option, event.target.checked)}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </article>
          ))}

          <section className="glass-card submit-panel">
            <div>
              <p className="eyebrow">Submit</p>
              <h3>{progress.required} required questions</h3>
            </div>

            <div className="submit-panel-actions">
              {error ? <p className="error-text">{error}</p> : null}
              <button className="primary-button public-submit" disabled={submitting} type="submit">
                {submitting ? 'Submitting...' : 'Submit Answers'}
              </button>
            </div>
          </section>
        </form>
      </section>
    </main>
  );
}
