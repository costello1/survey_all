import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import type { ExportFilename, SurveyDetail } from '../types';
import {
  activateAdminSurvey,
  archiveAdminSurvey,
  deleteAdminSurvey,
  downloadSurveyExport,
  duplicateAdminSurvey,
  getAdminSurvey,
  getAdminSurveyQr,
  subscribeSurveyAnalytics,
} from '../utils/api';
import { confirmAction, copyText } from '../utils/browser';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatQuestionType(value: string) {
  return value.replace('_', ' ');
}

const EXPORTS: Array<{ file: ExportFilename; label: string }> = [
  { file: 'survey.json', label: 'Survey JSON' },
  { file: 'responses.json', label: 'Responses JSON' },
  { file: 'responses.csv', label: 'Responses CSV' },
];

export default function SurveyDetailPage() {
  const navigate = useNavigate();
  const { surveyId = '' } = useParams();
  const { pushToast } = useToast();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [qrSvg, setQrSvg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const lastResponseCountRef = useRef<number | null>(null);

  async function loadSurvey() {
    try {
      const [surveyData, qrMarkup] = await Promise.all([getAdminSurvey(surveyId), getAdminSurveyQr(surveyId)]);
      setSurvey(surveyData);
      setQrSvg(qrMarkup);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load survey details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSurvey();
  }, [surveyId]);

  useEffect(() => {
    const unsubscribe = subscribeSurveyAnalytics(
      surveyId,
      (analytics) => {
        setSurvey((current) => (current ? { ...current, response_count: analytics.response_count } : current));
        if (lastResponseCountRef.current !== null && analytics.response_count > lastResponseCountRef.current) {
          pushToast({
            tone: 'success',
            title: 'New response received',
            message: `${analytics.response_count} total responses are now stored in Firestore.`,
          });
        }
        lastResponseCountRef.current = analytics.response_count;
      },
      () => undefined,
    );

    return unsubscribe;
  }, [pushToast, surveyId]);

  async function handleCopyLink() {
    if (!survey) {
      return;
    }
    try {
      await copyText(survey.public_url);
      pushToast({
        tone: 'success',
        title: 'Link copied',
        message: 'The public survey URL is ready to paste.',
      });
    } catch {
      pushToast({
        tone: 'error',
        title: 'Copy failed',
        message: 'Clipboard access was blocked by the browser.',
      });
    }
  }

  async function handleCopyWordCloudDisplayLink() {
    if (!survey) {
      return;
    }
    const displayUrl = `${window.location.origin}${import.meta.env.BASE_URL}word-cloud/${survey.id}`;
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

  async function handleDownload(filename: ExportFilename) {
    if (!survey) {
      return;
    }
    try {
      setBusyAction(filename);
      await downloadSurveyExport(String(survey.id), filename);
      pushToast({
        tone: 'success',
        title: 'Export downloaded',
        message: `${filename} is ready.`,
      });
    } catch (downloadError) {
      pushToast({
        tone: 'error',
        title: 'Download failed',
        message: downloadError instanceof Error ? downloadError.message : 'Unable to download the export.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDuplicate() {
    if (!survey) {
      return;
    }
    try {
      setBusyAction('duplicate');
      const duplicated = await duplicateAdminSurvey(String(survey.id));
      pushToast({
        tone: 'success',
        title: 'Survey duplicated',
        message: `A new survey called "${duplicated.title}" is now available.`,
      });
      navigate(`/admin/surveys/${duplicated.id}`);
    } catch (duplicateError) {
      pushToast({
        tone: 'error',
        title: 'Duplicate failed',
        message: duplicateError instanceof Error ? duplicateError.message : 'Unable to duplicate the survey.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStatusToggle() {
    if (!survey) {
      return;
    }

    const nextStatus = survey.status === 'archived' ? 'active' : 'archived';
    const confirmed = confirmAction(
      nextStatus === 'archived'
        ? 'Archive this survey? Public respondents will no longer be able to open it.'
        : 'Reactivate this survey and reopen public access?',
    );
    if (!confirmed) {
      return;
    }

    try {
      setBusyAction(nextStatus);
      const updated =
        nextStatus === 'archived'
          ? await archiveAdminSurvey(String(survey.id))
          : await activateAdminSurvey(String(survey.id));
      setSurvey(updated);
      pushToast({
        tone: 'success',
        title: nextStatus === 'archived' ? 'Survey archived' : 'Survey reactivated',
        message:
          nextStatus === 'archived'
            ? 'The public page is now disabled until you reactivate it.'
            : 'The survey is live again and can receive new responses.',
      });
    } catch (statusError) {
      pushToast({
        tone: 'error',
        title: 'Status update failed',
        message: statusError instanceof Error ? statusError.message : 'Unable to update the survey status.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!survey) {
      return;
    }
    const confirmed = confirmAction(
      `Delete "${survey.title}" permanently? This also removes its responses from the database. Export files already written to disk will stay in the storage folder.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setBusyAction('delete');
      await deleteAdminSurvey(String(survey.id));
      pushToast({
        tone: 'success',
        title: 'Survey deleted',
        message: 'The survey was removed from the admin workspace.',
      });
      navigate('/admin');
    } catch (deleteError) {
      pushToast({
        tone: 'error',
        title: 'Delete failed',
        message: deleteError instanceof Error ? deleteError.message : 'Unable to delete the survey.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <h3>Loading survey details...</h3>
        </div>
      </section>
    );
  }

  if (error || !survey) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <p className="error-text">{error || 'Survey not found.'}</p>
        </div>
      </section>
    );
  }

  const hasWordCloudQuestion = survey.questions.some(
    (question) => question.type === 'single_word' || question.type === 'single_choice' || question.type === 'multiple_choice',
  );

  return (
    <section className="page-stack">
      <header className="page-header page-hero">
        <div>
          <p className="eyebrow">Survey</p>
          <h1>{survey.title}</h1>
          <p className="muted-copy page-hero-copy">Manage sharing and results.</p>
        </div>

        <div className="button-cluster">
          <Link className="ghost-button inline-link" to={`/admin/surveys/${survey.id}/edit`}>
            Edit Survey
          </Link>
          <Link className="ghost-button inline-link" to={`/admin/surveys/${survey.id}/analytics`}>
            Open Analytics
          </Link>
          <Link className="primary-button inline-link" to={`/admin/surveys/${survey.id}/word-cloud`}>
            Open Word Cloud
          </Link>
          {hasWordCloudQuestion ? (
            <Link className="ghost-button inline-link" target="_blank" to={`/word-cloud/${survey.id}`}>
              Open Word Cloud Display
            </Link>
          ) : null}
        </div>
      </header>

      <section className="details-grid share-grid">
        <article className="glass-card premium-card share-card">
          <div className="share-card-header">
            <div className="section-head">
              <div>
                <p className="eyebrow">Share</p>
                <h3>Public access</h3>
              </div>
              <span className={`status-pill status-${survey.status}`}>{survey.status}</span>
            </div>
            <p className="muted-copy section-copy">Share this survey.</p>
          </div>

          <div className="share-link-grid">
            <label className="field share-field">
              <span>Public path</span>
              <input readOnly type="text" value={`/${survey.slug}`} />
            </label>
            <label className="field share-field">
              <span>Public URL</span>
              <input readOnly type="text" value={survey.public_url} />
            </label>
          </div>

          <div className="card-actions">
            <button className="primary-button" onClick={() => void handleCopyLink()} type="button">
              Copy Public Link
            </button>
            <a className="ghost-button inline-link" href={survey.public_url} rel="noreferrer" target="_blank">
              Open Public Page
            </a>
            <button className="ghost-button" disabled={busyAction === 'duplicate'} onClick={() => void handleDuplicate()} type="button">
              Duplicate Survey
            </button>
          </div>

          <dl className="meta-detail-grid">
            <div className="meta-item">
              <dt>Created</dt>
              <dd>{formatDateTime(survey.created_at)}</dd>
            </div>
            <div className="meta-item">
              <dt>Responses</dt>
              <dd>{survey.response_count}</dd>
            </div>
            <div className="meta-item">
              <dt>Editing status</dt>
              <dd>{survey.can_edit_questions ? 'Question set is editable' : 'Question set is locked by responses'}</dd>
            </div>
            <div className="meta-item meta-item-wide">
              <dt>Storage folder</dt>
              <dd>{survey.storage_path}</dd>
            </div>
          </dl>
        </article>

        <article className="glass-card premium-card qr-card">
          <div className="qr-card-content">
            <div>
              <p className="eyebrow">QR Code</p>
              <h3>Scan to open</h3>
            </div>
            <div className="qr-frame" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
        </article>
      </section>

      <section className="details-grid share-grid">
        <article className="glass-card premium-card detail-card">
          <div className="detail-card-header">
            <div className="section-head">
              <div>
                <p className="eyebrow">Actions</p>
                <h3>Status</h3>
              </div>
            </div>
          </div>

          <div className="card-actions">
            <button className="ghost-button" disabled={busyAction === 'archived' || busyAction === 'active'} onClick={() => void handleStatusToggle()} type="button">
              {survey.status === 'archived' ? 'Reactivate Survey' : 'Archive Survey'}
            </button>
            <button className="ghost-button danger-button" disabled={busyAction === 'delete'} onClick={() => void handleDelete()} type="button">
              Delete Survey
            </button>
          </div>

          {!hasWordCloudQuestion ? (
            <div className="empty-card">
              <p>No word cloud sources available</p>
            </div>
          ) : (
            <div className="card-actions">
              <Link className="primary-button inline-link" target="_blank" to={`/word-cloud/${survey.id}`}>
                Open Word Cloud Display
              </Link>
              <button className="ghost-button" onClick={() => void handleCopyWordCloudDisplayLink()} type="button">
                Copy Word Cloud Display Link
              </button>
            </div>
          )}
        </article>

        <article className="glass-card premium-card detail-card">
          <div className="detail-card-header">
            <div className="section-head">
              <div>
                <p className="eyebrow">Exports</p>
                <h3>Download files</h3>
              </div>
            </div>
          </div>

          <div className="card-actions">
            {EXPORTS.map((item) => (
              <button
                className="ghost-button"
                disabled={busyAction === item.file}
                key={item.file}
                onClick={() => void handleDownload(item.file)}
                type="button"
              >
                Download {item.label}
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="glass-card premium-card detail-card">
        <div className="detail-card-header">
          <div className="section-head">
            <div>
              <p className="eyebrow">Questions</p>
              <h3>Survey structure</h3>
            </div>
          </div>
        </div>

        <div className="question-list question-list-grid">
          {survey.questions.map((question) => (
            <article className="question-preview" key={question.id}>
              <div className="question-preview-top">
                <span className="status-pill">{formatQuestionType(question.type)}</span>
                <span className="response-pill">{question.required ? 'Required' : 'Optional'}</span>
              </div>
              <div className="question-preview-body">
                <div className="question-preview-copy">
                  <p className="eyebrow">Question {question.position}</p>
                  <h4>{question.prompt}</h4>
                </div>
              </div>
              {question.options.length ? (
                <div className="option-badges">
                  {question.options.map((option) => (
                    <span className="option-badge" key={option}>
                      {option}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">Free-form answer</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
