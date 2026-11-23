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
import { colors, font, radius, shadow, clampW, clampH } from "../../styles/theme";
import { hasHorizontalMarker } from "../../utils/horizontalGallery";

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${clampH(46)};
`;

const Item = styled.li``;

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
 * 이미지가 있으면 틀 비율을 고정하지 않고 이미지 원래 비율대로 전체를 보여준다.
 * 공약 이행 보고에는 세로형 카드뉴스(3:4)가 주로 올라오는데, 16:6 틀에 cover 로
 * 채우면 가운데 30% 정도만 남고 위아래가 잘렸다. 세로로 너무 길어지지 않게
 * 높이만 화면의 80% 로 묶고, 남는 양옆은 배경색으로 둔다.
 * 이미지가 없을 때(제목 플레이스홀더)는 예전처럼 16:6 틀을 쓴다.
 */
const Banner = styled.figure`
    margin: 0;
    width: 100%;
    aspect-ratio: ${({ $hasImage }) => ($hasImage ? "auto" : "16 / 6")};
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
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 80vh;
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
const GalleryBanner = ({ post }) => {
    const [showImage, setShowImage] = useState(Boolean(post.thumbnailUrl));

    const horizontalUrls = hasHorizontalMarker(post.content) ? imageAttachmentUrls(post) : [];
    // 가로형 체크를 했어도 이미지가 3장이 안 모이면(작성 중 지웠거나 레거시)
    // 기존 단일 배너로 조용히 되돌린다 — 깨진 줄로 보이는 것보다 안전하다.
    if (horizontalUrls.length === 3) {
        return (
            <HorizontalBanner>
                {horizontalUrls.map((url) => (
                    <img key={url} src={url} alt="" />
                ))}
            </HorizontalBanner>
        );
    }

    return (
        <Banner $hasImage={showImage}>
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
            {posts.map((post) => (
                <Item key={post.id}>
                    <ItemLink to={`${basePath}/detail/${post.id}`}>
                        <GalleryBanner post={post} />
                        <Caption>{post.title}</Caption>
                    </ItemLink>
                </Item>
            ))}
        </List>
    );
};

export default BoardGalleryView;
