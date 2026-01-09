import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { setToken } from "../auth/token";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const res = await api.post("/api/auth/login", { login, password });
      setToken(res.data.accessToken);
      navigate("/", { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.error || "Ошибка входа";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7fb] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-[#1f1f1f] mb-1">Вольт Авто</h1>
        <p className="text-sm text-[#4b5563] mb-4">Вход</p>

        <label className="mb-3 block text-sm font-semibold text-[#1f1f1f]">
          Логин
          <input
            className="mt-1 w-full rounded-md border border-[#cfcfcf] px-3 py-2 text-sm focus:outline-none"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="mb-4 block text-sm font-semibold text-[#1f1f1f]">
          Пароль
          <input
            className="mt-1 w-full rounded-md border border-[#cfcfcf] px-3 py-2 text-sm focus:outline-none"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="mb-3 rounded-md border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#41c36c] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#36a65c] disabled:opacity-60"
        >
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
    </div>
  );
};
