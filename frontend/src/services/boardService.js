/**
 * services/boardService.js
 * ========================
 * api_v2 (신규 스키마) 호출 모음.
 *
 * 레거시 엔드포인트와 달라진 점
 *   /dbtest        -> GET    /api/posts
 *   /detail_board  -> GET    /api/posts/{id}
 *   /create_board  -> POST   /api/posts
 *   /update_board  -> PUT    /api/posts/{id}
 *   /delete_board  -> DELETE /api/posts/{id}
 * 게시판 지정도 b_part(board6) 대신 Board.slug(projects) 를 쓴다.
 */

import useApi, { useAuthApi, useApi_file } from "../hooks/api/axiosInterceptor";

/**
 * 서버가 주는 `/api/...` 상대경로를 브라우저가 바로 쓸 수 있는 주소로 바꾼다.
 * 개발에서는 API 가 다른 포트(5002)에 있어 baseURL 을 앞에 붙여야 한다.
 */
export const resolveApiUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    const base = (useApi.defaults.baseURL || "").replace(/\/api\/?$/, "");
    return base + path;
};

/**
 * DB 본문에는 배포 호스트와 무관한 `/api/...` 경로를 저장한다. 화면에 그릴
 * 때만 개발(5002) 또는 운영(동일 origin)의 API 주소로 변환한다. 과거 로컬
 * 주소가 저장된 글도 현재 환경에서 열리도록 localhost URL을 함께 보정한다.
 */
export const resolveContentApiUrls = (html) => {
    if (!html) return html;
    return html.replace(
        /(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
        (tag, prefix, source, suffix) => {
            let apiPath = source;
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\//i.test(source)) {
                try {
                    const parsed = new URL(source);
                    apiPath = parsed.pathname + parsed.search;
                } catch (_error) {
                    return tag;
                }
            }
            if (!apiPath.startsWith("/api/")) return tag;
            return `${prefix}${resolveApiUrl(apiPath)}${suffix}`;
        }
    );
};

/** 게시글 목록. searchTerm 은 제목/내용/작성자를 가리지 않고 통째로 검색한다. */
export const fetchPosts = async ({ board, offset = 0, limit = 10, searchTerm }) => {
    const params = new URLSearchParams({ board, offset: String(offset), limit: String(limit) });
    if (searchTerm) {
        params.set("searchTerm", searchTerm);
    }
    const { data } = await useApi.get(`/posts?${params.toString()}`);
    if (data.result !== "SUCCESS") {
        throw new Error(data.message || "게시글 목록을 불러오지 못했습니다.");
    }
    // 썸네일은 상대경로로 오므로 화면에서 바로 <img src> 에 쓸 수 있게 바꿔 준다
    const posts = (data.data || []).map((post) => ({
        ...post,
        thumbnailUrl: resolveApiUrl(post.thumbnailUrl),
    }));
    return { posts, totalCount: data.totalCount || 0 };
};

/**
 * 게시글 상세 (조회수는 서버에서 증가).
 *
 * 학생자치 게시판(회의록 등)은 로그인해야 볼 수 있어 토큰을 실어 보내는
 * useAuthApi 를 쓴다. 로그인 안 한 사용자가 봐도 되는 게시판에도 토큰을
 * 같이 보내지만, 서버는 그런 게시판에서는 토큰을 아예 안 보므로 문제없다.
 *
 * 실패 응답은 200이 아니라서 axios 가 바로 reject 하므로 catch 에서 서버가
 * 준 메시지/코드를 꺼내 다시 던진다. (전에는 여기서 `data.result` 를 봤는데
 * reject 되면 그 줄까지 못 와서 죽은 코드였다.)
 */
export const fetchPost = async (board, id) => {
    try {
        const { data } = await useAuthApi.get(`/posts/${id}?board=${encodeURIComponent(board)}`);
        return data.data;
    } catch (err) {
        const payload = err.response && err.response.data;
        const message = (payload && payload.message) || "게시글을 찾을 수 없습니다.";
        const wrapped = new Error(message);
        wrapped.errorCode = payload && payload.error_code;
        throw wrapped;
    }
};

