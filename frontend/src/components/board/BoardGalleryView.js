/**
 * BoardGalleryView
 * ================
 * 가로로 긴 이미지 1열 (공약 이행 보고).
 * 이미지 아래 제목이 가운데 정렬로 붙는다.
 *
 * "가로형으로 보기" 체크된 글(BoardFormPage 참고)은 인스타그램 카드뉴스
 * 3분할 게시물의 표지 3장을 간격 없이 이어 붙여 하나의 가로 이미지처럼
 * 보여준다. 썸네일 1장만 오는 목록 API 로는 판별할 수 없어 BoardListPage
 * 가 상세 API 로 content/attachments 를 미리 채워 넘겨준다.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { resolveApiUrl } from "../../services/boardService";
import { colors, font, media, radius, shadow, clampW, clampH } from "../../styles/theme";
import { hasHorizontalMarker } from "../../utils/horizontalGallery";

/*
 * 한 줄에 3장씩 놓는다. 참여 행사 카드(BoardCardView)처럼 모바일에서도 3열을
 * 유지하고 간격만 좁힌다.
 */
const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${clampH(46)} ${clampW(26)};

    ${media.mobile} {
        gap: ${clampH(24)} ${clampW(10)};
    }
`;

/* "가로형으로 보기" 글은 3장을 이어 붙인 가로 배너라 한 줄을 통째로 쓴다. */
const Item = styled.li`
    min-width: 0;
    ${({ $wide }) => $wide && "grid-column: 1 / -1;"}
`;

const ItemLink = styled(Link)`
    display: flex;
    flex-direction: column;
    gap: ${clampH(16)};
    text-decoration: none;
    color: inherit;

    &:hover figure {
        box-shadow: ${shadow.cardHover};
    }
`;

/*
 * 틀은 공약 이행 보고 카드뉴스 원본(1440x1920)과 같은 3:4(가로 3, 세로 4)로
 * 고정하고, 이미지는 잘리지 않게 틀 안에 전체를 맞춰 넣는다(contain).
 * 예전처럼 16:6 틀에 cover 로 채우면 가운데 30% 정도만 남고 위아래가 잘렸다.
 * 원본과 비율이 같은 이미지는 틀을 빈틈없이 채우고, 비율이 다른 이미지만
 * 남는 부분이 배경색으로 보인다.
 */
const Banner = styled.figure`
    margin: 0;
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: ${radius.md};
    overflow: hidden;
    background: linear-gradient(135deg, #eef2fb 0%, #dbe4f7 100%);
    box-shadow: ${shadow.card};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: box-shadow 0.18s ease;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
`;

/*
 * 3장을 간격 없이 이어 붙인다. 전체 비율은 16/6 으로 고정해서 목록의
 * 줄 높이가 흔들리지 않게 하고, 각 이미지는 그 1/3 폭을 cover 로 채운다 —
 * 인스타그램 카드뉴스는 애초에 한 장을 3등분해서 올리는 것이라, 이렇게
 * 이어 붙이면 원본 이미지가 거의 그대로 복원된다.
 */
const HorizontalBanner = styled.figure`
    margin: 0;
    width: 100%;
    aspect-ratio: 16 / 6;
    border-radius: ${radius.md};
    overflow: hidden;
    box-shadow: ${shadow.card};
    display: flex;
    gap: 0;
    transition: box-shadow 0.18s ease;

    img {
        flex: 1 1 0;
        min-width: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
`;

const Placeholder = styled.figcaption`
    padding: ${clampW(24)};
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.h3};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    word-break: keep-all;
`;

const Caption = styled.p`
    margin: 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.medium};
    color: ${colors.text};
`;

const Empty = styled.p`
    padding: ${clampH(70)} 0;
    text-align: center;
    color: ${colors.textMuted};
    font-family: ${font.family};
    font-size: ${font.size.md};
`;

/** 이미지 첨부만 모아 등록 순서대로 정렬하고, 앞의 3장만 쓴다. */
const imageAttachmentUrls = (post) =>
    (post.attachments || [])
        .filter((file) => file.fileType === "image")
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .slice(0, 3)
        .map((file) => resolveApiUrl(`/api/files/image?name=${encodeURIComponent(file.name)}`));

/** 썸네일 파일이 없으면(레거시 이관 글) 제목 플레이스홀더로 되돌린다. */
const GalleryBanner = ({ post, horizontalUrls }) => {
    const [showImage, setShowImage] = useState(Boolean(post.thumbnailUrl));

    if (horizontalUrls) {
        return (
            <HorizontalBanner>
                {horizontalUrls.map((url) => (
                    <img key={url} src={url} alt="" />
                ))}
            </HorizontalBanner>
        );
    }

    return (
        <Banner>
            {showImage ? (
                <img src={post.thumbnailUrl} alt="" onError={() => setShowImage(false)} />
            ) : (
                <Placeholder>{post.title}</Placeholder>
            )}
        </Banner>
    );
};

const BoardGalleryView = ({ posts, basePath }) => {
    if (!posts.length) {
        return <Empty>등록된 게시글이 없습니다.</Empty>;
    }

    return (
        <List>
            {posts.map((post) => {
                const urls = hasHorizontalMarker(post.content) ? imageAttachmentUrls(post) : [];
                // 가로형 체크를 했어도 이미지가 3장이 안 모이면(작성 중 지웠거나 레거시)
                // 기존 단일 배너로 조용히 되돌린다 — 깨진 줄로 보이는 것보다 안전하다.
                const horizontalUrls = urls.length === 3 ? urls : null;
                return (
                    <Item key={post.id} $wide={Boolean(horizontalUrls)}>
                        <ItemLink to={`${basePath}/detail/${post.id}`}>
                            <GalleryBanner post={post} horizontalUrls={horizontalUrls} />
                            <Caption>{post.title}</Caption>
                        </ItemLink>
                    </Item>
                );
            })}
        </List>
    );
};

export default BoardGalleryView;
