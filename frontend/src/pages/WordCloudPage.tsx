import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import WordCloud from '../components/WordCloud';
import { useToast } from '../components/ToastProvider';
import type { WordCloudData } from '../types';
import { subscribeSurveyWordCloud } from '../utils/api';
import { copyText } from '../utils/browser';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function WordCloudPage() {
  const { surveyId = '' } = useParams();
  const { pushToast } = useToast();
  const [data, setData] = useState<WordCloudData | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveMessage, setLiveMessage] = useState('Live');
  const deferredWords = useDeferredValue(data?.words ?? []);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeSurveyWordCloud(
      surveyId,
      selectedQuestionId,
      (response) => {
        if (active) {
          setData(response);
          setSelectedQuestionId(response.selected_question_id ?? undefined);
          setLiveMessage(`Updated ${formatDateTime(new Date().toISOString())}`);
          setError('');
          setLoading(false);
        }
      },
      (loadError) => {
        if (active) {
          setError(loadError.message || 'Unable to load the word cloud.');
          setLiveMessage('Reconnecting...');
          setLoading(false);
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [surveyId, selectedQuestionId]);

  function handleQuestionChange(value: string) {
    const nextQuestionId = Number(value);
    startTransition(() => {
      setSelectedQuestionId(nextQuestionId);
    });
  }

  async function handleCopyDisplayLink() {
    const displayUrl = `${window.location.origin}${import.meta.env.BASE_URL}word-cloud/${surveyId}`;
    try {
      await copyText(displayUrl);
      pushToast({
        tone: 'success',
        title: 'Display link copied',
        message: 'The live word cloud display URL is ready to paste.',
      });
    } catch {
      pushToast({
        tone: 'error',
        title: 'Copy failed',
        message: 'Clipboard access was blocked by the browser.',
      });
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <h3>Loading live word cloud...</h3>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <p className="error-text">{error || 'Word cloud unavailable.'}</p>
        </div>
      </section>
    );
  }

  const hasWordCloudQuestions = data.available_questions.length > 0;
  const hasWords = deferredWords.length > 0;
  const selectedQuestion = data.available_questions.find((question) => question.id === selectedQuestionId);
  const totalMentions = deferredWords.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="page-stack">
      <header className="page-header page-hero">
        <div>
          <p className="eyebrow">Live word cloud</p>
          <h1>{data.survey_title}</h1>
          <p className="muted-copy page-hero-copy">{liveMessage}</p>
        </div>
        <div className="button-cluster">
          <Link className="ghost-button inline-link" to={`/admin/surveys/${surveyId}`}>
            Back to Survey
          </Link>
          <Link className="ghost-button inline-link" to={`/admin/surveys/${surveyId}/analytics`}>
            Full Analytics
          </Link>
          {hasWordCloudQuestions ? (
            <Link
              className="primary-button inline-link"
              target="_blank"
              to={`/word-cloud/${surveyId}`}
            >
              Open Word Cloud Display
            </Link>
          ) : null}
          {hasWordCloudQuestions ? (
            <button className="ghost-button" onClick={() => void handleCopyDisplayLink()} type="button">
              Copy Word Cloud Display Link
            </button>
          ) : null}
        </div>
      </header>

      <section className="details-grid word-cloud-layout">
        <article className="glass-card premium-card word-cloud-toolbar">
          <div className="section-head">
            <div>
              <p className="eyebrow">Source</p>
              <h3>Question</h3>
            </div>
            <span className="response-pill">{data.available_questions.length} supported sources</span>
          </div>

          <label className="field">
            <span>Question for word cloud</span>
            <select
              disabled={!data.available_questions.length}
              value={selectedQuestionId ?? ''}
              onChange={(event) => handleQuestionChange(event.target.value)}
            >
              {data.available_questions.length ? (
                data.available_questions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.prompt} ({question.type === 'multiple_choice' ? 'Multiple choice' : 'Single word'})
                  </option>
                ))
              ) : (
                <option value="">No word cloud sources available</option>
              )}
            </select>
          </label>
        </article>

        <article className="glass-card premium-card word-cloud-toolbar">
          <div className="section-head">
            <div>
              <p className="eyebrow">Summary</p>
              <h3>Live counts</h3>
            </div>
          </div>

          <div className="editor-summary-grid compact-summary-grid">
            <article className="mini-stat-card">
              <span className="eyebrow">Current source</span>
              <strong>{selectedQuestion ? selectedQuestion.type.replace('_', ' ') : 'None'}</strong>
            </article>
            <article className="mini-stat-card">
              <span className="eyebrow">Cloud terms</span>
              <strong>{deferredWords.length}</strong>
            </article>
            <article className="mini-stat-card">
              <span className="eyebrow">Mentions</span>
              <strong>{totalMentions}</strong>
            </article>
          </div>
        </article>
      </section>

      <section className="glass-card word-cloud-card premium-card">
        {!hasWordCloudQuestions ? (
          <div className="empty-card">
            <p>No word cloud sources available</p>
          </div>
        ) : !hasWords ? (
          <div className="empty-card">
            <p>Waiting for answers</p>
          </div>
        ) : (
          <WordCloud words={deferredWords} />
        )}
      </section>
    </section>
  );
}
