import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../utils/api';
import { setAuthToken } from '../utils/auth';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin1234!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await loginAdmin(username, password);
      setAuthToken(response.token);
      navigate('/admin');
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Unable to log in.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="glass-card login-card premium-card">
        <p className="eyebrow">Pulse Survey Studio</p>
        <div className="login-card-head">
          <p className="eyebrow">Admin sign in</p>
          <h1>Sign in</h1>
          <p className="muted-copy">Sign in to continue.</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input placeholder="Enter your admin username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>

          <label className="field">
            <span>Password</span>
            <input placeholder="Enter your password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Enter Admin Panel'}
          </button>
        </form>
      </section>
    </main>
  );
}
