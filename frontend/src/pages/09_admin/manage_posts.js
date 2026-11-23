/**
 * 09_admin/manage_posts.js
 * ========================
 * 게시글 관리. 게시판을 골라 목록을 보고 작성/수정/삭제로 이동한다.
 *
 * 글 작성·수정 폼은 기존 BoardFormPage 를 그대로 쓰므로 여기서는 이동만 시킨다.
 * 게시판 목록은 서버(/api/boards)에서 받아 오므로 게시판이 늘어도 고칠 필요가 없다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import { findBoard } from "../../config/boards";
import { deletePost, fetchBoardTree, fetchPosts } from "../../services/boardService";
import { colors, font } from "../../styles/theme";
import {
    AdminDescription, AdminMessage, AdminTitle, AdminWrapper, useAdminGuard,
} from "./adminCommon";

const Toolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
`;

const Select = styled.select`
    padding: 8px 10px;
    font-family: ${font.family};
    font-size: 14px;
    border: 1px solid ${colors.border};
    border-radius: 4px;
    min-width: 240px;
`;

const Button = styled.button`
    padding: 8px 14px;
    font-family: ${font.family};
    font-size: 14px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid ${colors.border};
    background: ${(props) => (props.$primary ? colors.textStrong : colors.white)};
    color: ${(props) => (props.$primary ? colors.white : colors.text)};

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;

    th,
    td {
        padding: 10px 12px;
        border-bottom: 1px solid ${colors.divider};
        text-align: left;
    }

    th {
        background: ${colors.tableHeadBg};
        color: ${colors.textStrong};
        font-weight: 600;
    }
`;

const TitleCell = styled.td`
    max-width: 420px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const Actions = styled.div`
    display: flex;
    gap: 6px;
`;

const Pager = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 18px;
    font-size: 14px;
    color: ${colors.textMuted};
`;

const PAGE_SIZE = 20;

/**
 * 게시판 slug -> 화면 경로 앞부분.
 * 라우터가 /:menuKey/:board/... 구조라 메뉴 키가 필요하다.
 * config 에 없는 slug(예: 서버에만 있는 새 게시판)는 학생 자치로 보낸다.
 */
const basePathFor = (slug) => {
    const info = findBoard(slug);
    return `/${info ? info.menuKey : "autonomy"}/${slug}`;
};

const ManagePosts = () => {
    const isAdmin = useAdminGuard();
    const navigate = useNavigate();

    const [boards, setBoards] = useState([]);
    const [slug, setSlug] = useState("");
    const [page, setPage] = useState(1);
    const [posts, setPosts] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // 게시판 목록 (글이 있는 게시판이 위로 오도록 두지 않고 서버 순서를 그대로 쓴다)
    useEffect(() => {
        if (!isAdmin) return;
        fetchBoardTree()
            .then((tree) => {
                const flat = tree.flatMap((menu) =>
                    (menu.boards || []).map((board) => ({ ...board, menuName: menu.name }))
                );
                setBoards(flat);
                if (flat.length) setSlug((prev) => prev || flat[0].slug);
            })
            .catch((err) => setError(err.message));
    }, [isAdmin]);

    const load = useCallback(async () => {
        if (!slug) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchPosts({
                board: slug,
                offset: (page - 1) * PAGE_SIZE,
                limit: PAGE_SIZE,
            });
            setPosts(result.posts);
            setTotalCount(result.totalCount);
        } catch (err) {
            setError(err.message);
            setPosts([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    }, [slug, page]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
    const current = useMemo(
        () => boards.find((board) => board.slug === slug) || null,
        [boards, slug]
    );

    const handleDelete = async (post) => {
        if (!window.confirm(`"${post.title}" 게시글을 삭제할까요? 되돌릴 수 없습니다.`)) return;
        try {
            await deletePost(slug, post.id);
            // 마지막 항목을 지웠으면 앞 페이지로 물러난다
            if (posts.length === 1 && page > 1) setPage(page - 1);
            else load();
        } catch (err) {
            alert(`삭제 실패: ${err.message}`);
        }
    };

    if (isAdmin === null) return <AdminMessage>확인 중입니다...</AdminMessage>;
    if (!isAdmin) return null;

    return (
        <AdminWrapper>
            <AdminTitle>게시글 관리</AdminTitle>
            <AdminDescription>
                게시판을 고르면 글 목록이 나옵니다. 작성·수정 화면은 일반 게시판과 같습니다.
            </AdminDescription>

            <Toolbar>
                <Select
                    value={slug}
                    onChange={(e) => {
                        setSlug(e.target.value);
                        setPage(1);
                    }}
                >
                    {boards.map((board) => (
                        <option key={board.slug} value={board.slug}>
                            {board.menuName} · {board.name} ({board.postCount ?? 0})
                        </option>
                    ))}
                </Select>
                <Button
                    $primary
                    type="button"
                    disabled={!slug}
                    onClick={() => navigate(`${basePathFor(slug)}/write`)}
                >
                    새 글 작성
                </Button>
                <Button type="button" onClick={load} disabled={isLoading}>
                    새로고침
                </Button>
            </Toolbar>

            {error && <AdminMessage>{error}</AdminMessage>}

            {isLoading ? (
                <AdminMessage>불러오는 중입니다...</AdminMessage>
            ) : !posts.length ? (
                <AdminMessage>
                    {current ? `'${current.name}' 게시판에 글이 없습니다.` : "게시판을 선택하세요."}
                </AdminMessage>
            ) : (
                <>
                    <Table>
                        <thead>
                            <tr>
                                <th style={{ width: 70 }}>번호</th>
                                <th>제목</th>
                                <th style={{ width: 110 }}>작성자</th>
                                <th style={{ width: 110 }}>작성일</th>
                                <th style={{ width: 70 }}>조회</th>
                                <th style={{ width: 150 }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.map((post) => (
                                <tr key={post.id}>
                                    <td>{post.displayNumber}</td>
                                    <TitleCell title={post.title}>
                                        {post.isNotice ? "[공지] " : ""}
                                        {post.title}
                                    </TitleCell>
                                    <td>{post.author}</td>
                                    <td>{post.createdAt}</td>
                                    <td>{post.views}</td>
                                    <td>
                                        <Actions>
                                            <Button
                                                type="button"
                                                onClick={() => navigate(`${basePathFor(slug)}/detail/${post.id}`)}
                                            >
                                                보기
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() =>
                                                    navigate(`${basePathFor(slug)}/edit/${post.id}`)
                                                }
                                            >
                                                수정
                                            </Button>
                                            <Button type="button" onClick={() => handleDelete(post)}>
                                                삭제
                                            </Button>
                                        </Actions>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>

                    <Pager>
                        <Button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            이전
                        </Button>
                        <span>
                            {page} / {totalPages} (전체 {totalCount}건)
                        </span>
                        <Button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            다음
                        </Button>
                    </Pager>
                </>
            )}
        </AdminWrapper>
    );
};

export default ManagePosts;
