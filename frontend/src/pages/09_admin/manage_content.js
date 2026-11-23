/**
 * 09_admin/manage_content.js
 * ==========================
 * 콘텐츠 관리 — 예전의 "게시글 관리" 와 "섹션 이미지 관리" 를 하나로 합친 화면.
 *
 * 두 화면으로 나뉘어 있을 때의 문제
 * ---------------------------------
 * 메뉴 항목 중에는 게시글을 쌓는 곳(회의록, 참여 행사 …)과 고정 페이지
 * (회장단 인사말, 조직 및 업무, 오시는 길)가 섞여 있다. 고정 페이지는
 * 화면에 이미지를 그리는 게 전부라서 글을 아무리 올려도 페이지가 바뀌지 않는데,
 * "게시글 관리" 목록에는 그 이름이 함께 떠서 글을 올리면 반영되는 것처럼 보였다.
 *
 * 그래서 메뉴 구조(config/boards.js)를 그대로 펼쳐 놓고, 항목마다
 * 그 항목을 실제로 바꾸는 도구만 보여 준다.
 *
 *   type: "board" -> 게시글 목록 / 작성 / 수정 / 삭제
 *   type: "page"  -> 그 페이지에 걸리는 이미지 관리 (여러 장)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import {
    AdminDescription, AdminMessage, AdminTitle, AdminWrapper, isAdminOnlyUser, useAdminGuard,
} from "./adminCommon";
import { MENUS, boardPath } from "../../config/boards";
import useApi, { useApi_file, useAuthApi } from "../../hooks/api/axiosInterceptor";
import { deletePost, fetchPosts } from "../../services/boardService";
import { fetchContent, updateContent } from "../../services/contentService";
import { colors, font, media, radius } from "../../styles/theme";

/**
 * 고정 페이지 slug -> 섹션 이미지 키.
 * 키는 서버 admin.py 의 IMAGE_FILENAMES 와 반드시 같아야 한다.
 */
const PAGE_SECTIONS = {
    greeting: "president_greetings",
    organization: "organization_chart",
    location: "location",
};

/**
 * 고정 페이지 slug -> 텍스트 콘텐츠 키.
 * 키는 서버 admin.py 의 CONTENT_DEFAULTS 와 반드시 같아야 한다.
 * (이미지가 아니라 문구/링크를 짜 넣은 페이지가 여기 해당한다)
 */
const PAGE_CONTENTS = {
    rental: "rental",
};

/** 공개 페이지가 없어 관리 대상에서 뺀 섹션 (참고용으로만 보여 준다) */
const ORPHAN_SECTIONS = [
    { key: "executive_committee", name: "중앙집행위원회" },
    { key: "sub_committee", name: "산하위원회" },
];

const PAGE_SIZE = 10;

const MenuBlock = styled.section`
    margin-bottom: 34px;
`;

const MenuTitle = styled.h3`
    margin: 0 0 14px;
    padding-bottom: 9px;
    border-bottom: 2px solid ${colors.navy};
    font-family: ${font.family};
    font-size: ${font.size.lg};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
`;

const Item = styled.div`
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    margin-bottom: 12px;
    overflow: hidden;
`;

const ItemHead = styled.button`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 15px 18px;
    border: none;
    background: ${(props) => (props.$open ? colors.pageBg : colors.white)};
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.text};
    text-align: left;
    cursor: pointer;

    &:hover {
        background: ${colors.pageBg};
    }

    strong {
        font-weight: ${font.weight.semibold};
    }
`;

const Kind = styled.span`
    flex: 0 0 auto;
    padding: 3px 9px 4px;
    border-radius: ${radius.sm};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.semibold};
    background: ${(props) => (props.$page ? "#EDF3FF" : "#EAF6EE")};
    color: ${(props) => (props.$page ? "#2F5FBF" : "#1F7A46")};
`;

const Caret = styled.span`
    margin-left: auto;
    color: ${colors.textLight};
    font-size: ${font.size.sm};
`;

const ItemBody = styled.div`
    padding: 18px;
    border-top: 1px solid ${colors.divider};
`;

const Hint = styled.p`
    margin: 0 0 14px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    line-height: 1.6;
`;

const Button = styled.button`
    width: fit-content;
    padding: 8px 16px;
    border: 1px solid ${(props) => (props.$primary ? colors.navy : colors.border)};
    border-radius: ${radius.sm};
    background: ${(props) => (props.$primary ? colors.navy : colors.white)};
    color: ${(props) => (props.$primary ? colors.onNavy : colors.text)};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

const Row = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
`;

/* ---------- 텍스트 콘텐츠 ---------- */

const ContentForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const FieldGroup = styled.fieldset`
    margin: 0;
    padding: 14px 16px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    background: ${colors.pageBg};

    legend {
        padding: 0 6px;
        font-family: ${font.family};
        font-size: ${font.size.sm};
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
    }
`;

const FieldRow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;

    & + & {
        margin-top: 12px;
    }
`;

const FieldLabel = styled.label`
    font-family: ${font.family};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.semibold};
    color: ${colors.textMuted};
`;

const TextInput = styled.input`
    width: 100%;
    padding: 8px 10px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    background: ${colors.white};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.text};
    outline: none;

    &:focus {
        border-color: ${colors.navy};
    }
`;

const TextArea = styled.textarea`
    width: 100%;
    min-height: 72px;
    padding: 8px 10px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    background: ${colors.white};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.text};
    line-height: 1.6;
    resize: vertical;
    outline: none;

    &:focus {
        border-color: ${colors.navy};
    }
`;

const TwoCol = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    ${media.mobile} {
        grid-template-columns: 1fr;
    }
`;

/* ---------- 게시글 ---------- */

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-family: ${font.family};

    th,
    td {
        padding: 10px 8px;
        border-bottom: 1px solid ${colors.divider};
        font-size: ${font.size.sm};
        text-align: left;
    }

    th {
        color: ${colors.textMuted};
        font-weight: ${font.weight.semibold};
        white-space: nowrap;
    }

    td.title {
        color: ${colors.text};
        word-break: break-word;
    }

    td.actions {
        width: 1%;
        white-space: nowrap;
    }
`;

const Pager = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 14px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
`;

/* ---------- 이미지 ---------- */

const ImageGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;

    ${media.mobile} {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
`;

const ImageCard = styled.figure`
    margin: 0;
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    overflow: hidden;
    background: ${colors.pageBg};

    img {
        display: block;
        width: 100%;
        height: 150px;
        object-fit: contain;
        background: ${colors.white};
    }

    figcaption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        font-family: ${font.family};
        font-size: ${font.size.xs};
        color: ${colors.textMuted};
    }

    figcaption span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    figcaption button {
        flex: 0 0 auto;
        width: fit-content;
        padding: 2px 8px;
        border: none;
        background: none;
        color: ${colors.textMuted};
        font-size: ${font.size.xs};
        cursor: pointer;

        &:hover {
            color: #c62828;
        }
    }
`;

const OrphanNote = styled.p`
    margin: 26px 0 0;
    padding: 14px 16px;
    border: 1px solid ${colors.border};
    border-left: 3px solid #c9a227;
    border-radius: ${radius.sm};
    background: ${colors.white};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    line-height: 1.7;
