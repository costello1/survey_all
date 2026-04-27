import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SurveyComposer from '../components/SurveyComposer';
import { useToast } from '../components/ToastProvider';
import type { DraftQuestion, SurveyDetail } from '../types';
import { getAdminSurvey, updateAdminSurvey } from '../utils/api';
import { mapQuestionToDraft, sanitizeDraftQuestions, validateDraftQuestions } from '../utils/survey';

export default function EditSurveyPage() {
  const navigate = useNavigate();
  const { surveyId = '' } = useParams();
  const { pushToast } = useToast();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAdminSurvey(surveyId)
      .then((response) => {
        if (!active) {
          return;
        }
        setSurvey(response);
        setTitle(response.title);
        setDescription(response.description ?? '');
        setQuestions(response.questions.map(mapQuestionToDraft));
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the survey.');
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
  }, [surveyId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = !title.trim() ? 'The survey title is required.' : validateDraftQuestions(questions);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updated = await updateAdminSurvey(surveyId, {
        title: title.trim(),
        description: description.trim(),
        questions: sanitizeDraftQuestions(questions),
      });
      setSurvey(updated);
      pushToast({
        tone: 'success',
        title: 'Survey saved',
        message: updated.can_edit_questions
          ? 'The structure and metadata were updated successfully.'
          : 'The metadata was updated. Question editing stays locked because responses already exist.',
      });
      navigate(`/admin/surveys/${surveyId}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save the survey.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <h3>Loading survey editor...</h3>
        </div>
      </section>
    );
  }

  if (error && !survey) {
    return (
      <section className="page-stack">
        <div className="glass-card centered-card">
          <p className="error-text">{error}</p>
        </div>
      </section>
    );
  }

  if (!survey) {
    return null;
  }

  return (
    <section className="page-stack">
      <header className="page-header page-hero">
        <div>
          <p className="eyebrow">Survey Builder</p>
          <h1>Edit survey</h1>
        </div>
      </header>

      <SurveyComposer
        description={description}
        error={error}
        loading={saving}
        mode="edit"
        onDescriptionChange={setDescription}
        onQuestionsChange={setQuestions}
        onSubmit={handleSubmit}
        onTitleChange={setTitle}
        questionEditingLocked={!survey.can_edit_questions}
        questions={questions}
        title={title}
      />
    </section>
  );
}
