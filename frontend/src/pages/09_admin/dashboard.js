/**
 * 09_admin/dashboard.js
 * =====================
 * 관리자 홈. /admin 진입 시 보이는 화면.
 *
 * 승인 대기 인원과 게시판별 게시글 수를 요약하고, 각 관리 기능으로 보낸다.
 * 숫자는 기존 API 를 그대로 쓴다 (새 엔드포인트를 만들지 않는다).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { fetchBoardTree } from "../../services/boardService";
import { colors, font } from "../../styles/theme";
import {
    AdminDescription, AdminMessage, AdminTitle, AdminWrapper, isAdminOnlyUser, useAdminGuard,
} from "./adminCommon";

const StatRow = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 14px;
    margin-bottom: 32px;
`;

const StatCard = styled.div`
    background: ${colors.cardBg};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: 18px 20px;
`;

const StatLabel = styled.div`
    font-size: 13px;
    color: ${colors.textMuted};
    margin-bottom: 8px;
`;

const StatValue = styled.div`
    font-size: 28px;
    font-weight: 700;
    color: ${colors.textStrong};
`;

const SectionTitle = styled.h3`
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 700;
    color: ${colors.textStrong};
`;

const LinkGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 14px;
    margin-bottom: 36px;
`;

const LinkCard = styled(Link)`
    display: block;
    background: ${colors.cardBg};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: 18px 20px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;

    &:hover {
        border-color: ${colors.borderStrong};
    }
`;

const LinkName = styled.div`
    font-size: ${font.size.md};
    font-weight: 700;
    color: ${colors.textStrong};
    margin-bottom: 6px;
`;

const LinkHint = styled.div`
    font-size: 13px;
    color: ${colors.textMuted};
    line-height: 1.5;
`;

const BoardTable = styled.table`
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

    td:last-child,
    th:last-child {
        text-align: right;
    }
`;

const MENU_LINKS = [
    {
        to: "/admin/content",
        name: "콘텐츠 관리",
        hint: "메뉴 항목마다 글 또는 이미지를 관리합니다. 게시판은 글, 고정 페이지는 이미지입니다.",
    },
    {
        to: "/admin/modify-schedule",
        name: "일정표 변경",
        hint: "캘린더에 노출되는 일정을 추가하거나 삭제합니다.",
    },
];

// 매니저는 게시판 글 작성 + 캘린더 수정만 할 수 있어, 권한 관리는 ADMIN 에게만 보여 준다.
const ADMIN_ONLY_MENU_LINKS = [
    {
        to: "/admin/roles",
        name: "매니저 권한 관리",
        hint: "로그인ID/이름으로 사용자를 찾아 매니저 권한을 부여하거나 해제합니다.",
    },
];

const Dashboard = () => {
    const isAdmin = useAdminGuard();

    const [boards, setBoards] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const tree = await fetchBoardTree();
            setBoards(
                tree.flatMap((menu) =>
                    (menu.boards || []).map((board) => ({
                        ...board,
                        menuName: menu.name,
                    }))
                )
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) load();
    }, [isAdmin, load]);

    if (isAdmin === null) return <AdminMessage>확인 중입니다...</AdminMessage>;
    if (!isAdmin) return null;

    const totalPosts = boards.reduce((sum, board) => sum + (board.postCount || 0), 0);
    const menuLinks = isAdminOnlyUser() ? [...MENU_LINKS, ...ADMIN_ONLY_MENU_LINKS] : MENU_LINKS;

    return (
        <AdminWrapper>
            <AdminTitle>관리자 홈</AdminTitle>
            <AdminDescription>사이트 운영에 필요한 기능을 한 곳에 모았습니다.</AdminDescription>

            {error && <AdminMessage>{error}</AdminMessage>}

            <StatRow>
                <StatCard>
                    <StatLabel>전체 게시글</StatLabel>
                    <StatValue>{isLoading ? "…" : totalPosts}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>게시판</StatLabel>
                    <StatValue>{isLoading ? "…" : boards.length}</StatValue>
                </StatCard>
            </StatRow>

            <SectionTitle>관리 기능</SectionTitle>
            <LinkGrid>
                {menuLinks.map((item) => (
                    <LinkCard key={item.to} to={item.to}>
                        <LinkName>{item.name}</LinkName>
                        <LinkHint>{item.hint}</LinkHint>
                    </LinkCard>
                ))}
            </LinkGrid>

            <SectionTitle>게시판별 게시글 수</SectionTitle>
            {isLoading ? (
                <AdminMessage>불러오는 중입니다...</AdminMessage>
            ) : (
                <BoardTable>
                    <thead>
                        <tr>
                            <th>메뉴</th>
                            <th>게시판</th>
                            <th>게시글</th>
                        </tr>
                    </thead>
                    <tbody>
                        {boards.map((board) => (
                            <tr key={board.slug || board.id}>
                                <td>{board.menuName}</td>
                                <td>{board.name}</td>
                                <td>{board.postCount ?? 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </BoardTable>
            )}
        </AdminWrapper>
    );
};

export default Dashboard;
