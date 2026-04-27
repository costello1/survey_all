import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SurveyComposer from '../components/SurveyComposer';
import type { DraftQuestion } from '../types';
import { useToast } from '../components/ToastProvider';
import { createAdminSurvey } from '../utils/api';
import { createDraftQuestionRecord, sanitizeDraftQuestions, validateDraftQuestions } from '../utils/survey';

export default function CreateSurveyPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([createDraftQuestionRecord('open_text')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = !title.trim() ? 'The survey title is required.' : validateDraftQuestions(questions);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const survey = await createAdminSurvey({
        title: title.trim(),
        description: description.trim(),
        questions: sanitizeDraftQuestions(questions),
      });
      pushToast({
        tone: 'success',
        title: 'Survey published',
        message: 'Your survey is live and ready to share.',
      });
      navigate(`/admin/surveys/${survey.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to create the survey.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header page-hero">
        <div>
          <p className="eyebrow">Survey Builder</p>
          <h1>New survey</h1>
        </div>
      </header>

      <SurveyComposer
        description={description}
        error={error}
        loading={loading}
        mode="create"
        onDescriptionChange={setDescription}
        onQuestionsChange={setQuestions}
        onSubmit={handleSubmit}
        onTitleChange={setTitle}
        questions={questions}
        title={title}
      />
    </section>
  );
}
