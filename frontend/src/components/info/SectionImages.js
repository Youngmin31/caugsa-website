/**
 * SectionImages
 * =============
 * 소개 페이지처럼 "이미지로 만들어진 페이지" 의 본문.
 *
 * 관리자가 콘텐츠 관리(/admin/content)에서 올린 이미지를 올린 순서대로 그린다.
 * 여러 장을 올릴 수 있고, 한 장도 없으면 번들에 들어 있는 기본 이미지를 쓴다
 * (아직 아무것도 올리지 않은 페이지가 빈 화면이 되지 않도록).
 */

import React, { useEffect, useState } from "react";
import styled from "styled-components";

import useApi from "../../hooks/api/axiosInterceptor";
import { colors, font, media, radius, clampW, clampH } from "../../styles/theme";

const List = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${clampH(26)};
    padding: ${clampH(8)} 0 ${clampH(20)};

    ${media.mobile} {
        gap: ${clampH(16)};
    }
`;

const Picture = styled.img`
    display: block;
    width: 100%;
    max-width: ${clampW(1000)};
    height: auto;
    border-radius: ${radius.md};
`;

const Message = styled.p`
    padding: ${clampH(70)} 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.textMuted};
`;

/** 서버가 준 상대 URL(/api/sections/...) 을 브라우저가 바로 쓸 주소로 바꾼다. */
const resolve = (url) => {
    const base = useApi.defaults.baseURL || "";
    return base.replace(/\/api\/?$/, "") + url;
};

const SectionImages = ({ sectionKey, alt, fallback }) => {
    const [images, setImages] = useState(null); // null = 아직 불러오는 중

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await useApi.get(`/sections/${sectionKey}`);
                if (!cancelled) setImages(data.images || []);
            } catch (err) {
                console.error("섹션 이미지 오류:", err);
                if (!cancelled) setImages([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [sectionKey]);

    if (images === null) {
        return <Message>불러오는 중…</Message>;
    }

    if (images.length === 0) {
        if (fallback) return <List><Picture src={fallback} alt={alt} /></List>;
        return <Message>등록된 이미지가 없습니다.</Message>;
    }

    return (
        <List>
            {images.map((image, index) => (
                <Picture
                    key={image.name}
                    src={resolve(image.url)}
                    alt={images.length > 1 ? `${alt} ${index + 1}` : alt}
                />
            ))}
        </List>
    );
};

export default SectionImages;
