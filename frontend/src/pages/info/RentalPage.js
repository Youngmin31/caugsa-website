/**
 * RentalPage (정보 마당 > 대여)
 * ============================
 * 시안(figma 화면/대여.png): 상시 대여 안내 카드 + 하위 항목 바로가기 카드 2개.
 * 게시판이 아니라 안내 페이지지만, 문구/링크는 09_admin/manage_content 에서
 * 관리자가 고칠 수 있다 (services/contentService, key="rental"). 화면 모양은
 * 그대로 두고 안에 채우는 값만 서버에서 받아 온다.
 *
 * 서버가 아직 응답하기 전(또는 오류일 때)에도 화면이 비어 보이지 않도록,
 * 지금까지 화면에 있던 문구를 DEFAULT_CONTENT 로 그대로 들고 있다가
 * 초깃값으로 쓴다 — 관리자가 한 번도 안 고쳤으면 서버도 같은 값을 준다.
 */

import React, { useEffect, useState } from "react";
import styled from "styled-components";

import PageHeader from "../../components/board/PageHeader";
import InfoLinkCard from "../../components/info/InfoLinkCard";
import { fetchContent } from "../../services/contentService";
import { colors, font, media, radius, shadow } from "../../styles/theme";

const Panel = styled.section`
    background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
    border-radius: ${radius.lg};
    box-shadow: ${shadow.card};
    padding: 34px 38px 40px;

    ${media.mobile} {
        padding: 24px 20px 28px;
    }
`;

const PanelTitle = styled.h2`
    margin: 0 0 22px;
    padding-bottom: 16px;
    border-bottom: 2px solid ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.h3};
    font-weight: ${font.weight.bold};
    color: ${colors.text};
`;

const Block = styled.div`
    & + & {
        margin-top: 24px;
    }

    h3 {
        margin: 0 0 6px;
        font-family: ${font.family};
        font-size: ${font.size.md};
        font-weight: ${font.weight.bold};
        color: ${colors.text};
    }

    p {
        margin: 0;
        font-family: ${font.family};
        font-size: ${font.size.base};
        line-height: 1.8;
        color: ${colors.text};
        word-break: keep-all;
        /* 서버 문구의 줄바꿈(\n)을 <br/> 없이도 그대로 살린다 */
        white-space: pre-line;
    }
`;

const CardRow = styled.div`
    margin-top: 46px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 30px;

    ${media.mobile} {
        grid-template-columns: 1fr;
        gap: 18px;
    }
`;

const GownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 3.8h9.4l2.6 2.6v13.8H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M15 3.8v3h3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 12.5h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
);

const LockerIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.2" y="3.6" width="15.6" height="16.8" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.2 12h15.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M15.4 8.2h1.6M15.4 15.8h1.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
);

/* 관리자가 아직 고치지 않았을 때(= 서버 응답 전)에도 화면이 그대로 보이도록 쓰는 기본값 */
const DEFAULT_CONTENT = {
    panelTitle: "상시 대여",
    blocks: [
        {
            heading: "대여 물품",
            body: "보조배터리, 충전기, 우산, 돗자리, 고무링, 키스킨, 불법 카메라 탐지 기기, 듀라테이블, 캐노피, 수레",
        },
        {
            heading: "일부 운영기간",
            body:
                "플로터 사용, 캐노피, 듀라테이블 대여만 가능\n" +
                "사용일 기준 최소 2일 전 카카오톡 채널 ‘중앙대학교 서울캠퍼스 총학생회’를 통해 예약 후 대여 가능",
        },
        {
            heading: "기타 안내사항",
            body:
                "중간고사 및 기말고사 시험기간에는 상주사업 운영을 중단합니다.\n" +
                "정상 운영 기간에 관한 안내는 추후 다른 홍보물을 통해 안내될 예정입니다.\n" +
                "운영 시간: (평일) 11:00 ~ 18:00",
        },
    ],
    cards: [
        { title: "학위복/졸업소품", to: "/info/rental/list" },
        { title: "학술정보원\n사물함", to: "/info/rental/list" },
    ],
};

/* 카드 아이콘은 문구가 아니라 화면 모양이라 관리자 편집 대상이 아니다. 순서대로 붙인다. */
const CARD_ICONS = [<GownIcon key="gown" />, <LockerIcon key="locker" />];

const RentalPage = () => {
    const [content, setContent] = useState(DEFAULT_CONTENT);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchContent("rental");
                if (!cancelled && data) setContent(data);
            } catch (err) {
                console.error("대여 페이지 콘텐츠 오류:", err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <>
            <PageHeader title="대여" />

            <Panel>
                <PanelTitle>{content.panelTitle}</PanelTitle>

                {content.blocks.map((block, index) => (
                    <Block key={index}>
                        <h3>{block.heading}</h3>
                        <p>{block.body}</p>
                    </Block>
                ))}
            </Panel>

            <CardRow>
                {content.cards.map((card, index) => (
                    <InfoLinkCard
                        key={index}
                        title={card.title}
                        icon={CARD_ICONS[index]}
                        to={card.to}
                    />
                ))}
            </CardRow>
        </>
    );
};

export default RentalPage;
