/**
 * BoardAccordionView
 * ==================
 * FAQ. 질문을 누르면 답변이 펼쳐진다.
 * 답변은 왼쪽 네이비 세로선 + 본문.
 */

import React, { useState } from "react";
import styled from "styled-components";

import { resolveContentApiUrls } from "../../services/boardService";
import { colors, font, radius, shadow, clampW, clampH } from "../../styles/theme";

const Panel = styled.div`
    background: ${colors.white};
    border-radius: ${radius.lg};
    box-shadow: ${shadow.card};
    padding: ${clampH(26)} ${clampW(24)};
`;

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${clampH(12)};
`;

const Question = styled.button`
    width: 100%;
    text-align: left;
    border: none;
    cursor: pointer;
    background: ${colors.accordionBg};
    border-radius: ${radius.md};
    padding: ${clampH(17)} ${clampW(22)};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    color: ${colors.textStrong};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${clampW(14)};
    transition: background 0.15s ease;

    &:hover {
        background: #e5e8f2;
    }

    svg {
        flex: 0 0 auto;
        transform: rotate(${(props) => (props.$open ? "180deg" : "0deg")});
        transition: transform 0.18s ease;
    }
`;

const Answer = styled.div`
    padding: ${clampH(20)} ${clampW(22)} 6px ${clampW(24)};
    margin: 2px 0 6px;
    border-left: 3px solid ${colors.navy};
    font-family: ${font.family};
    font-size: ${font.size.base};
    line-height: 1.85;
    color: ${colors.text};

    p {
        margin: 0;
    }
`;

const Empty = styled.p`
    padding: ${clampH(50)} 0;
    text-align: center;
    color: ${colors.textMuted};
    font-family: ${font.family};
    font-size: ${font.size.md};
`;

const Chevron = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const BoardAccordionView = ({ posts }) => {
    const [openId, setOpenId] = useState(null);

    if (!posts.length) {
        return (
            <Panel>
                <Empty>등록된 질문이 없습니다.</Empty>
            </Panel>
        );
    }

    return (
        <Panel>
            <List>
                {posts.map((post) => {
                    const isOpen = openId === post.id;
                    return (
                        <li key={post.id}>
                            <Question
                                type="button"
                                $open={isOpen}
                                aria-expanded={isOpen}
                                onClick={() => setOpenId(isOpen ? null : post.id)}
                            >
                                {post.title}
                                <Chevron />
                            </Question>
                            {isOpen && (
                                <Answer>
                                    {post.content ? (
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: resolveContentApiUrls(post.content),
                                            }}
                                        />
                                    ) : (
                                        <p>답변이 준비 중입니다.</p>
                                    )}
                                </Answer>
                            )}
                        </li>
                    );
                })}
            </List>
        </Panel>
    );
};

export default BoardAccordionView;
