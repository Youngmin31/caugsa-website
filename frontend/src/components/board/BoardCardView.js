/**
 * BoardCardView
 * =============
 * 포스터 썸네일 3열 카드 그리드 (참여 행사, 제휴).
 *
 * 첨부 이미지가 있으면 썸네일로 쓰고, 없으면 제목을 얹은 플레이스홀더를 보여준다.
 * (레거시 데이터는 파일명만 있고 실제 파일은 업로드 디렉터리에 있어
 *  이미지가 없는 글도 목록에서 깨지지 않도록 처리한다)
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { colors, font, media, radius, shadow, clampW, clampH } from "../../styles/theme";

const Grid = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${clampH(34)} ${clampW(26)};

    ${media.tablet} {
        grid-template-columns: repeat(2, 1fr);
    }

    ${media.mobile} {
        /* 홈 화면의 참여 행사 카드처럼 모바일에서도 가로 3열을 유지한다.
           간격만 좁혀서 카드가 들어가게 한다. */
        grid-template-columns: repeat(3, 1fr);
        gap: ${clampW(10)};
    }
`;

const Card = styled.li`
    display: flex;
    flex-direction: column;
`;

const CardLink = styled(Link)`
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: ${clampH(14)};

    &:hover figure {
        box-shadow: ${shadow.cardHover};
        transform: translateY(-2px);
    }
`;

const Thumb = styled.figure`
    margin: 0;
    aspect-ratio: 3 / 4;
    border-radius: ${radius.md};
    overflow: hidden;
    background: linear-gradient(160deg, #cddcf5 0%, #a9c2ea 100%);
    box-shadow: ${shadow.card};
    transition: box-shadow 0.18s ease, transform 0.18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
`;

const Placeholder = styled.figcaption`
    padding: ${clampW(22)};
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    line-height: 1.5;
    word-break: keep-all;
`;

const NoticeTag = styled.em`
    position: absolute;
    top: ${clampH(12)};
    left: ${clampW(12)};
    font-style: normal;
    font-family: ${font.family};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.bold};
    color: ${colors.white};
    background: ${colors.navy};
    border-radius: ${radius.sm};
    padding: 3px ${clampW(9)};
`;

const CardTitle = styled.p`
    margin: 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.medium};
    color: ${colors.text};
    line-height: 1.5;
    word-break: keep-all;
`;

const Empty = styled.p`
    padding: ${clampH(70)} 0;
    text-align: center;
    color: ${colors.textMuted};
    font-family: ${font.family};
    font-size: ${font.size.md};
`;

/** 썸네일 파일이 없으면(레거시 이관 글) 제목 플레이스홀더로 되돌린다. */
const CardThumb = ({ post }) => {
    const [showImage, setShowImage] = useState(Boolean(post.thumbnailUrl));

    return (
        <Thumb>
            {post.isNotice && <NoticeTag>공지</NoticeTag>}
            {showImage ? (
                <img src={post.thumbnailUrl} alt="" onError={() => setShowImage(false)} />
            ) : (
                <Placeholder>{post.title}</Placeholder>
            )}
        </Thumb>
    );
};

const BoardCardView = ({ posts, basePath }) => {
    if (!posts.length) {
        return <Empty>등록된 게시글이 없습니다.</Empty>;
    }

    return (
        <Grid>
            {posts.map((post) => (
                <Card key={post.id}>
                    <CardLink to={`${basePath}/detail/${post.id}`}>
                        <CardThumb post={post} />
                        <CardTitle>{post.title}</CardTitle>
                    </CardLink>
                </Card>
            ))}
        </Grid>
    );
};

export default BoardCardView;
