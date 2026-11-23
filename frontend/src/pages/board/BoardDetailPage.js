/**
 * BoardDetailPage
 * ===============
 * 게시글 상세 (figma 화면/회의록 세부 페이지.png 기준).
 *
 *   제목 + 브레드크럼 + 네이비 선
 *   글 제목 / 작성일·조회수
 *   전체 다운로드 + 첨부파일 링크
 *   본문
 *   이전글 / 다음글 카드
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";

import PageHeader from "../../components/board/PageHeader";
import { findBoard } from "../../config/boards";
import { isAdminUser } from "../../utils/auth";
import {
    deletePost,
    downloadAttachment,
    fetchPost,
    fetchPosts,
    resolveContentApiUrls,
} from "../../services/boardService";
import { stripHorizontalMarker } from "../../utils/horizontalGallery";
import { colors, font, media, radius } from "../../styles/theme";

const Message = styled.p`
    padding: 70px 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.textMuted};
`;

const Title = styled.h2`
    margin: 0 0 12px;
    font-family: ${font.family};
    font-size: ${font.size.h3};
    font-weight: ${font.weight.bold};
    color: ${colors.text};
    line-height: 1.45;
    word-break: keep-all;
`;

const Meta = styled.div`
    display: flex;
    gap: 26px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    padding-bottom: 22px;
    border-bottom: 1px solid ${colors.divider};
`;

const Attachments = styled.section`
    padding: 22px 0 26px;
    border-bottom: 1px solid ${colors.divider};
`;

const DownloadAll = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0 0 14px;
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    color: ${colors.textStrong};

    &:hover {
        color: ${colors.navy};
    }
`;

const FileList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const FileButton = styled.button`
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.blue};
    text-decoration: underline;
    text-align: left;

    &:hover {
        color: ${colors.navy};
    }
`;

const Body = styled.article`
    min-height: 220px;
    padding: 34px 2px 60px;
    font-family: ${font.family};
    font-size: ${font.size.md};
    line-height: 1.9;
    color: ${colors.text};
    word-break: break-word;

    img {
        max-width: 100%;
        height: auto;
    }

    a {
        color: ${colors.blue};
        text-decoration: underline;
    }

    /* 전역 리셋이 b/strong 의 굵기와 목록의 점을 지워 버린다.
       본문 안에서는 되살려야 관리자가 넣은 서식이 그대로 보인다. */
    b,
    strong {
        font-weight: ${font.weight.bold};
    }

    ul,
    ol {
        margin: 10px 0;
        padding-left: 22px;
        list-style: revert;
    }

    li {
        list-style: inherit;
    }
`;

const NavPair = styled.nav`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 20px;

    ${media.mobile} {
        grid-template-columns: 1fr;
        gap: 12px;
    }
`;

const NavCard = styled(Link)`
    background: ${colors.tableHeadBg};
    border-radius: ${radius.md};
    padding: 22px 18px;
    text-align: center;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: background 0.15s ease;

    &:hover {
        background: #e9ebf3;
    }
`;

const NavCardEmpty = styled.div`
    background: ${colors.tableHeadBg};
    border-radius: ${radius.md};
    padding: 22px 18px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
    opacity: 0.6;
`;

const NavLabel = styled.span`
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.semibold};
    color: ${colors.textStrong};
`;

const NavTitle = styled.span`
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const NavDate = styled.span`
    font-family: ${font.family};
    font-size: ${font.size.xs};
    color: ${colors.textLight};
`;

