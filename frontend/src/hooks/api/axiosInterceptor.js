import axios from "axios";
// 신규 스키마 백엔드(backend/api_v2)는 기본 5002 포트로 뜬다.
// 다른 포트를 쓰면 frontend/.env 에 REACT_APP_API_BASE_URL 을 지정하면 된다.
const baseURL =
    process.env.REACT_APP_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5002/api');

const readToken = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);

const authHeader = (config) => {
    const token = readToken("access_token");
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
};

const useApi = axios.create({
    baseURL: baseURL,
    headers: {
        "Content-Type": "application/json;charset=UTF-8",
    },
});

const useAuthApi = axios.create({
    baseURL: baseURL,
    headers: {
        ...authHeader.headers,
        "Content-Type": "application/json;charset=UTF-8"
    }
})

const useApi_file = axios.create({
    baseURL: baseURL,
    headers: {
        ...authHeader.headers,
        "Content-Type": "multipart/form-data",
    },
});

useAuthApi.interceptors.request.use(authHeader, (error) => {
    return Promise.reject(error);
});

useApi_file.interceptors.request.use(authHeader, (error) => {
    return Promise.reject(error);
});

// =============================================================================
// 액세스 토큰 자동 재발급
// =============================================================================
// 액세스 토큰 수명이 15분이라 그대로 두면 로그인 15분 뒤부터 관리자 동작이
// 전부 401 로 실패한다. 401 을 만나면 refresh_token 으로 한 번 재발급하고
// 원래 요청을 다시 보낸다. 재발급까지 실패하면 토큰을 지우고 로그인으로 보낸다.
//
// 동시에 여러 요청이 401 을 받아도 재발급은 한 번만 돌도록 프로미스를 공유한다.
let refreshPromise = null;

const clearSession = () => {
    ["access_token", "refresh_token", "user_role", "user_role_detail"].forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
};

const requestNewAccessToken = () => {
    const refreshToken = readToken("refresh_token");
    if (!refreshToken) return Promise.reject(new Error("refresh_token 이 없습니다."));

    // 이 요청에는 인터셉터를 붙이지 않은 순수 axios 를 쓴다 (무한 재귀 방지)
    return axios
        .post(`${baseURL}/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
        })
        .then((response) => {
            const token = response.data?.data?.access_token;
            if (!token) throw new Error("재발급 응답에 access_token 이 없습니다.");
            // 원래 토큰을 두었던 저장소에 그대로 돌려놓는다
            if (localStorage.getItem("refresh_token")) {
                localStorage.setItem("access_token", token);
            } else {
                sessionStorage.setItem("access_token", token);
            }
            return token;
        });
};

const attachRefreshRetry = (instance) => {
    instance.interceptors.response.use(
        (response) => response,
        (error) => {
            const original = error.config;
            const status = error.response?.status;

            // 재발급 자체가 실패한 경우나 이미 한 번 재시도한 요청은 그대로 넘긴다
            if (status !== 401 || !original || original._retried) {
                return Promise.reject(error);
            }
            if (String(original.url || "").includes("/auth/refresh")) {
                return Promise.reject(error);
            }

            original._retried = true;
            if (!refreshPromise) {
                refreshPromise = requestNewAccessToken().finally(() => {
                    refreshPromise = null;
                });
            }

            return refreshPromise
                .then((token) => {
                    original.headers = original.headers || {};
                    original.headers.Authorization = `Bearer ${token}`;
                    return instance(original);
                })
                .catch(() => {
                    clearSession();
                    if (!window.location.pathname.startsWith("/intro/login")) {
                        alert("로그인이 만료되었습니다. 다시 로그인해 주세요.");
                        window.location.href = "/intro/login";
                    }
                    return Promise.reject(error);
                });
        }
    );
};

[useApi, useAuthApi, useApi_file].forEach(attachRefreshRetry);

export { useApi as default, useApi, useAuthApi, useApi_file };
