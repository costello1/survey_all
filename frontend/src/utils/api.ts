import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import QRCode from 'qrcode';
import { firebaseAuth, firestore } from '../firebase';
import type {
  AnalyticsQuestion,
  DraftQuestion,
  ExportFilename,
  LoginResponse,
  PublicSurvey,
  Question,
  SurveyAnalytics,
  SurveyDetail,
  SurveyListItem,
  WordCloudData,
  WordCount,
} from '../types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type StoredSurvey = {
  title: string;
  description: string | null;
  slug: string;
  publicToken: string;
  status: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
  questions: Question[];
};

type StoredResponse = {
  submittedAt: Timestamp | string;
  answers: Array<{ question_id: number; value: unknown }>;
};

const ADMIN_EMAIL_DOMAIN = '@survey.local';

function requireAdmin() {
  if (!firebaseAuth.currentUser) {
    throw new ApiError('Sign in to continue.', 401);
  }
}

function normalizeAdminEmail(username: string) {
  const trimmed = username.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed}${ADMIN_EMAIL_DOMAIN}`;
}

function toIsoDate(value: Timestamp | string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }
  return value instanceof Timestamp ? value.toDate().toISOString() : new Date(value).toISOString();
}

function getBasePath() {
  return import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
}

function publicUrlFor(slug: string) {
  return `${window.location.origin}${getBasePath()}${slug}`;
}

function storagePathFor(surveyId: string) {
  return `Firestore /surveys/${surveyId}`;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `survey-${Date.now()}`;
}

function nextNumericId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function mapDraftQuestions(questions: DraftQuestion[]): Question[] {
  return questions.map((question, index) => ({
    id: index + 1,
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    options: question.options,
    position: index + 1,
  }));
}

async function getResponses(surveyId: string): Promise<Array<{ id: string; data: StoredResponse }>> {
  const snapshot = await getDocs(query(collection(firestore, 'surveys', surveyId, 'responses'), orderBy('submittedAt', 'asc')));
  return snapshot.docs.map((responseDoc) => ({
    id: responseDoc.id,
    data: responseDoc.data() as StoredResponse,
  }));
}

async function responseCountFor(surveyId: string) {
  const snapshot = await getDocs(collection(firestore, 'surveys', surveyId, 'responses'));
  return snapshot.size;
}

function surveyFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>, responseCount: number): SurveyDetail {
  const data = snapshot.data() as StoredSurvey;
  const id = Number(snapshot.id);

  return {
    id,
    title: data.title,
    description: data.description ?? null,
    slug: data.slug,
    public_url: publicUrlFor(data.slug),
    created_at: toIsoDate(data.createdAt),
    status: data.status,
    response_count: responseCount,
    public_token: data.publicToken,
    can_edit_questions: responseCount === 0,
    storage_path: storagePathFor(snapshot.id),
    questions: data.questions ?? [],
  };
}

async function findSurveyByPublicKey(publicKey: string) {
  const byToken = await getDocs(
    query(collection(firestore, 'surveys'), where('publicToken', '==', publicKey), where('status', '==', 'active'), limit(1)),
  );
  if (!byToken.empty) {
    return byToken.docs[0];
  }

  const bySlug = await getDocs(
    query(collection(firestore, 'surveys'), where('slug', '==', publicKey), where('status', '==', 'active'), limit(1)),
  );
  return bySlug.empty ? null : bySlug.docs[0];
}

function countWords(values: string[]): WordCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const word = value.trim();
    if (!word) {
      continue;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word));
}

function answerFor(response: StoredResponse, questionId: number) {
  return response.answers.find((answer) => answer.question_id === questionId)?.value;
}

function buildAnalytics(survey: SurveyDetail, responses: Array<{ id: string; data: StoredResponse }>): SurveyAnalytics {
  const questions: AnalyticsQuestion[] = survey.questions.map((question) => {
    const values = responses
      .map((response) => ({ response, value: answerFor(response.data, question.id) }))
      .filter((item) => item.value !== undefined && item.value !== null && item.value !== '');

    const choiceCounts = question.options.map((option) => ({ label: option, count: 0 }));
    const textResponses = [];
    const cloudWords: string[] = [];

    for (const item of values) {
      if (question.type === 'single_choice' && typeof item.value === 'string') {
        const match = choiceCounts.find((choice) => choice.label === item.value);
        if (match) {
          match.count += 1;
        }
      }

      if (question.type === 'multiple_choice' && Array.isArray(item.value)) {
        for (const value of item.value) {
          const match = choiceCounts.find((choice) => choice.label === value);
          if (match) {
            match.count += 1;
          }
          if (typeof value === 'string') {
            cloudWords.push(value);
          }
        }
      }

      if (question.type === 'open_text' && typeof item.value === 'string') {
        textResponses.push({
          response_id: Number(item.response.id.replace(/\D/g, '').slice(-9)) || 0,
          submitted_at: toIsoDate(item.response.data.submittedAt),
          value: item.value,
        });
      }

      if (question.type === 'single_word' && typeof item.value === 'string') {
        cloudWords.push(item.value);
      }
    }

    return {
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      options: question.options,
      total_answers: values.length,
      choice_counts: choiceCounts,
      text_responses: textResponses,
      word_counts: countWords(cloudWords),
    };
  });

  return {
    survey_id: survey.id,
    survey_title: survey.title,
    response_count: responses.length,
    questions,
  };
}

function buildWordCloud(analytics: SurveyAnalytics, selectedQuestionId?: number): WordCloudData {
  const availableQuestions = analytics.questions.filter(
    (question) => question.type === 'single_word' || question.type === 'multiple_choice',
  );
  const selected = availableQuestions.find((question) => question.id === selectedQuestionId) ?? availableQuestions[0];

  return {
    survey_id: analytics.survey_id,
    survey_title: analytics.survey_title,
    available_questions: selected
      ? availableQuestions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          required: false,
          options: question.options,
          position: question.id,
        }))
      : [],
    selected_question_id: selected?.id ?? null,
    words: selected?.word_counts ?? [],
  };
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function validatePublicAnswers(survey: PublicSurvey, answers: Array<{ question_id: number; value: unknown }>) {
  for (const question of survey.questions) {
    const answer = answers.find((item) => item.question_id === question.id);
    const value = answer?.value;
    const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());

    if (question.required && !hasValue) {
      throw new ApiError(`Please answer the required question: ${question.prompt}`, 400);
    }

    if (question.type === 'single_word' && typeof value === 'string' && value.trim().split(/\s+/).length > 1) {
      throw new ApiError('One-word questions must contain a single word.', 400);
    }
  }
}

export async function loginAdmin(username: string, password: string): Promise<LoginResponse> {
  const email = normalizeAdminEmail(username);

  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return {
      token: credential.user.uid,
      username: username.trim(),
    };
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(error.code)
    ) {
      throw new ApiError(`Firebase rejected these credentials. Create the admin user "${email}" in Firebase Authentication and use its password.`, 401);
    }

    if (error instanceof FirebaseError && error.code === 'auth/operation-not-allowed') {
      throw new ApiError('Enable the Email/Password provider in Firebase Authentication.', 401);
    }

    throw error;
  }
}

export async function getAdminMe(): Promise<{ username: string }> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new ApiError('Sign in to continue.', 401);
  }
  return { username: user.email?.split('@')[0] ?? 'admin' };
}

export async function listAdminSurveys(): Promise<SurveyListItem[]> {
  requireAdmin();
  const snapshot = await getDocs(query(collection(firestore, 'surveys'), orderBy('createdAt', 'desc')));
  const surveys = await Promise.all(snapshot.docs.map((surveyDoc) => responseCountFor(surveyDoc.id).then((count) => surveyFromSnapshot(surveyDoc, count))));
  return surveys;
}

export async function createAdminSurvey(payload: {
  title: string;
  description: string;
  questions: DraftQuestion[];
}): Promise<SurveyDetail> {
  requireAdmin();
  const surveyId = String(nextNumericId());
  const slug = `${slugify(payload.title)}-${surveyId.slice(-5)}`;
  const survey: StoredSurvey = {
    title: payload.title,
    description: payload.description || null,
    slug,
    publicToken: crypto.randomUUID(),
    status: 'active',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    questions: mapDraftQuestions(payload.questions),
  };

  await setDoc(doc(firestore, 'surveys', surveyId), survey);
  const snapshot = await getDoc(doc(firestore, 'surveys', surveyId));
  return surveyFromSnapshot(snapshot as QueryDocumentSnapshot<DocumentData>, 0);
}

export async function getAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  requireAdmin();
  const snapshot = await getDoc(doc(firestore, 'surveys', surveyId));
  if (!snapshot.exists()) {
    throw new ApiError('Survey not found.', 404);
  }
  return surveyFromSnapshot(snapshot as QueryDocumentSnapshot<DocumentData>, await responseCountFor(surveyId));
}

export async function updateAdminSurvey(
  surveyId: string,
  payload: {
    title: string;
    description: string;
    questions: DraftQuestion[];
  },
): Promise<SurveyDetail> {
  requireAdmin();
  const current = await getAdminSurvey(surveyId);
  const updates: Partial<StoredSurvey> = {
    title: payload.title,
    description: payload.description || null,
    updatedAt: Timestamp.now(),
  };

  if (current.can_edit_questions) {
    updates.questions = mapDraftQuestions(payload.questions);
  }

  await updateDoc(doc(firestore, 'surveys', surveyId), updates);
  return getAdminSurvey(surveyId);
}

export async function duplicateAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  const current = await getAdminSurvey(surveyId);
  return createAdminSurvey({
    title: `${current.title} Copy`,
    description: current.description ?? '',
    questions: current.questions.map((question) => ({
      clientId: crypto.randomUUID(),
      prompt: question.prompt,
      type: question.type,
      required: question.required,
      options: question.options,
    })),
  });
}

export async function archiveAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  requireAdmin();
  await updateDoc(doc(firestore, 'surveys', surveyId), { status: 'archived', updatedAt: serverTimestamp() });
  return getAdminSurvey(surveyId);
}

export async function activateAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  requireAdmin();
  await updateDoc(doc(firestore, 'surveys', surveyId), { status: 'active', updatedAt: serverTimestamp() });
  return getAdminSurvey(surveyId);
}

export async function deleteAdminSurvey(surveyId: string): Promise<{ message: string }> {
  requireAdmin();
  const responses = await getDocs(collection(firestore, 'surveys', surveyId, 'responses'));
  await Promise.all(responses.docs.map((responseDoc) => deleteDoc(responseDoc.ref)));
  await deleteDoc(doc(firestore, 'surveys', surveyId));
  return { message: 'Survey deleted.' };
}

export async function getAdminSurveyQr(surveyId: string): Promise<string> {
  const survey = await getAdminSurvey(surveyId);
  return QRCode.toString(survey.public_url, {
    type: 'svg',
    margin: 1,
    width: 220,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}

export async function getSurveyAnalytics(surveyId: string): Promise<SurveyAnalytics> {
  const survey = await getAdminSurvey(surveyId);
  const responses = await getResponses(surveyId);
  return buildAnalytics(survey, responses);
}

export async function getSurveyWordCloud(surveyId: string, questionId?: number): Promise<WordCloudData> {
  return buildWordCloud(await getSurveyAnalytics(surveyId), questionId);
}

export async function downloadSurveyExport(surveyId: string, filename: ExportFilename): Promise<void> {
  const survey = await getAdminSurvey(surveyId);
  const responses = await getResponses(surveyId);

  if (filename === 'survey.json') {
    downloadBlob(filename, JSON.stringify(survey, null, 2), 'application/json');
    return;
  }

  const responsePayload = responses.map((response) => ({
    id: response.id,
    submitted_at: toIsoDate(response.data.submittedAt),
    answers: response.data.answers,
  }));

  if (filename === 'responses.json') {
    downloadBlob(filename, JSON.stringify(responsePayload, null, 2), 'application/json');
    return;
  }

  const rows = ['response_id,submitted_at,question_id,question,value'];
  for (const response of responses) {
    for (const answer of response.data.answers) {
      const question = survey.questions.find((item) => item.id === answer.question_id);
      rows.push(
        [
          csvEscape(response.id),
          csvEscape(toIsoDate(response.data.submittedAt)),
          csvEscape(answer.question_id),
          csvEscape(question?.prompt ?? ''),
          csvEscape(answer.value),
        ].join(','),
      );
    }
  }
  downloadBlob(filename, rows.join('\n'), 'text/csv');
}

export async function getPublicSurvey(publicToken: string): Promise<PublicSurvey> {
  const snapshot = await findSurveyByPublicKey(publicToken);
  if (!snapshot) {
    throw new ApiError('Survey not found.', 404);
  }
  const data = snapshot.data() as StoredSurvey;
  if (data.status !== 'active') {
    throw new ApiError('This survey is currently closed.', 403);
  }
  return {
    id: Number(snapshot.id),
    title: data.title,
    description: data.description ?? null,
    public_token: data.publicToken,
    questions: data.questions ?? [],
  };
}

export async function submitPublicSurvey(
  publicToken: string,
  answers: Array<{ question_id: number; value: unknown }>,
): Promise<{ message: string }> {
  const snapshot = await findSurveyByPublicKey(publicToken);
  if (!snapshot) {
    throw new ApiError('Survey not found.', 404);
  }
  const data = snapshot.data() as StoredSurvey;
  const survey: PublicSurvey = {
    id: Number(snapshot.id),
    title: data.title,
    description: data.description ?? null,
    public_token: data.publicToken,
    questions: data.questions ?? [],
  };
  validatePublicAnswers(survey, answers);
  await addDoc(collection(firestore, 'surveys', snapshot.id, 'responses'), {
    submittedAt: serverTimestamp(),
    answers,
  });
  return { message: 'Response submitted.' };
}

export function subscribeSurveyAnalytics(
  surveyId: string,
  onData: (analytics: SurveyAnalytics) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let survey: SurveyDetail | null = null;
  void getAdminSurvey(surveyId)
    .then((loadedSurvey) => {
      survey = loadedSurvey;
    })
    .catch((error) => onError?.(error instanceof Error ? error : new Error('Unable to load analytics.')));

  return onSnapshot(
    query(collection(firestore, 'surveys', surveyId, 'responses'), orderBy('submittedAt', 'asc')),
    async (snapshot) => {
      try {
        if (!survey) {
          survey = await getAdminSurvey(surveyId);
        }
        const responses = snapshot.docs.map((responseDoc) => ({
          id: responseDoc.id,
          data: responseDoc.data() as StoredResponse,
        }));
        onData(buildAnalytics({ ...survey, response_count: responses.length }, responses));
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Unable to refresh analytics.'));
      }
    },
    (error) => onError?.(error),
  );
}

export function subscribeSurveyWordCloud(
  surveyId: string,
  questionId: number | undefined,
  onData: (data: WordCloudData) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeSurveyAnalytics(
    surveyId,
    (analytics) => onData(buildWordCloud(analytics, questionId)),
    onError,
  );
}