const AdminBar = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 26px;
`;

const AdminButton = styled.button`
    padding: 9px 20px;
    width: fit-content;
    border-radius: ${radius.sm};
    border: 1px solid ${(props) => (props.$danger ? "#D14343" : colors.navy)};
    background: ${(props) => (props.$danger ? colors.white : colors.navy)};
    color: ${(props) => (props.$danger ? "#D14343" : colors.onNavy)};
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    cursor: pointer;
`;

const DownloadIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.5v10.5m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.5 17.5v1.2c0 .9.7 1.6 1.6 1.6h11.8c.9 0 1.6-.7 1.6-1.6v-1.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
);

const saveBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
};

const BoardDetailPage = () => {
    const { board: slug, id } = useParams();
    const navigate = useNavigate();
    // findBoard 는 호출마다 새 객체를 만든다. 메모이즈하지 않으면 의존성 배열이
    // 렌더마다 바뀌어 effect 가 무한 반복된다.
    const boardInfo = useMemo(() => findBoard(slug), [slug]);

    const [post, setPost] = useState(null);
    const [siblings, setSiblings] = useState({ prev: null, next: null });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdmin, setIsAdmin] = useState(isAdminUser);

    useEffect(() => {
        const sync = () => setIsAdmin(isAdminUser());
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchPost(slug, id);
                if (cancelled) return;
                setPost(data);

                // 이전글/다음글: 목록에서 현재 글의 위치를 찾아 앞뒤를 집는다.
                try {
                    const { posts } = await fetchPosts({ board: slug, offset: 0, limit: 100 });
                    const index = posts.findIndex((item) => String(item.id) === String(id));
                    if (!cancelled && index !== -1) {
                        setSiblings({
                            prev: posts[index + 1] || null, // 목록은 최신순이라 아래쪽이 이전글
                            next: posts[index - 1] || null,
                        });
                    }
                } catch {
                    /* 이전글/다음글은 없어도 본문 표시에 지장 없음 */
                }
            } catch (err) {
                console.error("게시글 조회 오류:", err);
                if (cancelled) return;
                // 목록에서 클릭할 때는 BoardTableView 가 먼저 막지만, 즐겨찾기/직접
                // URL 접근처럼 그걸 거치지 않은 경로는 서버 응답으로 여기서 잡힌다.
                if (err.errorCode === "login_required") {
                    alert(err.message || "로그인이 필요합니다.");
                    navigate(boardInfo ? boardInfo.path : "/home", { replace: true });
                    return;
                }
                setError(err.message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [slug, id]);

    if (!boardInfo) return <Message>존재하지 않는 게시판입니다: {slug}</Message>;
    if (isLoading) return <Message>불러오는 중입니다...</Message>;
    if (error || !post) return <Message>{error || "게시글을 찾을 수 없습니다."}</Message>;

    const attachments = post.attachments || [];

    const handleDownload = async (file) => {
        try {
            const blob = await downloadAttachment(file.name, post.id);
            saveBlob(blob, file.name);
        } catch (err) {
            alert(`첨부파일을 받지 못했습니다: ${err.message}`);
        }
    };

    const handleDownloadAll = async () => {
        for (const file of attachments) {
            // eslint-disable-next-line no-await-in-loop
            await handleDownload(file);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;
        try {
            await deletePost(slug, id);
            alert("게시글이 삭제되었습니다.");
            navigate(boardInfo.path);
        } catch (err) {
            alert(`삭제 실패: ${err.message}`);
        }
    };

    return (
        <>
            <PageHeader
                title={boardInfo.name}
                crumbs={[
                    { label: "Home", to: "/home" },
                    { label: boardInfo.menuTitle, to: boardInfo.path },
                    { label: boardInfo.name },
                ]}
            />

            <Title>{post.title}</Title>
            <Meta>
                <span>작성일: {post.createdAt}</span>
                <span>조회수: {post.views}</span>
            </Meta>

            {attachments.length > 0 && (
                <Attachments>
                    <DownloadAll type="button" onClick={handleDownloadAll}>
                        <DownloadIcon />
                        전체 다운로드
                    </DownloadAll>
                    <FileList>
                        {attachments.map((file) => (
                            <li key={file.id}>
                                <FileButton type="button" onClick={() => handleDownload(file)}>
                                    {file.name}
                                </FileButton>
                            </li>
                        ))}
                    </FileList>
                </Attachments>
            )}

            <Body>
                {post.content ? (
                    <div
                        dangerouslySetInnerHTML={{
                            __html: resolveContentApiUrls(stripHorizontalMarker(post.content)),
                        }}
                    />
                ) : (
                    <p style={{ color: colors.textLight }}>본문 내용이 없습니다.</p>
                )}
            </Body>

            <NavPair aria-label="이전글 다음글">
                {siblings.prev ? (
                    <NavCard to={`${boardInfo.path}/detail/${siblings.prev.id}`}>
                        <NavLabel>◀ 이전글</NavLabel>
                        <NavTitle>{siblings.prev.title}</NavTitle>
                        <NavDate>{siblings.prev.createdAt}</NavDate>
                    </NavCard>
                ) : (
                    <NavCardEmpty>
                        <NavLabel>◀ 이전글</NavLabel>
                        <NavTitle>이전 게시글이 없습니다</NavTitle>
                    </NavCardEmpty>
                )}
                {siblings.next ? (
                    <NavCard to={`${boardInfo.path}/detail/${siblings.next.id}`}>
                        <NavLabel>다음글 ▶</NavLabel>
                        <NavTitle>{siblings.next.title}</NavTitle>
                        <NavDate>{siblings.next.createdAt}</NavDate>
                    </NavCard>
                ) : (
                    <NavCardEmpty>
                        <NavLabel>다음글 ▶</NavLabel>
                        <NavTitle>다음 게시글이 없습니다</NavTitle>
                    </NavCardEmpty>
                )}
            </NavPair>

            {isAdmin && (
                <AdminBar>
                    <AdminButton type="button" onClick={() => navigate(`${boardInfo.path}/edit/${id}`)}>
                        수정
                    </AdminButton>
                    <AdminButton type="button" $danger onClick={handleDelete}>
                        삭제
                    </AdminButton>
                </AdminBar>
            )}
        </>
    );
};

export default BoardDetailPage;