/** 게시글 작성 (관리자) */
export const createPost = async ({ board, title, content, files = [], isNotice, event }) => {
    const formData = new FormData();
    formData.append("board", board);
    formData.append("title", title);
    formData.append("content", content);
    if (isNotice) formData.append("isNotice", "true");
    files.forEach((file) => formData.append("file", file));

    // 참여행사 게시글이면 Event 가 함께 생성된다 (시작일·종료일 모두 전송)
    if (event && event.eventDate) {
        formData.append("isparticipate", "true");
        formData.append("event_date", event.eventDate);
        if (event.endDate) formData.append("end_date", event.endDate);
        if (event.formDate) formData.append("form_date", event.formDate);
        // 캘린더에 뜰 이름. 비우면 서버가 글 제목을 쓴다.
        formData.append("event_name", event.eventName || "");
    }

    const { data } = await useApi_file.post("/posts", formData);
    if (data.result !== "SUCCESS") {
        throw new Error(data.message || "게시글 작성에 실패했습니다.");
    }
    return data.boardId;
};

/** 게시글 수정 (관리자) */
export const updatePost = async (
    id,
    { board, title, content, files = [], deleteAttachmentIds = [], isNotice, event },
) => {
    const formData = new FormData();
    formData.append("board", board);
    formData.append("title", title);
    formData.append("content", content);
    if (isNotice !== undefined) formData.append("isNotice", isNotice ? "true" : "false");
    files.forEach((file) => formData.append("file", file));
    // 수정 화면에서 뺀 기존 첨부 (서버가 이 글의 첨부 행만 지운다)
    deleteAttachmentIds.forEach((attachmentId) =>
        formData.append("deleteAttachmentIds", String(attachmentId)));

    // 참여행사 글이면 행사 날짜 칸을 함께 보낸다.
    // 빈 문자열도 그대로 보낸다 — 서버가 "캘린더에서 내려 달라"로 읽는다.
    if (event) {
        formData.append("event_date", event.eventDate || "");
        formData.append("end_date", event.endDate || "");
        formData.append("form_date", event.formDate || "");
        formData.append("event_name", event.eventName || "");
    }

    const { data } = await useApi_file.put(`/posts/${id}`, formData);
    if (data.result !== "SUCCESS") {
        throw new Error(data.message || "게시글 수정에 실패했습니다.");
    }
    return data.boardId;
};

/** 게시글 삭제 (관리자) */
export const deletePost = async (board, id) => {
    const { data } = await useAuthApi.delete(`/posts/${id}?board=${encodeURIComponent(board)}`);
    if (data.result !== "SUCCESS") {
        throw new Error(data.message || "게시글 삭제에 실패했습니다.");
    }
    return true;
};

/** 첨부파일 다운로드 (파일명은 Base64(UTF-8)로 보낸다) */
export const downloadAttachment = async (fileName, postId) => {
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(fileName)));
    const response = await useApi.post(
        "/files/download",
        { fileName: encoded, originalName: fileName, postId },
        { responseType: "blob" }
    );
    return response.data;
};

/**
 * 본문에 삽입할 이미지를 업로드하고 <img src> 에 쓸 URL 을 받는다. (관리자)
 *
 * 게시글이 아직 없을 수도 있어 여기서는 파일만 올라간다.
 * Attachment 행은 게시글을 저장할 때 서버가 본문을 보고 등록한다.
 */
export const uploadInlineImage = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const { data } = await useApi_file.post("/files/image", formData);
    if (data.result !== "SUCCESS") {
        throw new Error(data.message || "이미지를 업로드하지 못했습니다.");
    }
    return data.data;
};

/**
 * 서버가 관리하는 메뉴/게시판 트리.
 * config/boards.js 의 하드코딩 대신 이 값을 쓰면 게시판이 추가돼도
 * 프론트를 고치지 않아도 된다.
 */
export const fetchBoardTree = async () => {
    const { data } = await useApi.get("/boards");
    if (data.result !== "SUCCESS") {
        throw new Error(data.message || "게시판 목록을 불러오지 못했습니다.");
    }
    return data.data || [];
};
