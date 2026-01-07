const KEY = "voltcar_token";

export const getToken = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string) => {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // ignore
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