`;

/* =========================================================================
 * 게시판 항목 — 글 목록과 작성/수정/삭제
 * ====================================================================== */

const BoardPanel = ({ menuKey, board }) => {
    const navigate = useNavigate();
    const path = boardPath(menuKey, board.slug);
    // 회칙 및 세칙처럼 탭이 있는 게시판은 탭마다 실제 게시판이 다르다
    const targets = board.tabs && board.tabs.length ? board.tabs : [board];

    const [target, setTarget] = useState(targets[0].slug);
    const [page, setPage] = useState(1);
    const [posts, setPosts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchPosts({
                board: target,
                offset: (page - 1) * PAGE_SIZE,
                limit: PAGE_SIZE,
            });
            setPosts(result.posts || []);
            setTotal(result.totalCount || 0);
        } catch (err) {
            console.error("게시글 목록 오류:", err);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [target, page]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

    const remove = async (post) => {
        if (!window.confirm(`"${post.title}" 글을 삭제할까요?`)) return;
        try {
            await deletePost(target, post.id);
            load();
        } catch (err) {
            alert(`삭제하지 못했습니다: ${err.message}`);
        }
    };

    return (
        <>
            <Hint>
                글을 올리면 그대로 <strong>{board.name}</strong> 목록에 나옵니다. 총 {total}건.
            </Hint>

            <Row>
                {targets.length > 1 &&
                    targets.map((tab) => (
                        <Button
                            key={tab.slug}
                            type="button"
                            $primary={tab.slug === target}
                            onClick={() => {
                                setTarget(tab.slug);
                                setPage(1);
                            }}
                        >
                            {tab.name}
                        </Button>
                    ))}
                <Button type="button" $primary onClick={() => navigate(`${path}/write`)}>
                    새 글 작성
                </Button>
                <Button type="button" onClick={() => navigate(path)}>
                    게시판 보기
                </Button>
            </Row>

            {loading ? (
                <Hint>불러오는 중…</Hint>
            ) : posts.length === 0 ? (
                <Hint>등록된 글이 없습니다.</Hint>
            ) : (
                <>
                    <Table>
                        <thead>
                            <tr>
                                <th style={{ width: "60px" }}>번호</th>
                                <th>제목</th>
                                <th style={{ width: "110px" }}>작성일</th>
                                <th style={{ width: "120px" }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.map((post) => (
                                <tr key={post.id}>
                                    <td>{post.displayNumber}</td>
                                    <td className="title">
                                        {post.isNotice && "[공지] "}
                                        {post.title}
                                    </td>
                                    <td>{post.createdAt}</td>
                                    <td className="actions">
                                        <Button
                                            type="button"
                                            onClick={() => navigate(`${path}/edit/${post.id}`)}
                                        >
                                            수정
                                        </Button>{" "}
                                        <Button type="button" onClick={() => remove(post)}>
                                            삭제
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>

                    {totalPages > 1 && (
                        <Pager>
                            <Button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                이전
                            </Button>
                            {page} / {totalPages}
                            <Button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                다음
                            </Button>
                        </Pager>
                    )}
                </>
            )}
        </>
    );
};

/* =========================================================================
 * 고정 페이지 항목 — 그 페이지에 걸리는 이미지 (여러 장)
 * ====================================================================== */

const ImagePanel = ({ board, sectionKey, path }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const base = useApi.defaults.baseURL || "";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await useApi.get(`/sections/${sectionKey}`);
            setImages(data.images || []);
        } catch (err) {
            console.error("섹션 이미지 목록 오류:", err);
            setImages([]);
        } finally {
            setLoading(false);
        }
    }, [sectionKey]);

    useEffect(() => {
        load();
    }, [load]);

    // 이미지는 파일명이 그대로라 브라우저가 옛 그림을 캐시한다. 시각을 붙여 새로 받는다.
    const srcOf = (image) => `${base.replace(/\/api\/?$/, "")}${image.url}?t=${Date.now()}`;

    const upload = async (fileList) => {
        const files = Array.from(fileList);
        if (!files.length) return;
        setBusy(true);
        try {
            const formData = new FormData();
            files.forEach((file) => formData.append("image", file));
            const { data } = await useApi_file.post(`/admin/section/${sectionKey}`, formData);
            if (data.result === "SUCCESS" || data.status === "SUCCESS") {
                await load();
            } else {
                alert(data.message || "이미지를 올리지 못했습니다.");
            }
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message)
                || "이미지를 올리지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (image) => {
        if (!window.confirm("이 이미지를 지울까요?")) return;
        setBusy(true);
        try {
            await useAuthApi.delete(`/admin/section/${sectionKey}/${image.name}`);
            await load();
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message)
                || "이미지를 지우지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Hint>
                이 항목은 <strong>게시글이 아니라 이미지로 만들어진 페이지</strong>입니다.
                여기 올린 이미지가 올린 순서대로 <strong>{board.name}</strong> 화면에 그려집니다.
                (글을 써도 이 페이지에는 나오지 않습니다)
            </Hint>

            <Row>
                <Button as="label" $primary style={{ cursor: busy ? "default" : "pointer" }}>
                    {busy ? "처리 중…" : "이미지 추가"}
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={busy}
                        style={{ display: "none" }}
                        onChange={(e) => {
                            upload(e.target.files);
                            e.target.value = "";
                        }}
                    />
                </Button>
                <Button type="button" onClick={() => window.open(path, "_blank")}>
                    페이지 보기
                </Button>
            </Row>

            {loading ? (
                <Hint>불러오는 중…</Hint>
            ) : images.length === 0 ? (
                <Hint>아직 올린 이미지가 없습니다.</Hint>
            ) : (
                <ImageGrid>
                    {images.map((image, index) => (
                        <ImageCard key={image.name}>
                            <img src={srcOf(image)} alt={`${board.name} ${index + 1}번째 이미지`} />
                            <figcaption>
                                <span>{index + 1}. {image.name}</span>
                                <button type="button" onClick={() => remove(image)} disabled={busy}>
                                    삭제
                                </button>
                            </figcaption>
                        </ImageCard>
                    ))}
                </ImageGrid>
            )}
        </>
    );
};

/* =========================================================================
 * 고정 페이지 항목 — 화면에 직접 짜 넣은 문구/링크 (텍스트 콘텐츠)
 * ====================================================================== */

/**
 * "대여" 안내처럼 화면 모양은 코드 그대로 두고, 안에 채워지는 문구와
 * 카드 링크만 관리자가 고칠 수 있게 한다. 저장하면 그 페이지가 곧바로
 * 새 문구로 바뀐다 (블록/카드 개수는 그대로, 안의 글자만 바뀐다).
 */
const ContentPanel = ({ board, contentKey, path }) => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchContent(contentKey);
            setContent(data);
        } catch (err) {
            console.error("콘텐츠 조회 오류:", err);
            setContent(null);
        } finally {
            setLoading(false);
        }
    }, [contentKey]);

    useEffect(() => {
        load();
    }, [load]);

    const updateBlock = (index, field, value) => {
        setContent((prev) => ({
            ...prev,
            blocks: prev.blocks.map((block, i) => (i === index ? { ...block, [field]: value } : block)),
        }));
    };

    const updateCard = (index, field, value) => {
        setContent((prev) => ({
            ...prev,
            cards: prev.cards.map((card, i) => (i === index ? { ...card, [field]: value } : card)),
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const saved = await updateContent(contentKey, content);
            setContent(saved);
            alert("저장했습니다.");
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message)
                || "저장하지 못했습니다.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Hint>
                이 항목은 <strong>게시글이 아니라 화면에 직접 짜 넣은 안내 문구</strong>입니다.
                화면 모양은 그대로 두고, 아래에서 고친 문구와 카드 링크만 바뀝니다.
            </Hint>

            <Row>
                <Button type="button" onClick={() => window.open(path, "_blank")}>
                    페이지 보기
                </Button>
            </Row>

            {loading ? (
                <Hint>불러오는 중…</Hint>
            ) : !content ? (
                <Hint>콘텐츠를 불러오지 못했습니다.</Hint>
            ) : (
                <ContentForm onSubmit={handleSave}>
                    <FieldRow>
                        <FieldLabel htmlFor={`${contentKey}-panelTitle`}>패널 제목</FieldLabel>
                        <TextInput
                            id={`${contentKey}-panelTitle`}
                            value={content.panelTitle}
                            maxLength={60}
                            onChange={(e) => setContent((prev) => ({ ...prev, panelTitle: e.target.value }))}
                        />
                    </FieldRow>

                    {content.blocks.map((block, index) => (
                        <FieldGroup key={index}>
                            <legend>안내 문단 {index + 1}</legend>
                            <FieldRow>
                                <FieldLabel htmlFor={`${contentKey}-block-${index}-heading`}>소제목</FieldLabel>
                                <TextInput
                                    id={`${contentKey}-block-${index}-heading`}
                                    value={block.heading}
                                    maxLength={60}
                                    onChange={(e) => updateBlock(index, "heading", e.target.value)}
                                />
                            </FieldRow>
                            <FieldRow>
                                <FieldLabel htmlFor={`${contentKey}-block-${index}-body`}>
                                    내용 (줄바꿈은 그대로 화면에 반영됩니다)
                                </FieldLabel>
                                <TextArea
                                    id={`${contentKey}-block-${index}-body`}
                                    value={block.body}
                                    maxLength={2000}
                                    onChange={(e) => updateBlock(index, "body", e.target.value)}
                                />
                            </FieldRow>
                        </FieldGroup>
                    ))}

                    {content.cards.map((card, index) => (
                        <FieldGroup key={index}>
                            <legend>바로가기 카드 {index + 1}</legend>
                            <TwoCol>
                                <FieldRow>
                                    <FieldLabel htmlFor={`${contentKey}-card-${index}-title`}>제목</FieldLabel>
                                    <TextInput
                                        id={`${contentKey}-card-${index}-title`}
                                        value={card.title}
                                        maxLength={60}
                                        onChange={(e) => updateCard(index, "title", e.target.value)}
                                    />
                                </FieldRow>
                                <FieldRow>
                                    <FieldLabel htmlFor={`${contentKey}-card-${index}-to`}>
                                        연결 링크 (사이트 안 경로는 /로 시작, 외부 주소는 http(s)://로 시작 — 외부는 새 탭으로 열립니다)
                                    </FieldLabel>
                                    <TextInput
                                        id={`${contentKey}-card-${index}-to`}
                                        value={card.to}
                                        maxLength={300}
                                        placeholder="/info/rental/list 또는 https://example.com"
                                        onChange={(e) => updateCard(index, "to", e.target.value)}
                                    />
                                </FieldRow>
                            </TwoCol>
                        </FieldGroup>
                    ))}

                    <Row style={{ marginBottom: 0 }}>
                        <Button type="submit" $primary disabled={saving}>
                            {saving ? "저장 중…" : "저장"}
                        </Button>
                        <Button type="button" onClick={load} disabled={saving}>
                            되돌리기
                        </Button>
                    </Row>
                </ContentForm>
            )}
        </>
    );
};

/* =========================================================================
 * 화면
 * ====================================================================== */

const ManageContent = () => {
    const isAdmin = useAdminGuard();
    const [openKey, setOpenKey] = useState(null);
    // 섹션 이미지/고정 콘텐츠는 ADMIN 전용이다 (서버도 @admin_only 로 거절한다).
    // 매니저는 이 페이지에서 게시판 항목만 다룰 수 있다.
    const canManagePages = isAdminOnlyUser();

    const items = useMemo(
        () =>
            MENUS.map((menu) => ({
                ...menu,
                boards: menu.boards.map((board) => ({
                    ...board,
                    key: `${menu.key}/${board.slug}`,
                    menuKey: menu.key,
                    sectionKey: PAGE_SECTIONS[board.slug] || null,
                    contentKey: PAGE_CONTENTS[board.slug] || null,
                    path: boardPath(menu.key, board.slug),
                })),
            })),
        []
    );

    if (isAdmin === null) return <AdminMessage>확인 중…</AdminMessage>;
    if (!isAdmin) return null;

    return (
        <AdminWrapper>
            <AdminTitle>콘텐츠 관리</AdminTitle>
            <AdminDescription>
                메뉴에 있는 항목을 그대로 펼쳐 놓았습니다. 항목을 누르면 그 항목을 실제로 바꾸는
                도구가 열립니다 — 게시판은 글 관리, 고정 페이지는 이미지 관리입니다.
            </AdminDescription>

            {items.map((menu) => (
                <MenuBlock key={menu.key}>
                    <MenuTitle>{menu.title}</MenuTitle>

                    {menu.boards.map((board) => {
                        const isPage = board.type === "page";
                        const open = openKey === board.key;
                        return (
                            <Item key={board.key}>
                                <ItemHead
                                    type="button"
                                    $open={open}
                                    onClick={() => setOpenKey(open ? null : board.key)}
                                    aria-expanded={open}
                                >
                                    <strong>{board.name}</strong>
                                    <Kind $page={isPage}>{isPage ? "이미지 페이지" : "게시판"}</Kind>
                                    <Caret>{open ? "닫기 ▲" : "열기 ▼"}</Caret>
                                </ItemHead>

                                {open && (
                                    <ItemBody>
                                        {isPage ? (
                                            board.sectionKey ? (
                                                canManagePages ? (
                                                    <ImagePanel
                                                        board={board}
                                                        sectionKey={board.sectionKey}
                                                        path={board.path}
                                                    />
                                                ) : (
                                                    <Hint>이미지 관리는 관리자만 가능합니다.</Hint>
                                                )
                                            ) : board.contentKey ? (
                                                <>
                                                    {canManagePages ? (
                                                        <ContentPanel
                                                            board={board}
                                                            contentKey={board.contentKey}
                                                            path={board.path}
                                                        />
                                                    ) : (
                                                        <Hint>콘텐츠 관리는 관리자만 가능합니다.</Hint>
                                                    )}
                                                    {board.hasArchive && (
                                                        <>
                                                            <Hint style={{ marginTop: 20 }}>
                                                                이관된 글 목록은 아래에서 관리합니다. 글을
                                                                올려도 위 화면에는 나오지 않습니다 (화면은
                                                                위 문구만 그립니다).
                                                            </Hint>
                                                            <BoardPanel menuKey={board.menuKey} board={board} />
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Hint>
                                                        이 페이지는 화면에 직접 짜 넣은 안내라서 여기서
                                                        고칠 항목이 없습니다.
                                                        {board.hasArchive &&
                                                            " 이관된 글 목록은 아래에서 관리합니다."}
                                                    </Hint>
                                                    {board.hasArchive && (
                                                        <BoardPanel menuKey={board.menuKey} board={board} />
                                                    )}
                                                </>
                                            )
                                        ) : (
                                            <BoardPanel menuKey={board.menuKey} board={board} />
                                        )}
                                    </ItemBody>
                                )}
                            </Item>
                        );
                    })}
                </MenuBlock>
            ))}

            <OrphanNote>
                <strong>참고</strong> — 서버에는 {ORPHAN_SECTIONS.map((s) => s.name).join(" · ")} 섹션
                이미지도 남아 있지만, 새 메뉴 구조에서 이를 보여 줄 공개 페이지가 없어 관리 대상에서
                뺐습니다. 해당 페이지를 다시 만들면 여기에도 나타나게 하겠습니다.
            </OrphanNote>
        </AdminWrapper>
    );
};

export default ManageContent;
