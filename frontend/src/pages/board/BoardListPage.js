/**
 * BoardListPage
 * =============
 * 모든 게시판의 목록 페이지. 라우트의 :board slug 로 게시판을 정하고,
 * config 의 view 값에 따라 표 / 카드 / 갤러리 / FAQ 아코디언으로 그린다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import styled from "styled-components";

import PageHeader from "../../components/board/PageHeader";
import BoardSearch from "../../components/board/BoardSearch";
import Pagination from "../../components/board/Pagination";
import BoardTableView from "../../components/board/BoardTableView";
import BoardCardView from "../../components/board/BoardCardView";
import BoardGalleryView from "../../components/board/BoardGalleryView";
import BoardAccordionView from "../../components/board/BoardAccordionView";
import { findBoard } from "../../config/boards";
import { fetchPost, fetchPosts } from "../../services/boardService";
import { colors, font } from "../../styles/theme";
import { isAdminUser, watchAuthChange } from "../../utils/auth";

const Message = styled.p`
    padding: 70px 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.textMuted};
`;

const ActionRow = styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 14px;
`;

const WriteButton = styled(Link)`
    display: inline-block;
    padding: 9px 18px;
    border-radius: 4px;
    background: ${colors.textStrong};
    color: ${colors.white};
    font-family: ${font.family};
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;

    &:hover {
        opacity: 0.9;
    }
`;

const TabBar = styled.div`
    display: flex;
    gap: 4px;
    margin: 0 0 18px;
    border-bottom: 1px solid ${colors.border};
`;

const Tab = styled.button`
    padding: 11px 22px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${(props) => (props.$active ? 700 : 400)};
    color: ${(props) => (props.$active ? colors.textStrong : colors.textMuted)};
    border-bottom: 2px solid
        ${(props) => (props.$active ? colors.borderStrong : "transparent")};
    margin-bottom: -1px;
    transition: color 0.15s;

    &:hover {
        color: ${colors.textStrong};
    }
`;

// view 별 한 페이지에 보여줄 개수 (시안 기준)
const PAGE_SIZE = {
    table: 9,
    card: 9,
    gallery: 5,
    accordion: 8,
};

/** 다음 목록을 받아오는 동안만 살짝 흐려진다. 자리는 그대로 지킨다. */
const ListArea = styled.div`
    opacity: ${(props) => (props.$dim ? 0.45 : 1)};
    pointer-events: ${(props) => (props.$dim ? "none" : "auto")};
    transition: opacity 0.18s ease;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const BoardListPage = ({ slug: slugProp }) => {
    const params = useParams();
    const slug = slugProp || params.board;
    // findBoard 는 호출마다 새 객체를 만든다. 메모이즈하지 않으면 의존성 배열이
    // 렌더마다 바뀌어 effect 가 무한 반복된다.
    const boardInfo = useMemo(() => findBoard(slug), [slug]);
    const view = boardInfo?.view || "table";
    const pageSize = PAGE_SIZE[view] || 10;

    // 탭 게시판(회칙 및 세칙)은 DB 상 3개 게시판이라 실제 조회 대상이 탭마다 다르다.
    const tabs = boardInfo?.tabs || null;
    const [activeTab, setActiveTab] = useState(0);
    const apiBoard = tabs ? tabs[activeTab].slug : slug;
    // 상세 페이지 URL 에는 실제 게시판 slug 를 실어야 한다.
    const basePath = boardInfo
        ? `/${boardInfo.menuKey}/${apiBoard}`
        : boardInfo?.path;

    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    // 한 번이라도 목록을 받아 왔는지. 페이지를 넘길 때 화면을 비우지 않기 위해 쓴다.
    const [hasLoaded, setHasLoaded] = useState(false);
    const [posts, setPosts] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    // 다른 탭에서 로그아웃하면 버튼도 같이 사라지도록 storage 이벤트를 듣는다
    const [isAdmin, setIsAdmin] = useState(isAdminUser);

    useEffect(() => watchAuthChange(() => setIsAdmin(isAdminUser())), []);

    const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

    const load = useCallback(async () => {
        if (!boardInfo || (boardInfo.type !== "board" && !boardInfo.hasArchive)) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchPosts({
                board: apiBoard,
                offset: (page - 1) * pageSize,
                limit: pageSize,
                searchTerm,
            });
            setPosts(result.posts);
            setTotalCount(result.totalCount);

            // FAQ 는 목록에 답변이 없으므로 상세를 함께 받아 아코디언에 채운다.
            if (view === "accordion" && result.posts.length) {
                const details = await Promise.all(
                    result.posts.map((post) =>
                        fetchPost(apiBoard, post.id)
                            .then((detail) => ({ ...post, content: detail.content }))
                            .catch(() => post)
                    )
                );
                setPosts(details);
            }

            // 갤러리 뷰(공약 이행 보고)는 "가로형으로 보기" 여부와 첨부 이미지가
            // 목록 API 에 없으므로(썸네일 1장만 옴) 상세를 함께 받아 채운다.
            if (view === "gallery" && result.posts.length) {
                const details = await Promise.all(
                    result.posts.map((post) =>
                        fetchPost(apiBoard, post.id)
                            .then((detail) => ({
                                ...post,
                                content: detail.content,
                                attachments: detail.attachments || [],
                            }))
                            .catch(() => post)
                    )
                );
                setPosts(details);
            }
        } catch (err) {
            console.error("게시글 목록 오류:", err);
            setError(err.message);
            setPosts([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    }, [boardInfo, apiBoard, page, pageSize, searchTerm, view]);

    useEffect(() => {
        load();
    }, [load]);

    // 게시판이 바뀌면 페이지/검색/탭 상태를 초기화한다
    useEffect(() => {
        setPage(1);
        setHasLoaded(false);
        setSearchTerm("");
        setActiveTab(0);
    }, [slug]);

    if (!boardInfo) {
        return <Message>존재하지 않는 게시판입니다: {slug}</Message>;
    }

    const handlePageChange = (nextPage) => {
        // 스크롤을 건드리지 않는다. 목록만 갈리므로 보던 자리에 그대로 두는 편이
        // 자연스럽고, 맨 위로 올리면 페이지가 새로 뜬 것처럼 느껴진다.
        setPage(nextPage);
    };

    const handleSearch = (term) => {
        setSearchTerm(term);
        setPage(1);
    };

    const renderList = () => {
        // 처음 들어왔을 때만 안내를 띄운다. 페이지를 넘길 때는 앞 목록을 그대로
        // 두고 살짝 흐리게만 해서, 화면이 비었다가 다시 그려지는 느낌을 없앤다.
        if (isLoading && !hasLoaded) return <Message>불러오는 중입니다...</Message>;
        if (error) return <Message>{error}</Message>;

        switch (view) {
            case "card":
                return <BoardCardView posts={posts} basePath={basePath} />;
            case "gallery":
                return <BoardGalleryView posts={posts} basePath={basePath} />;
            case "accordion":
                return <BoardAccordionView posts={posts} />;
            default:
                return (
                    <BoardTableView
                        posts={posts}
                        basePath={basePath}
                        requiresLogin={boardInfo.requiresLogin}
                    />
                );
        }
    };

    return (
        <>
            <PageHeader
                title={boardInfo.name}
                right={
                    boardInfo.hideSearch ? null : (
                        <BoardSearch onSearch={handleSearch} />
                    )
                }
            />
            {tabs && (
                <TabBar role="tablist">
                    {tabs.map((tab, index) => (
                        <Tab
                            key={tab.slug}
                            type="button"
                            role="tab"
                            aria-selected={index === activeTab}
                            $active={index === activeTab}
                            onClick={() => {
                                setActiveTab(index);
                                setPage(1);
                            }}
                        >
                            {tab.name}
                        </Tab>
                    ))}
                </TabBar>
            )}
            {isAdmin && (
                <ActionRow>
                    <WriteButton to={`${basePath}/write`}>글 작성</WriteButton>
                </ActionRow>
            )}
            <ListArea $dim={isLoading && hasLoaded}>{renderList()}</ListArea>
            {/* 로딩 중에도 그대로 둔다. 사라졌다 나타나면 눌린 번호가 튀어 보인다. */}
            {!error && totalCount > pageSize && (
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
            )}
        </>
    );
};

export default BoardListPage;
