import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChoiceChart from '../components/ChoiceChart';
import type { SurveyAnalytics } from '../types';
import { getSurveyAnalytics } from '../utils/api';
import { getAuthToken } from '../utils/auth';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AnalyticsPage() {
  const { surveyId = '' } = useParams();
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveMessage, setLiveMessage] = useState('Listening for new responses.');

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const data = await getSurveyAnalytics(surveyId);
        if (active) {
          setAnalytics(data);
          setError('');
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    const token = getAuthToken();
    if (!token) {
      return () => {
        active = false;
      };
    }

    const source = new EventSource(`/api/admin/surveys/${surveyId}/events?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type: string; timestamp?: string };
      if (payload.type === 'response_submitted') {
        setLiveMessage(`New response received at ${formatDateTime(payload.timestamp ?? new Date().toISOString())}.`);
        void loadAnalytics();
      }
    };
    source.onerror = () => {
      setLiveMessage('Live connection interrupted. Trying to reconnect...');
    };

    return () => {
      active = false;
      source.close();
    };
  }, [surveyId]);

  if (loading) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <h3>Loading analytics...</h3>
        </div>
      </section>
    );
  }

  if (error || !analytics) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <p className="error-text">{error || 'Analytics are unavailable.'}</p>
        </div>
      </section>
    );
  }

  const textResponseCount = analytics.questions.reduce((sum, question) => sum + question.text_responses.length, 0);
  const wordQuestionCount = analytics.questions.filter((question) => question.word_counts.length > 0).length;

  return (
    <section className="page-stack">
      <header className="page-header page-hero">
        <div>
          <p className="eyebrow">Live analytics</p>
          <h1>{analytics.survey_title}</h1>
          <p className="muted-copy page-hero-copy">{liveMessage}</p>
        </div>
        <div className="button-cluster">
          <Link className="ghost-button inline-link" to={`/admin/surveys/${surveyId}`}>
            Back to Survey
          </Link>
          <Link className="ghost-button inline-link" target="_blank" to={`/admin/surveys/${surveyId}/word-cloud/display`}>
            Open Projector View
          </Link>
          <Link className="primary-button inline-link" to={`/admin/surveys/${surveyId}/word-cloud`}>
            Live Word Cloud
          </Link>
        </div>
      </header>

      <section className="stats-grid">
        <article className="glass-card stat-card premium-card">
          <p className="eyebrow">Responses</p>
          <h2>{analytics.response_count}</h2>
        </article>
        <article className="glass-card stat-card premium-card">
          <p className="eyebrow">Text answers</p>
          <h2>{textResponseCount}</h2>
        </article>
        <article className="glass-card stat-card premium-card">
          <p className="eyebrow">Cloud sources</p>
          <h2>{wordQuestionCount}</h2>
        </article>
      </section>

      <section className="panel-grid analytics-grid">
        {analytics.questions.map((question) => (
          <article className="glass-card analytics-card premium-card" key={question.id}>
            <div className="section-head">
              <div>
                <p className="eyebrow">{question.type.replace('_', ' ')}</p>
                <h3>{question.prompt}</h3>
              </div>
              <span className="response-pill">{question.total_answers} answers</span>
            </div>

            {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
              <ChoiceChart items={question.choice_counts} />
            )}

            {question.type === 'open_text' && (
              <div className="response-list response-list-large">
                {question.text_responses.length ? (
                  question.text_responses.map((response) => (
                    <article className="response-item" key={`${response.response_id}-${response.submitted_at}`}>
                      <p>{response.value}</p>
                      <span>{formatDateTime(response.submitted_at)}</span>
                    </article>
                  ))
                ) : (
                  <div className="empty-card">
                    <p>No text responses yet.</p>
                  </div>
                )}
              </div>
            )}

            {(question.type === 'single_word' || question.type === 'multiple_choice') && (
              <div className="word-list">
                {question.word_counts.length ? (
                  question.word_counts.slice(0, 16).map((item) => (
                    <span className="option-badge" key={item.word}>
                      {item.word} ({item.count})
                    </span>
                  ))
                ) : (
                  <div className="empty-card">
                    <p>No cloud items yet.</p>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}
