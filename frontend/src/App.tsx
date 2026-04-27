import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLoginPage from './pages/AdminLoginPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CreateSurveyPage from './pages/CreateSurveyPage';
import DashboardPage from './pages/DashboardPage';
import EditSurveyPage from './pages/EditSurveyPage';
import PublicSurveyPage from './pages/PublicSurveyPage';
import SurveyDetailPage from './pages/SurveyDetailPage';
import ThankYouPage from './pages/ThankYouPage';
import WordCloudPage from './pages/WordCloudPage';
import WordCloudDisplayPage from './pages/WordCloudDisplayPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/survey/:publicToken" element={<PublicSurveyPage />} />
      <Route path="/:surveySlug" element={<PublicSurveyPage />} />
      <Route path="/thank-you" element={<ThankYouPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin/surveys/:surveyId/word-cloud/display" element={<WordCloudDisplayPage />} />
        <Route element={<AppShell />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/surveys/new" element={<CreateSurveyPage />} />
          <Route path="/admin/surveys/:surveyId/edit" element={<EditSurveyPage />} />
          <Route path="/admin/surveys/:surveyId" element={<SurveyDetailPage />} />
          <Route path="/admin/surveys/:surveyId/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/surveys/:surveyId/word-cloud" element={<WordCloudPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
