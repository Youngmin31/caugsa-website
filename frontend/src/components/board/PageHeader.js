/**
 * PageHeader
 * ==========
 * 콘텐츠 상단: 페이지 제목(왼쪽) + 검색창 또는 브레드크럼(오른쪽), 그 아래 네이비 굵은 선.
 */

import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { colors, font, media, clampW, clampH } from "../../styles/theme";

const Wrapper = styled.div`
    margin-bottom: ${clampH(30)};
`;

const Row = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${clampW(20)};
    padding-bottom: ${clampH(16)};
    border-bottom: 2px solid ${colors.navy};

    ${media.mobile} {
        flex-direction: column;
        align-items: stretch;
        gap: ${clampH(12)};
    }
`;

const Title = styled.h1`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.h2};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    letter-spacing: -0.02em;
    white-space: nowrap;

    ${media.mobile} {
        font-size: ${font.size.xl};
    }
`;

const Crumbs = styled.nav`
    display: flex;
    align-items: center;
    gap: ${clampW(8)};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    padding-bottom: ${clampH(4)};

    a {
        color: ${colors.textMuted};
        text-decoration: none;

        &:hover {
            color: ${colors.navy};
        }
    }

    span[aria-current] {
        color: ${colors.navy};
        font-weight: ${font.weight.semibold};
    }
`;

const Sep = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/**
 * @param {string}  title  페이지 제목
 * @param {node}    right  오른쪽 영역 (검색창 등). crumbs 보다 우선한다.
 * @param {array}   crumbs [{label, to}] 형태. 마지막 항목이 현재 위치.
 */
const PageHeader = ({ title, right, crumbs }) => (
    <Wrapper>
        <Row>
            <Title>{title}</Title>
            {right ||
                (crumbs && crumbs.length > 0 && (
                    <Crumbs aria-label="현재 위치">
                        {crumbs.map((crumb, index) => {
                            const isLast = index === crumbs.length - 1;
                            return (
                                <React.Fragment key={`${crumb.label}-${index}`}>
                                    {index > 0 && <Sep />}
                                    {isLast || !crumb.to ? (
                                        <span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
                                    ) : (
                                        <Link to={crumb.to}>{crumb.label}</Link>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </Crumbs>
                ))}
        </Row>
    </Wrapper>
);

export default PageHeader;
