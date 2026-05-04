import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import WordCloud from '../components/WordCloud';
import type { WordCloudData } from '../types';
import { subscribePublicSurveyWordCloud, subscribeSurveyWordCloud } from '../utils/api';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function WordCloudDisplayPage() {
  const { surveyId = '' } = useParams();
  const location = useLocation();
  const isAdminDisplay = location.pathname.includes('/admin/');
  const [data, setData] = useState<WordCloudData | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveMessage, setLiveMessage] = useState('Live');
  const deferredWords = useDeferredValue(data?.words ?? []);

  useEffect(() => {
    let active = true;

    const subscribe = isAdminDisplay ? subscribeSurveyWordCloud : subscribePublicSurveyWordCloud;
    const unsubscribe = subscribe(
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
          setError(loadError.message || 'Unable to load the projector word cloud.');
          setLiveMessage('Reconnecting...');
          setLoading(false);
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAdminDisplay, surveyId, selectedQuestionId]);

  function handleQuestionChange(value: string) {
    const nextQuestionId = Number(value);
    startTransition(() => {
      setSelectedQuestionId(nextQuestionId);
    });
  }

  async function handleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  }

  if (loading) {
    return (
      <main className="display-layout">
        <section className="display-panel">
          <div className="glass-card centered-card">
            <h2>Loading projector view...</h2>
          </div>
        </section>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="display-layout">
        <section className="display-panel">
          <div className="glass-card centered-card">
            <p className="error-text">{error || 'Projector view unavailable.'}</p>
          </div>
        </section>
      </main>
    );
  }

  const hasWordCloudQuestions = data.available_questions.length > 0;
  const selectedQuestion = data.available_questions.find((question) => question.id === selectedQuestionId);
  const selectedLabel = selectedQuestion
    ? selectedQuestion.type === 'multiple_choice'
      ? 'Multiple choice source'
      : 'Single word source'
    : 'No question selected';
  const totalMentions = deferredWords.reduce((sum, item) => sum + item.count, 0);

  return (
    <main className="display-layout">
      <section className="display-panel">
        <div className="display-topbar">
          <div className="display-copy">
            <p className="eyebrow">Projector view</p>
            <h1>{data.survey_title}</h1>
            <p className="muted-copy">{liveMessage}</p>
            <div className="display-badge-row">
              <span className="status-pill">Live</span>
              <span className="response-pill">{totalMentions} total mentions</span>
            </div>
          </div>

          <div className="display-controls display-controls-panel">
            <label className="field display-field">
              <span>Word cloud source</span>
              <select
                disabled={!hasWordCloudQuestions}
                value={selectedQuestionId ?? ''}
                onChange={(event) => handleQuestionChange(event.target.value)}
              >
                {hasWordCloudQuestions ? (
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

            <button className="primary-button" onClick={() => void handleFullscreen()} type="button">
              Toggle Fullscreen
            </button>
            {isAdminDisplay ? (
              <Link className="ghost-button inline-link" to={`/admin/surveys/${surveyId}/word-cloud`}>
                Back to Admin Word Cloud
              </Link>
            ) : null}
          </div>
        </div>

        <section className="display-stage glass-card premium-card">
          <div className="display-stage-header">
            <div>
              <p className="eyebrow">Current source</p>
              <h2 className="display-question-title">{selectedQuestion?.prompt ?? 'No question selected'}</h2>
            </div>
            <div className="display-stage-metrics">
              <span className="response-pill">{selectedQuestion ? selectedLabel : 'No source selected'}</span>
              <span className="status-pill">{deferredWords.length} cloud terms</span>
            </div>
          </div>

          {!hasWordCloudQuestions ? (
            <div className="display-empty">
              <h2>No word cloud sources available</h2>
            </div>
          ) : !deferredWords.length ? (
            <div className="display-empty">
              <h2>Waiting for answers</h2>
            </div>
          ) : (
            <WordCloud words={deferredWords} />
          )}
        </section>
      </section>
    </main>
  );
}
