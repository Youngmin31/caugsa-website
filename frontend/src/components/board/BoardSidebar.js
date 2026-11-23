/**
 * BoardSidebar
 * ============
 * 서브 페이지 왼쪽 메뉴. 메뉴 제목 + 밑줄, 그 아래 항목 리스트.
 * 현재 항목은 네이비 배경 + 흰 글씨.
 */

import React from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";

import { boardPath } from "../../config/boards";
import { colors, font, layout, media, radius, shadow, clampW, clampH } from "../../styles/theme";

const Wrapper = styled.aside`
    flex: 0 0 ${layout.sidebarWidth};
    width: ${layout.sidebarWidth};

    ${media.mobile} {
        flex: 0 0 auto;
        width: 100%;
    }
`;

const Title = styled.h2`
    margin: 0 0 ${clampH(18)};
    padding-bottom: ${clampH(14)};
    border-bottom: 2px solid ${colors.navy};
    font-family: ${font.family};
    font-size: ${font.size.h2};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    letter-spacing: -0.02em;

    ${media.mobile} {
        font-size: ${font.size.xl};
    }
`;

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: ${radius.md};
    overflow: hidden;
    box-shadow: ${shadow.sidebar};
    background: ${colors.white};
`;

const Item = styled.li`
    & + & {
        border-top: 1px solid ${colors.border};
    }
`;

const ItemLink = styled(NavLink)`
    display: block;
    padding: ${clampH(13)} ${clampW(18)};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    color: ${colors.textStrong};
    text-decoration: none;
    background: ${colors.white};
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
        background: ${colors.pageBg};
    }

    &.active {
        background: ${colors.navy};
        color: ${colors.onNavy};
    }
`;

const BoardSidebar = ({ menu }) => {
    if (!menu) return null;

    return (
        <Wrapper>
            <Title>{menu.title}</Title>
            <List>
                {menu.boards.map((board) => (
                    <Item key={board.slug}>
                        <ItemLink
                            to={boardPath(menu.key, board.slug)}
                            className={({ isActive }) => (isActive ? "active" : "")}
                        >
                            {board.name}
                        </ItemLink>
                    </Item>
                ))}
            </List>
        </Wrapper>
    );
};

export default BoardSidebar;
