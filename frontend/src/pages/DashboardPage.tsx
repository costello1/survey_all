import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import type { ExportFilename, SurveyListItem } from '../types';
import {
  downloadSurveyExport,
  duplicateAdminSurvey,
  listAdminSurveys,
} from '../utils/api';
import { copyText } from '../utils/browser';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type FilterMode = 'all' | 'active' | 'archived';

const EXPORTS: Array<{ file: ExportFilename; label: string }> = [
  { file: 'survey.json', label: 'Survey JSON' },
  { file: 'responses.json', label: 'Responses JSON' },
  { file: 'responses.csv', label: 'Responses CSV' },
];

export default function DashboardPage() {
  const { pushToast } = useToast();
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [busySurveyId, setBusySurveyId] = useState<number | null>(null);

  async function loadSurveys() {
    try {
      const items = await listAdminSurveys();
      setSurveys(items);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load surveys.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSurveys();
  }, []);

  const totalResponses = surveys.reduce((sum, survey) => sum + survey.response_count, 0);
  const activeSurveys = surveys.filter((survey) => survey.status === 'active').length;
  const archivedSurveys = surveys.filter((survey) => survey.status === 'archived').length;

  const visibleSurveys = useMemo(() => {
    if (filter === 'all') {
      return surveys;
    }
    return surveys.filter((survey) => survey.status === filter);
  }, [filter, surveys]);

  async function handleCopyLink(publicUrl: string) {
    try {
      await copyText(publicUrl);
      pushToast({
        tone: 'success',
        title: 'Public link copied',
        message: 'You can now paste it anywhere you want to share the survey.',
      });
    } catch {
      pushToast({
        tone: 'error',
        title: 'Copy failed',
        message: 'The browser blocked clipboard access.',
      });
    }
  }

  async function handleDownload(surveyId: number, filename: ExportFilename) {
    try {
      setBusySurveyId(surveyId);
      await downloadSurveyExport(String(surveyId), filename);
      pushToast({
        tone: 'success',
        title: 'Export downloaded',
        message: `${filename} is ready on your machine.`,
      });
    } catch (downloadError) {
      pushToast({
        tone: 'error',
        title: 'Download failed',
        message: downloadError instanceof Error ? downloadError.message : 'Unable to download the export.',
      });
    } finally {
      setBusySurveyId(null);
    }
  }

  async function handleDuplicate(surveyId: number) {
    try {
      setBusySurveyId(surveyId);
      const duplicated = await duplicateAdminSurvey(String(surveyId));
      await loadSurveys();
      pushToast({
        tone: 'success',
        title: 'Survey duplicated',
        message: `A copy called "${duplicated.title}" has been created.`,
      });
    } catch (duplicateError) {
      pushToast({
        tone: 'error',
        title: 'Duplicate failed',
        message: duplicateError instanceof Error ? duplicateError.message : 'Unable to duplicate the survey.',
      });
    } finally {
      setBusySurveyId(null);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header page-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Surveys</h1>
        </div>

        <div className="hero-actions">
          <div className="segmented-control" role="tablist" aria-label="Survey filter">
            <button className={filter === 'all' ? 'segment active' : 'segment'} onClick={() => setFilter('all')} type="button">
              All
            </button>
            <button className={filter === 'active' ? 'segment active' : 'segment'} onClick={() => setFilter('active')} type="button">
              Active
            </button>
            <button
              className={filter === 'archived' ? 'segment active' : 'segment'}
              onClick={() => setFilter('archived')}
              type="button"
            >
              Archived
            </button>
          </div>

          <Link className="primary-button inline-link" to="/admin/surveys/new">
            Create Survey
          </Link>
        </div>
      </header>

      <section className="stats-grid">
        <article className="glass-card stat-card premium-card">
          <p className="eyebrow">Total surveys</p>
          <h2>{surveys.length}</h2>
        </article>
        <article className="glass-card stat-card premium-card">
          <p className="eyebrow">Total responses</p>
          <h2>{totalResponses}</h2>
        </article>
        <article className="glass-card stat-card premium-card">
          <p className="eyebrow">Active surveys</p>
          <h2>{activeSurveys}</h2>
          <p className="muted-copy">{archivedSurveys} archived</p>
        </article>
      </section>

      {loading ? (
        <div className="glass-card centered-card">
          <h3>Loading surveys...</h3>
        </div>
      ) : error ? (
        <div className="glass-card centered-card">
          <p className="error-text">{error}</p>
        </div>
      ) : visibleSurveys.length === 0 ? (
        <div className="glass-card centered-card">
          <h3>No surveys found</h3>
          <p className="muted-copy">Create a survey to get started.</p>
        </div>
      ) : (
        <section className="card-grid">
          {visibleSurveys.map((survey) => (
            <article className="glass-card survey-card premium-card" key={survey.id}>
              <div className="survey-card-top">
                <span className={`status-pill status-${survey.status}`}>{survey.status}</span>
                <span className="response-pill">{survey.response_count} responses</span>
              </div>

              <div className="survey-card-body">
                <div className="survey-card-copy">
                  <h3>{survey.title}</h3>
                  <p className="muted-copy survey-description">{survey.description || 'No description added yet.'}</p>
                </div>

                <dl className="meta-detail-grid meta-detail-grid-compact">
                  <div className="meta-item">
                    <dt>Created</dt>
                    <dd>{formatDateTime(survey.created_at)}</dd>
                  </div>
                  <div className="meta-item">
                    <dt>Public path</dt>
                    <dd>/{survey.slug}</dd>
                  </div>
                  <div className="meta-item meta-item-wide">
                    <dt>Editing status</dt>
                    <dd>{survey.can_edit_questions ? 'Questions editable' : 'Questions locked by responses'}</dd>
                  </div>
                </dl>
              </div>

              <div className="card-actions card-actions-dense">
                <Link className="ghost-button inline-link" to={`/admin/surveys/${survey.id}`}>
                  Open
                </Link>
                <Link className="ghost-button inline-link" to={`/admin/surveys/${survey.id}/edit`}>
                  Edit
                </Link>
                <button className="ghost-button" onClick={() => void handleCopyLink(survey.public_url)} type="button">
                  Copy Public Link
                </button>
                <a className="ghost-button inline-link" href={survey.public_url} rel="noreferrer" target="_blank">
                  Open Public Page
                </a>
                <Link className="ghost-button inline-link" target="_blank" to={`/admin/surveys/${survey.id}/word-cloud/display`}>
                  Open Word Cloud Display
                </Link>
                <Link className="ghost-button inline-link" to={`/admin/surveys/${survey.id}/analytics`}>
                  Analytics
                </Link>
                <button
                  className="ghost-button"
                  disabled={busySurveyId === survey.id}
                  onClick={() => void handleDuplicate(survey.id)}
                  type="button"
                >
                  Duplicate
                </button>
                {EXPORTS.map((exportConfig) => (
                  <button
                    className="ghost-button"
                    disabled={busySurveyId === survey.id}
                    key={exportConfig.file}
                    onClick={() => void handleDownload(survey.id, exportConfig.file)}
                    type="button"
                  >
                    Download {exportConfig.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
