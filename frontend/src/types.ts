export type QuestionType = 'open_text' | 'single_choice' | 'multiple_choice' | 'single_word';

export interface Question {
  id: number;
  prompt: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  position: number;
}

export interface DraftQuestion {
  clientId: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  options: string[];
}

export interface SurveyListItem {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  public_url: string;
  created_at: string;
  status: string;
  response_count: number;
  public_token: string;
  can_edit_questions: boolean;
}

export interface SurveyDetail extends SurveyListItem {
  slug: string;
  public_url: string;
  can_edit_questions: boolean;
  storage_path: string;
  questions: Question[];
}

export interface PublicSurvey {
  id: number;
  title: string;
  description: string | null;
  public_token: string;
  questions: Question[];
}

export interface ChoiceCount {
  label: string;
  count: number;
}

export interface TextResponseItem {
  response_id: number;
  submitted_at: string;
  value: string;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface AnalyticsQuestion {
  id: number;
  prompt: string;
  type: QuestionType;
  options: string[];
  total_answers: number;
  choice_counts: ChoiceCount[];
  text_responses: TextResponseItem[];
  word_counts: WordCount[];
}

export interface SurveyAnalytics {
  survey_id: number;
  survey_title: string;
  response_count: number;
  questions: AnalyticsQuestion[];
}

export interface WordCloudData {
  survey_id: number;
  survey_title: string;
  available_questions: Question[];
  selected_question_id: number | null;
  words: WordCount[];
}

export interface LoginResponse {
  token: string;
  username: string;
}

export type ExportFilename = 'survey.json' | 'responses.json' | 'responses.csv';
