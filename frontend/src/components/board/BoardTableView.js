/**
 * BoardTableView
 * ==============
 * 표 형태 목록: 번호 / 제목 / 등록일 / 조회수
 * (회의록, 회칙 및 세칙, 회계 자료, 대관)
 */

import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { colors, font, media, radius, clampW, clampH } from "../../styles/theme";
import { isLoggedIn } from "../../utils/auth";

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    /* 너비를 고정해야 colgroup 폭이 실제로 지켜지고, 제목 칸의
       overflow: ellipsis(TitleLink span) 도 이 레이아웃이 있어야 동작한다. */
    table-layout: fixed;
    font-family: ${font.family};

    /* 좁아지면 뒤 칸부터 숨긴다 (우선순위: 제목 > 번호 > 등록일 > 조회수).
       숨긴 칸의 폭은 colgroup 의 제목 칸(폭 미지정)이 그대로 흡수한다. */
    ${media.tablet} {
        col:nth-child(4),
        th:nth-child(4),
        td:nth-child(4) {
            display: none;
        }
    }

    ${media.mobile} {
        col:nth-child(3),
        th:nth-child(3),
        td:nth-child(3) {
            display: none;
        }
    }
`;

const Th = styled.th`
    padding: ${clampH(15)} ${clampW(10)};
    background: ${colors.tableHeadBg};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    color: ${colors.textMuted};
    text-align: ${(props) => props.$align || "center"};

    &:first-child {
        border-radius: ${radius.sm} 0 0 ${radius.sm};
    }
    &:last-child {
        border-radius: 0 ${radius.sm} ${radius.sm} 0;
    }
`;

const Tr = styled.tr`
    border-bottom: 1px solid ${colors.divider};

    &:hover td {
        background: rgba(21, 31, 82, 0.02);
    }
`;

const Td = styled.td`
    padding: ${clampH(20)} ${clampW(10)};
    font-size: ${font.size.base};
    color: ${(props) => (props.$muted ? colors.textMuted : colors.text)};
    text-align: ${(props) => props.$align || "center"};
    vertical-align: middle;
`;

const TitleCell = styled(Td)`
    text-align: left;
    max-width: 0;
`;

const TitleLink = styled(Link)`
    display: inline-flex;
    align-items: center;
    gap: ${clampW(8)};
    max-width: 100%;
    color: ${colors.text};
    text-decoration: none;
    font-weight: ${(props) => (props.$notice ? font.weight.bold : font.weight.regular)};

    &:hover span {
        text-decoration: underline;
    }

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const NoticeBadge = styled.em`
    flex: 0 0 auto;
    font-style: normal;
    font-size: ${font.size.xs};
    font-weight: ${font.weight.bold};
    color: ${colors.white};
    background: ${colors.navy};
    border-radius: ${radius.sm};
    padding: 2px ${clampW(8)};
`;

const Empty = styled.p`
    padding: ${clampH(70)} 0;
    text-align: center;
    color: ${colors.textMuted};
    font-family: ${font.family};
    font-size: ${font.size.md};
`;

const BoardTableView = ({ posts, basePath, requiresLogin = false }) => {
    if (!posts.length) {
        return <Empty>등록된 게시글이 없습니다.</Empty>;
    }

    // 로그인해야 보는 게시판(회의록 등)은 눌렀을 때 바로 안내하고 상세로
    // 넘어가지 않게 막는다. 실제 차단은 서버(posts.py)가 하고, 이건 헛되이
    // 상세 페이지를 한 번 왕복하지 않도록 하는 화면 쪽 안내일 뿐이다.
    const handleTitleClick = (event) => {
        if (requiresLogin && !isLoggedIn()) {
            event.preventDefault();
            alert("로그인이 필요합니다.");
        }
    };

    return (
        <Table>
            <colgroup>
                <col style={{ width: clampW(90) }} />
                <col />
                <col style={{ width: clampW(130) }} />
                <col style={{ width: clampW(90) }} />
            </colgroup>
            <thead>
                <tr>
                    <Th scope="col">번호</Th>
                    <Th scope="col">제목</Th>
                    <Th scope="col">등록일</Th>
                    <Th scope="col">조회수</Th>
                </tr>
            </thead>
            <tbody>
                {posts.map((post) => (
                    <Tr key={post.id}>
                        <Td $muted>{post.isNotice ? "공지" : post.displayNumber}</Td>
                        <TitleCell>
                            <TitleLink
                                to={`${basePath}/detail/${post.id}`}
                                $notice={post.isNotice}
                                title={post.title}
                                onClick={handleTitleClick}
                            >
                                {post.isNotice && <NoticeBadge>공지</NoticeBadge>}
                                <span>{post.title}</span>
                            </TitleLink>
                        </TitleCell>
                        <Td $muted>{post.createdAt}</Td>
                        <Td $muted>{post.views}</Td>
                    </Tr>
                ))}
            </tbody>
        </Table>
    );
};

export default BoardTableView;
